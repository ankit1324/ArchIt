import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin, isAdminUser } from "@/lib/admin";
import { ADMIN_PAGE_SIZE, parsePage, sanitizeSearch } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import {
  Badge,
  button,
  cell,
  Empty,
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
  when,
} from "../ui";

export const metadata = { title: "Users" };

/** Every Clerk user, with how much they've listed and bought here. */
export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);

  let users: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]>> | null = null;
  let clerkError: string | null = null;
  try {
    users = await (await clerkClient()).users.getUserList({
      ...(q ? { query: q } : {}),
      orderBy: "-created_at",
      limit: ADMIN_PAGE_SIZE,
      offset: (page - 1) * ADMIN_PAGE_SIZE,
    });
  } catch (e) {
    clerkError = `Clerk: ${e instanceof Error ? e.message : String(e)}`;
  }
  const list = users?.data ?? [];
  const ids = list.map((u) => u.id);

  // per-user listing and purchase counts for just this page of users
  const [listings, purchases] = ids.length
    ? await Promise.all([
        db.from("properties").select("user_id").in("user_id", ids),
        db.from("purchases").select("user_id").in("user_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const tally = (rows: { user_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const listingCounts = tally(listings.data);
  const purchaseCounts = tally(purchases.data);

  return (
    <>
      <LoadError errors={[clerkError, listings.error?.message, purchases.error?.message]} />
      <PageHeader title="Users">
        {users && (
          <p className="mt-3 text-[14px] tabular-nums text-ink-soft">
            {users.totalCount.toLocaleString("en-IN")} users
          </p>
        )}
      </PageHeader>
      <form className="mt-8 flex flex-wrap items-center gap-2" action="/admin/users" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search users"
          placeholder="Search email, name or user id"
          className={`${input} min-w-0 flex-1 basis-60`}
        />
        <button className={`${button} border border-line-strong text-ink hover:border-ink`}>Search</button>
      </form>

      <div className="mt-6">
        {list.length ? (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr>
                  <th className={head}>User</th>
                  <th className={head}>Joined</th>
                  <th className={head}>Last sign-in</th>
                  <th className={`${head} text-right`}>Listings</th>
                  <th className={`${head} text-right`}>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={u.id} className={row}>
                      <td className={cell}>
                        <Link href={`/admin/users/${u.id}`} className={`${link} break-all font-semibold`}>
                          {/* `||`: with no email, name is "" (not null) and must fall through to the id */}
                          {u.primaryEmailAddress?.emailAddress || name || u.id}
                        </Link>{" "}
                        {isAdminUser(u) && <Badge label="admin" />} {u.banned && <Badge label="banned" />}
                        <div className="text-ink-soft">
                          {name && `${name} · `}
                          <code>{u.id}</code>
                        </div>
                      </td>
                      <td className={`${cell} whitespace-nowrap tabular-nums`}>{when(u.createdAt)}</td>
                      <td className={`${cell} whitespace-nowrap tabular-nums`}>{when(u.lastSignInAt)}</td>
                      <td className={`${cell} ${num}`}>{listingCounts.get(u.id) ?? 0}</td>
                      <td className={`${cell} ${num}`}>{purchaseCounts.get(u.id) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !clerkError && <Empty>No users match.</Empty>
        )}
        <Pager
          basePath="/admin/users"
          params={q ? { q } : {}}
          page={page}
          hasNext={!!users && page * ADMIN_PAGE_SIZE < users.totalCount}
        />
      </div>
    </>
  );
}
