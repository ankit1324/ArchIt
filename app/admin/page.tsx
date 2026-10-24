import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { ageLabel, sumPaise } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { purposeLabel, rupees } from "@/lib/email-templates";
import { REPORT_REASONS, isReportReason } from "@/lib/moderation";
import { safeImageUrl } from "@/lib/url";
import AdminAction from "./AdminAction";
import { cell, Empty, head, LoadError, Section, UserLink, when } from "./ui";

interface PendingRow {
  id: string;
  building_name: string | null;
  address: string;
  city: string;
  price: number;
  type: string;
  kind: string;
  photo: string | null;
  user_id: string | null;
  created_at: string;
}

interface ReportRow {
  id: number;
  property_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  properties: { building_name: string | null; address: string; status: string } | null;
}

interface OrderRow {
  order_id: string;
  payment_id: string;
  user_id: string;
  purpose: string;
  ref: string | null;
  amount: number;
  created_at: string;
  checked_at: string | null;
}

interface PurchaseRow {
  id: number;
  user_id: string;
  purpose: string;
  ref: string | null;
  payment_id: string;
  amount: number | null;
  created_at: string;
}

const DAY = 24 * 60 * 60 * 1000;
/** Epoch ms `n` days before this request. */
const daysAgo = (n: number) => Date.now() - n * DAY;

/** Row count only (no rows fetched); null when the query failed. */
const listings = () => db.from("properties").select("id", { count: "exact", head: true });
async function count(q: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[12px] font-bold uppercase tracking-wide text-plum-soft">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-plum-soft">{hint}</div>}
    </>
  );
  const cls = "block rounded-2xl bg-white/70 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-white`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Every purchase's amount and date, for the revenue tile. Paged: PostgREST
 * caps a response at the project's max-rows (1000 on Supabase by default)
 * whatever .limit() asks for, so a single select would quietly under-count.
 */
async function allPurchaseAmounts(): Promise<{
  data: { amount: number | null; created_at: string }[];
  error: { message: string } | null;
}> {
  const PAGE = 1000;
  const data: { amount: number | null; created_at: string }[] = [];
  for (let from = 0; from < 100 * PAGE; from += PAGE) {
    const { data: rows, error } = await db
      .from("purchases")
      .select("amount, created_at")
      .order("id")
      .range(from, from + PAGE - 1)
      .overrideTypes<{ amount: number | null; created_at: string }[], { merge: false }>();
    if (error) return { data, error };
    data.push(...(rows ?? []));
    if (!rows || rows.length < PAGE) break;
  }
  return { data, error: null };
}

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-IN"));

/**
 * Overview: headline numbers, then the work queues — listings awaiting
 * review, open reports, payments owed back — and the latest purchases.
 * Admins only (lib/admin.ts); everyone else gets a 404.
 */
