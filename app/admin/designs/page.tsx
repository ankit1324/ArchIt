import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import AdminAction from "../AdminAction";
import { cell, Empty, head, LoadError, Pager, UserLink, when } from "../ui";

export const metadata = { title: "Designs" };

interface Row {
  id: string;
  name: string;
  user_id: string;
  author_name: string | null;
  place: string | null;
  plot_lng: number;
  plot_lat: number;
  published_at: string;
}

/**
 * Published designs (the public showcase and the /find Designs layer), newest
 * first. Designs are not pre-moderated: anything published is public at once,
 * so this is where an admin takes one down.
 */
export default async function AdminDesigns({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const page = parsePage((await searchParams).page);

  const { data, error } = await db
    .from("designs")
    .select("id, name, user_id, author_name, place, plot_lng, plot_lat, published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    // one extra row tells us whether there is a next page
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
    .overrideTypes<Row[], { merge: false }>();
  const rows = (data ?? []).slice(0, ADMIN_PAGE_SIZE);
  const hasNext = (data?.length ?? 0) > ADMIN_PAGE_SIZE;

  return (
    <>
      <LoadError errors={[error?.message]} />
      <p className="mt-8 text-[14px] text-plum-soft">
        Published designs are public in the showcase and on the map. Unpublishing makes one
        private again; its author keeps it and can publish it again.
      </p>
      <div className="mt-4">
        {rows.length ? (
          <div className="overflow-x-auto rounded-2xl bg-white/70">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={head}>Design</th>
                  <th className={head}>Author</th>
                  <th className={head}>Published</th>
                  <th className={head}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-plum/10">
                    <td className={cell}>
                      <Link href={`/showcase/${encodeURIComponent(d.id)}`} className="font-bold underline">
                        {d.name}
                      </Link>
                      <div className="text-plum-soft">
                        {d.place || (d.plot_lng || d.plot_lat ? "pinned on the map" : "gallery only")}
                      </div>
                    </td>
                    <td className={cell}>
                      <div>{d.author_name || "—"}</div>
                      <UserLink id={d.user_id} />
                    </td>
                    <td className={cell}>{when(d.published_at)}</td>
                    <td className={cell}>
                      <AdminAction
                        endpoint={`/api/admin/designs/${encodeURIComponent(d.id)}`}
                        actions={[
                          {
                            action: "unpublish",
                            label: "Unpublish",
                            tone: "danger",
                            askNote: true,
                            notePrompt: "Unpublish: reason (kept in the audit log)",
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
          <Empty>No published designs.</Empty>
        )}
        <Pager basePath="/admin/designs" params={{}} page={page} hasNext={hasNext} />
      </div>
    </>
  );
}
