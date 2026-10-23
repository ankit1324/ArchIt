import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { purposeLabel, rupees } from "@/lib/email-templates";
import { REPORT_REASONS, isReportReason } from "@/lib/moderation";
import { safeImageUrl } from "@/lib/url";
import AdminAction from "./AdminAction";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

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

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold text-plum">
        {title} <span className="text-plum-soft">({count})</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white/60 p-4 text-[14px] text-plum-soft">{children}</p>;
}

/**
 * Trust & safety and money ops in one page: the listing review queue, open
 * reports, payments owed back, and the latest purchases. Admins only
 * (lib/admin.ts); everyone else gets a 404.
 */
export default async function AdminPage() {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();

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
  const failed = [pending, reports, refunds, purchases].filter((r) => r.error);
  for (const r of failed) console.error("admin page query failed:", r.error?.message);

  const cell = "px-3 py-2 align-top";
  const head = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-plum-soft";

  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-wide">Admin</h1>
          <Link href="/find" className="text-[14px] font-semibold underline">
            Back to the map
          </Link>
        </div>
        {failed.length > 0 && (
          <p role="alert" className="mt-4 rounded-2xl bg-coral/15 p-3 text-[14px] font-semibold">
            Some data failed to load ({failed.map((r) => r.error?.message).join("; ")}). Has the
            latest migration been applied?
          </p>
        )}

        <Section title="Listings awaiting review" count={pending.data?.length ?? 0}>
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
                    Submitted {when(p.created_at)} by <code>{p.user_id ?? "unknown"}</code>
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
                    {when(r.created_at)} by <code>{r.reporter_id}</code> · listing{" "}
                    <code>{r.property_id}</code>
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
            marks these <code>refund_due</code>). Refund them from the YouPI-PG admin, then set
            the order to <code>cancelled</code>.
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
                      <td className={cell}><code>{o.user_id}</code></td>
                      <td className={cell}><code>{o.payment_id}</code></td>
                      <td className={cell}><code>{o.order_id}</code></td>
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
                      <td className={cell}><code>{p.user_id}</code></td>
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
      </main>
    </div>
  );
}
