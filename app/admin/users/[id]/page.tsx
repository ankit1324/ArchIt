import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin, isAdminUser } from "@/lib/admin";
import { auditHistory } from "@/lib/admin-audit";
import { sumPaise } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { purposeLabel, rupees } from "@/lib/email-templates";
import AdminAction from "../../AdminAction";
import { AuditTable, Badge, cell, Empty, head, LoadError, Section, when } from "../../ui";

export const metadata = { title: "User" };

interface ListingRow {
  id: string;
  building_name: string | null;
  address: string;
  city: string;
  status: string;
  created_at: string;
}

interface PurchaseRow {
  id: number;
  purpose: string;
  ref: string | null;
  amount: number | null;
  payment_id: string;
  created_at: string;
}

/** One user: Clerk profile, their listings, purchases, designs, and ban controls. */
export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const { id } = await params;
  if (!/^user_[A-Za-z0-9]{1,64}$/.test(id)) notFound();

  const [user, listings, purchases, designs, history] = await Promise.all([
    clerkClient()
      .then((c) => c.users.getUser(id))
      .catch(() => null),
    db
      .from("properties")
      .select("id, building_name, address, city, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .overrideTypes<ListingRow[], { merge: false }>(),
    db
      .from("purchases")
      .select("id, purpose, ref, amount, payment_id, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .overrideTypes<PurchaseRow[], { merge: false }>(),
    db.from("designs").select("id", { count: "exact", head: true }).eq("user_id", id),
    auditHistory({ type: "user", id }, 50),
  ]);
  // a deleted Clerk user can still own rows (or admin history, e.g. banned and
  // then deleted) here, so only 404 when there's nothing at all
  if (!user && !listings.data?.length && !purchases.data?.length && !history.entries.length) {
    notFound();
  }

  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
  const admin = user ? isAdminUser(user) : false;

  return (
    <>
      <LoadError errors={[listings.error?.message, purchases.error?.message, designs.error?.message, history.error]} />
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            {/* `||`: with no email, name is "" (not null) and must fall through to the id */}
            {user?.primaryEmailAddress?.emailAddress || name || id}{" "}
            {admin && <Badge label="admin" />} {user?.banned && <Badge label="banned" />}
          </h1>
          <p className="mt-1 text-[13px] text-plum-soft">
            {name && `${name} · `}
            <code>{id}</code>
          </p>
          {user ? (
            <p className="mt-1 text-[13px] text-plum-soft">
              Joined {when(user.createdAt)} · last sign-in {when(user.lastSignInAt)}
              {user.emailAddresses.length > 1 &&
                ` · also ${user.emailAddresses
                  .filter((e) => e.id !== user.primaryEmailAddressId)
                  .map((e) => e.emailAddress)
                  .join(", ")}`}
            </p>
          ) : (
            <p className="mt-1 text-[13px] font-semibold">Not found in Clerk (account deleted?)</p>
          )}
        </div>
        {user && !admin && id !== userId && (
          <AdminAction
            endpoint={`/api/admin/users/${id}`}
            actions={[
              user.banned
                ? { action: "unban", label: "Unban", tone: "primary", confirm: "Let this user sign in again?" }
                : {
                    action: "ban",
                    label: "Ban user",
                    tone: "danger",
                    confirm: "Ban this user? They are signed out everywhere and can't sign back in. Their listings stay as they are.",
                    askNote: true,
                    notePrompt: "Reason for the ban (kept in the audit log)",
                  },
            ]}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-[12px] font-bold uppercase text-plum-soft">Listings</div>
          <div className="text-xl font-extrabold">{listings.data?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-[12px] font-bold uppercase text-plum-soft">Designs</div>
          <div className="text-xl font-extrabold">{designs.count ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-[12px] font-bold uppercase text-plum-soft">Spent</div>
          <div className="text-xl font-extrabold">{rupees(sumPaise(purchases.data ?? []))}</div>
        </div>
      </div>

      <Section title="Listings" count={listings.data?.length ?? 0}>
        {listings.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {listings.data.map((l) => (
              <li key={l.id} className="rounded-2xl bg-white/70 p-3 text-[13px]">
                <Link href={`/admin/listings/${l.id}`} className="font-bold underline">
                  {l.building_name || l.address}
                </Link>{" "}
                <Badge label={l.status} />
                <div className="text-plum-soft">
                  {l.city} · listed {when(l.created_at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No listings.</Empty>
        )}
      </Section>

      <Section title="Purchases" count={purchases.data?.length ?? 0}>
        {purchases.data?.length ? (
          <div className="overflow-x-auto rounded-2xl bg-white/70">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={head}>When</th>
                  <th className={head}>Purpose</th>
                  <th className={head}>Amount</th>
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
                    <td className={cell}><code>{p.payment_id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No purchases.</Empty>
        )}
      </Section>

      <Section title="Admin history">
        <AuditTable rows={history.entries} showTarget={false} />
      </Section>
    </>
  );
}
