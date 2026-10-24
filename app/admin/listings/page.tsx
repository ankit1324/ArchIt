import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { ADMIN_PAGE_SIZE, listingSearchFilter, parseListingFilters } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { LISTING_STATUSES } from "@/lib/moderation";
import AdminAction from "../AdminAction";
import { Badge, cell, Empty, head, LoadError, Pager, UserLink, when } from "../ui";

export const metadata = { title: "Listings" };

interface Row {
  id: string;
  building_name: string | null;
  address: string;
  city: string;
  price: number;
  type: string;
  kind: string;
  status: string;
  featured: boolean;
  user_id: string | null;
  created_at: string;
}

const STATUS_FILTERS = ["all", ...LISTING_STATUSES] as const;

/** Every listing, any status: search, filter, and act on each one. */
export default async function AdminListings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const filters = parseListingFilters(await searchParams);

  let q = db
    .from("properties")
    .select("id, building_name, address, city, price, type, kind, status, featured, user_id, created_at")
    .order("created_at", { ascending: false })
    // one extra row tells us whether there is a next page
    .range((filters.page - 1) * ADMIN_PAGE_SIZE, filters.page * ADMIN_PAGE_SIZE);
  if (filters.status !== "all") q = q.eq("status", filters.status);
  const search = listingSearchFilter(filters.q);
  if (search) q = q.or(search);
  const { data, error } = await q.overrideTypes<Row[], { merge: false }>();
  const rows = (data ?? []).slice(0, ADMIN_PAGE_SIZE);
  const hasNext = (data?.length ?? 0) > ADMIN_PAGE_SIZE;

  const keep: Record<string, string> = {};
  if (filters.q) keep.q = filters.q;
  if (filters.status !== "all") keep.status = filters.status;
  const filterHref = (status: string) => {
    const p = new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(status !== "all" ? { status } : {}) });
    return p.toString() ? `/admin/listings?${p}` : "/admin/listings";
  };

  return (
    <>
      <LoadError errors={[error?.message]} />
      <form className="mt-8 flex flex-wrap items-center gap-2" action="/admin/listings">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, address, city or id"
          className="min-w-0 flex-1 rounded-full border border-plum/15 bg-white px-4 py-2 text-[14px]"
        />
        {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
        <button className="rounded-full bg-plum px-4 py-2 text-[13px] font-bold text-cream">Search</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={filterHref(s)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold ${
              filters.status === s ? "bg-plum text-cream" : "bg-white/70 text-plum"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {rows.length ? (
          <div className="overflow-x-auto rounded-2xl bg-white/70">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={head}>Listing</th>
                  <th className={head}>Price</th>
                  <th className={head}>Status</th>
                  <th className={head}>Lister</th>
                  <th className={head}>Created</th>
                  <th className={head}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t border-plum/10">
                    <td className={cell}>
                      <Link href={`/admin/listings/${l.id}`} className="font-bold underline">
                        {l.building_name || l.address}
                      </Link>
                      <div className="text-plum-soft">
                        {l.building_name ? `${l.address}, ` : ""}
                        {l.city} · {l.kind} · {l.type === "sale" ? "Sale" : "Rent"}
                        {l.featured ? " · ★ featured" : ""}
                      </div>
                    </td>
                    <td className={cell}>₹{Number(l.price).toLocaleString("en-IN")}</td>
                    <td className={cell}><Badge label={l.status} /></td>
                    <td className={cell}><UserLink id={l.user_id} /></td>
                    <td className={cell}>{when(l.created_at)}</td>
                    <td className={cell}>
                      <AdminAction
                        endpoint={`/api/admin/listings/${l.id}`}
                        actions={
                          l.status === "live"
                            ? [{ action: "reject", label: "Hide", tone: "neutral", askNote: true }]
                            : [{ action: "approve", label: l.status === "pending" ? "Approve" : "Unhide", tone: "primary" }]
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No listings match.</Empty>
        )}
        <Pager basePath="/admin/listings" params={keep} page={filters.page} hasNext={hasNext} />
      </div>
    </>
  );
}
