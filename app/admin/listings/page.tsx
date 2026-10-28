import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { ADMIN_PAGE_SIZE, listingSearchFilter, parseListingFilters } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { LISTING_STATUSES } from "@/lib/moderation";
import AdminAction from "../AdminAction";
import {
  Badge,
  button,
  cell,
  Empty,
  eyebrow,
  focus,
  head,
  input,
  link,
  LoadError,
  num,
  PageHeader,
  Pager,
  row,
  table,
  tableWrap,
  UserLink,
  when,
} from "../ui";

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
      <PageHeader title="Listings" />
      <form className="mt-8 flex flex-wrap items-center gap-2" action="/admin/listings" role="search">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          aria-label="Search listings"
          placeholder="Search name, address, city or id"
          className={`${input} min-w-0 flex-1 basis-60`}
        />
        {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
        <button className={`${button} border border-line-strong text-ink hover:border-ink`}>Search</button>
      </form>
      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`mr-1 ${eyebrow}`}>Status</span>
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={filterHref(s)}
            aria-current={filters.status === s ? "page" : undefined}
            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[12px] font-semibold capitalize transition-colors ${focus} ${
              filters.status === s
                ? "border-ink bg-ink text-paper"
                : "border-line-strong text-ink hover:border-ink"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {rows.length ? (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={head}>Listing</th>
                  <th className={`${head} text-right`}>Price</th>
                  <th className={head}>Status</th>
                  <th className={head}>Lister</th>
                  <th className={head}>Created</th>
                  <th className={head}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className={row}>
                    <td className={cell}>
                      <Link href={`/admin/listings/${l.id}`} className={`${link} font-semibold`}>
                        {l.building_name || l.address}
                      </Link>
                      <div className="text-ink-soft">
                        {l.building_name ? `${l.address}, ` : ""}
                        {l.city} · {l.kind} · {l.type === "sale" ? "Sale" : l.type === "showcase" ? "Showcase" : "Rent"}
                        {l.featured ? " · ★ featured" : ""}
                      </div>
                    </td>
                    <td className={`${cell} ${num}`}>
                      {l.type === "showcase" ? "—" : `₹${Number(l.price).toLocaleString("en-IN")}`}
                    </td>
                    <td className={cell}><Badge label={l.status} /></td>
                    <td className={cell}><UserLink id={l.user_id} /></td>
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>{when(l.created_at)}</td>
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
