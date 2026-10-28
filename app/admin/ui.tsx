import Link from "next/link";

// Shared server-rendered pieces for the /admin pages, in the planner language:
// hairline tables on paper, eyebrow labels, tabular numbers.

export const focus =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** Inline text link: underlined, ≥24px hit area (WCAG 2.5.8). */
export const link = `inline-flex min-h-6 items-center rounded-[3px] underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent ${focus}`;
export const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
/** Outlined card on paper. */
export const card = "rounded-md border border-line bg-paper-soft p-4";
export const input = `w-full rounded-[5px] border border-line-strong bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-soft ${focus}`;
export const button = `inline-flex min-h-11 items-center justify-center rounded-[5px] px-5 py-3 text-[13px] font-semibold transition-colors disabled:opacity-50 ${focus}`;

export const tableWrap = "overflow-x-auto rounded-md border border-line";
export const table = "w-full border-collapse text-[13px] text-ink";
export const row = "border-t border-line transition-colors hover:bg-paper-soft/70";
export const cell = "px-3 py-2.5 align-top";
export const head = `whitespace-nowrap border-b border-line bg-paper-soft px-3 py-2.5 text-left ${eyebrow}`;
/** Amount / count columns: right-aligned so digits line up. */
export const num = "text-right tabular-nums whitespace-nowrap";

export const when = (iso: string | number | null | undefined) =>
  iso == null
    ? "—"
    : new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Each admin page's one h1, with an eyebrow above and optional actions. */
export function PageHeader({
  title,
  label = "Admin",
  children,
  action,
}: {
  title: React.ReactNode;
  label?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`flex items-center gap-2.5 ${eyebrow}`}>
          <span className="size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
          {label}
        </p>
        <h1 className="mt-3 break-words font-display text-[clamp(28px,4vw,40px)] font-normal leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        {children}
      </div>
      {action}
    </div>
  );
}

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
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-display text-[24px] font-normal tracking-[-0.02em]">
          {title}
          {count !== undefined && (
            <span className="ml-2 font-sans text-[14px] font-semibold tabular-nums text-ink-soft">
              {count.toLocaleString("en-IN")}
            </span>
          )}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-line-strong p-4 text-[14px] text-ink-soft">
      {children}
    </p>
  );
}

export function LoadError({ errors }: { errors: (string | null | undefined)[] }) {
  const list = errors.filter(Boolean);
  if (!list.length) return null;
  return (
    <p
      role="alert"
      className="mb-6 rounded-md border border-accent/50 bg-accent/5 p-3 text-[14px] font-semibold text-accent-deep"
    >
      Some data failed to load ({list.join("; ")}). Has the latest migration been applied?
    </p>
  );
}

// Token fills only. Ink on highlight is 9.4:1, accent on paper 5.1:1.
const STATUS_TONE: Record<string, string> = {
  live: "border-highlight-deep bg-highlight text-ink",
  open: "border-highlight-deep bg-highlight text-ink",
  pending: "border-clay bg-clay/30 text-ink",
  rejected: "border-accent/60 text-accent-deep",
  banned: "border-accent/60 text-accent-deep",
  admin: "border-forest bg-forest text-paper",
};

export function Badge({ label }: { label: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 align-middle font-sans text-[11px] font-bold uppercase tracking-[0.08em] ${STATUS_TONE[label] ?? "border-line-strong text-ink-soft"}`}
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
    <nav aria-label="Pages" className="mt-5 flex items-center gap-5 text-[14px] font-semibold">
      {page > 1 ? <Link href={href(page - 1)} className={link}>← Previous</Link> : <span />}
      <span className="tabular-nums text-ink-soft">Page {page}</span>
      {hasNext && <Link href={href(page + 1)} className={link}>Next →</Link>}
    </nav>
  );
}

export function UserLink({ id }: { id: string | null | undefined }) {
  if (!id) return <span className="text-ink-soft">unknown</span>;
  return (
    <Link href={`/admin/users/${id}`} className={`${link} break-all font-mono text-[12px]`}>
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
  // design unpublishes: the showcase page, live again if the author republishes
  if (t.target_type === "design") return `/showcase/${encodeURIComponent(t.target_id)}`;
  return null;
}

/** Table of audit entries; `showTarget` off on a single record's page. */
export function AuditTable({ rows, showTarget = true }: { rows: AuditRow[]; showTarget?: boolean }) {
  if (!rows.length) return <Empty>No admin actions recorded yet.</Empty>;
  return (
    <div className={tableWrap}>
      <table className={table}>
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
            // design entries carry the author (app/api/admin/designs/[id]/route.ts)
            const authorId =
              r.target_type === "design" && typeof r.details?.authorId === "string"
                ? r.details.authorId
                : null;
            return (
              <tr key={r.id} className={row}>
                <td className={`${cell} whitespace-nowrap tabular-nums`}>{when(r.created_at)}</td>
                <td className={cell}><UserLink id={r.admin_id} /></td>
                <td className={cell}><span className="font-semibold">{r.action}</span></td>
                {showTarget && (
                  <td className={cell}>
                    <span className={`mr-1.5 ${eyebrow}`}>{r.target_type}</span>
                    {href ? (
                      <Link href={href} className={`${link} break-all font-mono text-[12px]`}>{r.target_id}</Link>
                    ) : (
                      <code className="break-all text-[12px]">{r.target_id}</code>
                    )}
                    {name && <div className="text-ink-soft">{name}</div>}
                    {authorId && (
                      <div className="text-ink-soft">
                        by <UserLink id={authorId} />
                      </div>
                    )}
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
