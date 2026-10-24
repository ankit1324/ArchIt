import Link from "next/link";

// Shared server-rendered pieces for the /admin pages.

export const cell = "px-3 py-2 align-top";
export const head = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-plum-soft";

export const when = (iso: string | number | null | undefined) =>
  iso == null
    ? "—"
    : new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold text-plum">
          {title}
          {count !== undefined && <span className="text-plum-soft"> ({count})</span>}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white/60 p-4 text-[14px] text-plum-soft">{children}</p>;
}

export function LoadError({ errors }: { errors: (string | null | undefined)[] }) {
  const list = errors.filter(Boolean);
  if (!list.length) return null;
  return (
    <p role="alert" className="mt-4 rounded-2xl bg-coral/15 p-3 text-[14px] font-semibold">
      Some data failed to load ({list.join("; ")}). Has the latest migration been applied?
    </p>
  );
}

const STATUS_TONE: Record<string, string> = {
  live: "bg-emerald-100 text-emerald-900",
  pending: "bg-amber-100 text-amber-900",
  rejected: "bg-coral/20 text-plum",
  banned: "bg-coral/20 text-plum",
  admin: "bg-plum text-cream",
};

export function Badge({ label }: { label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[label] ?? "bg-plum/10 text-plum"}`}
    >
      {label}
    </span>
  );
}

/** Prev/next links that keep the current query string. */
export function Pager({
  basePath,
  params,
  page,
  hasNext,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  hasNext: boolean;
}) {
  const href = (p: number) => {
    const q = new URLSearchParams({ ...params, ...(p > 1 ? { page: String(p) } : {}) });
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="mt-4 flex items-center gap-4 text-[14px] font-semibold">
      {page > 1 ? <Link href={href(page - 1)} className="underline">← Previous</Link> : <span />}
      <span className="text-plum-soft">Page {page}</span>
      {hasNext && <Link href={href(page + 1)} className="underline">Next →</Link>}
    </nav>
  );
}

export function UserLink({ id }: { id: string | null | undefined }) {
  if (!id) return <span className="text-plum-soft">unknown</span>;
  return (
    <Link href={`/admin/users/${id}`} className="font-mono text-[12px] underline">
      {id}
    </Link>
  );
}

export interface AuditRow {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  note: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

function targetHref(t: AuditRow): string | null {
  if (t.target_type === "listing" && t.action !== "delete") return `/admin/listings/${t.target_id}`;
  if (t.target_type === "user") return `/admin/users/${t.target_id}`;
  return null;
}

/** Table of audit entries; `showTarget` off on a single record's page. */
export function AuditTable({ rows, showTarget = true }: { rows: AuditRow[]; showTarget?: boolean }) {
  if (!rows.length) return <Empty>No admin actions recorded yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl bg-white/70">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <th className={head}>When</th>
            <th className={head}>Admin</th>
            <th className={head}>Action</th>
            {showTarget && <th className={head}>Target</th>}
            <th className={head}>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = targetHref(r);
            const name = typeof r.details?.name === "string" ? r.details.name : null;
            return (
              <tr key={r.id} className="border-t border-plum/10">
                <td className={cell}>{when(r.created_at)}</td>
                <td className={cell}><UserLink id={r.admin_id} /></td>
                <td className={cell}><strong>{r.action}</strong></td>
                {showTarget && (
                  <td className={cell}>
                    {r.target_type}{" "}
                    {href ? (
                      <Link href={href} className="font-mono text-[12px] underline">{r.target_id}</Link>
                    ) : (
                      <code>{r.target_id}</code>
                    )}
                    {name && <div className="text-plum-soft">{name}</div>}
                  </td>
                )}
                <td className={cell}>{r.note ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