export default async function AdminPage() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();

  const weekAgo = new Date(daysAgo(7)).toISOString();
  const monthAgo = daysAgo(30);
  const [live, pendingCount, rejected, newThisWeek, allPurchases, oldestPending, userCount] =
    await Promise.all([
      count(listings().eq("status", "live")),
      count(listings().eq("status", "pending")),
      count(listings().eq("status", "rejected")),
      count(listings().gte("created_at", weekAgo)),
      allPurchaseAmounts(),
      db
        .from("properties")
        .select("created_at")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .maybeSingle<{ created_at: string }>(),
      clerkClient()
        .then((c) => c.users.getCount())
        .catch(() => null),
    ]);
  const paid = allPurchases.data;
  const paid30 = paid.filter((p) => Date.parse(p.created_at) >= monthAgo);

  const [pending, reports, refunds, purchases] = await Promise.all([
    db
      .from("properties")
      .select("id, building_name, address, city, price, type, kind, photo, user_id, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(100)
      .returns<PendingRow[]>(),
    db
      .from("listing_reports")
      .select(
        "id, property_id, reporter_id, reason, details, created_at, properties(building_name, address, status)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<ReportRow[]>(),
    db
      .from("payment_orders")
      .select("order_id, payment_id, user_id, purpose, ref, amount, created_at, checked_at")
      .eq("status", "refund_due")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<OrderRow[]>(),
    db
      .from("purchases")
      .select("id, user_id, purpose, ref, payment_id, amount, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<PurchaseRow[]>(),
  ]);
  const failed = [pending, reports, refunds, purchases, allPurchases].filter((r) => r.error);
  for (const r of failed) console.error("admin page query failed:", r.error?.message);

  return (
    <>
        <LoadError errors={failed.map((r) => r.error?.message)} />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Live listings" value={fmt(live)} href="/admin/listings?status=live" />
          <Stat
            label="Awaiting review"
            value={fmt(pendingCount)}
            hint={pendingCount ? `oldest ${ageLabel(oldestPending.data?.created_at ?? null)}` : undefined}
            href="/admin/listings?status=pending"
          />
          <Stat label="Hidden / rejected" value={fmt(rejected)} href="/admin/listings?status=rejected" />
          <Stat label="New this week" value={fmt(newThisWeek)} href="/admin/listings" />
          <Stat label="Users" value={fmt(userCount)} href="/admin/users" />
          <Stat
            label="Revenue"
            value={rupees(sumPaise(paid))}
            hint={`${paid.length} purchases · ${rupees(sumPaise(paid30))} last 30 days`}
          />
        </div>

        {/* the true total: the list below stops at 100 */}
        <Section title="Listings awaiting review" count={pendingCount ?? pending.data?.length ?? 0}>
          {pending.data?.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pending.data.map((p) => (
                <li key={p.id} className="rounded-2xl bg-white/70 p-4">
                  <div className="font-bold">{p.building_name || p.address}</div>
                  <div className="text-[13px] text-plum-soft">
                    {p.building_name ? `${p.address}, ` : ""}
                    {p.city} · {p.kind} · {p.type === "sale" ? "Sale" : "Rent"} · ₹
                    {Number(p.price).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1 text-[12px] text-plum-soft">
                    Submitted {when(p.created_at)} by <UserLink id={p.user_id} />
                  </div>
                  {safeImageUrl(p.photo) && (
                    <a
                      href={safeImageUrl(p.photo)!}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[12px] underline"
                    >
                      View photo
                    </a>
                  )}
                  <div className="mt-3">
                    <AdminAction
                      endpoint={`/api/admin/listings/${p.id}`}
                      actions={[
                        { action: "approve", label: "Approve", tone: "primary" },
                        { action: "reject", label: "Reject", tone: "danger", askNote: true },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing waiting. New listings land here before they go live.</Empty>
          )}
        </Section>

        <Section title="Open reports" count={reports.data?.length ?? 0}>
          {reports.data?.length ? (
            <ul className="grid gap-3">
              {reports.data.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white/70 p-4">
                  <div className="font-bold">
                    {r.properties?.building_name || r.properties?.address || r.property_id}
                    {r.properties && r.properties.status !== "live" && (
                      <span className="ml-2 rounded-full bg-plum/10 px-2 py-0.5 text-[11px]">
                        {r.properties.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px]">
                    <strong>{isReportReason(r.reason) ? REPORT_REASONS[r.reason] : r.reason}</strong>
                    {r.details ? ` — ${r.details}` : ""}
                  </div>
                  <div className="mt-1 text-[12px] text-plum-soft">
                    {when(r.created_at)} by <UserLink id={r.reporter_id} /> · listing{" "}
                    <Link href={`/admin/listings/${r.property_id}`} className="font-mono text-[12px] underline">
                      {r.property_id}
                    </Link>
                  </div>
                  <div className="mt-3">
                    <AdminAction
                      endpoint={`/api/admin/reports/${r.id}`}
                      actions={[
                        { action: "dismiss", label: "Dismiss", tone: "neutral" },
                        { action: "takedown", label: "Take down listing", tone: "danger", askNote: true },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No open reports.</Empty>
          )}
        </Section>

        <Section title="Refunds due" count={refunds.data?.length ?? 0}>
          <p className="mb-3 text-[13px] text-plum-soft">
            Payments the gateway settled for something the user already owned (the reconciler
            marks these <code>refund_due</code>). Refund them from the YouPI-PG admin, then mark
            them refunded here.
          </p>
          {refunds.data?.length ? (
            <div className="overflow-x-auto rounded-2xl bg-white/70">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className={head}>Created</th>
                    <th className={head}>Purpose</th>
                    <th className={head}>Amount</th>
                    <th className={head}>User</th>
                    <th className={head}>Payment</th>
                    <th className={head}>Order</th>
                    <th className={head} />
                  </tr>
                </thead>
                <tbody>
                  {refunds.data.map((o) => (
                    <tr key={o.order_id} className="border-t border-plum/10">
                      <td className={cell}>{when(o.created_at)}</td>
                      <td className={cell}>
                        {purposeLabel(o.purpose)}
                        {o.ref ? <div className="text-plum-soft">{o.ref}</div> : null}
                      </td>
                      <td className={cell}>{rupees(o.amount)}</td>
                      <td className={cell}><UserLink id={o.user_id} /></td>
                      <td className={cell}><code>{o.payment_id}</code></td>
                      <td className={cell}><code>{o.order_id}</code></td>
                      <td className={cell}>
                        <AdminAction
                          endpoint={`/api/admin/orders/${encodeURIComponent(o.order_id)}`}
                          actions={[
                            {
                              action: "refunded",
                              label: "Mark refunded",
                              tone: "primary",
                              confirm: `Mark ${rupees(o.amount)} to ${o.user_id} as refunded? Only do this after the money has been sent back in YouPI.`,
                              askNote: true,
                              notePrompt: "Refund reference (UTR or gateway refund id), optional",
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No refunds owed.</Empty>
          )}
        </Section>

        <Section title="Recent purchases" count={purchases.data?.length ?? 0}>
          {purchases.data?.length ? (
            <div className="overflow-x-auto rounded-2xl bg-white/70">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className={head}>When</th>
                    <th className={head}>Purpose</th>
                    <th className={head}>Amount</th>
                    <th className={head}>User</th>
                    <th className={head}>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.data.map((p) => (
                    <tr key={p.id} className="border-t border-plum/10">
                      <td className={cell}>{when(p.created_at)}</td>
                      <td className={cell}>
                        {purposeLabel(p.purpose)}
                        {p.ref ? <div className="text-plum-soft">{p.ref}</div> : null}
                      </td>
                      <td className={cell}>{p.amount == null ? "—" : rupees(p.amount)}</td>
                      <td className={cell}><UserLink id={p.user_id} /></td>
                      <td className={cell}><code>{p.payment_id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No purchases yet.</Empty>
          )}
        </Section>
    </>
  );
}
