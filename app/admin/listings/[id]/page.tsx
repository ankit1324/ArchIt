import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { auditHistory } from "@/lib/admin-audit";
import { db, type PropertyRow } from "@/lib/db";
import { REPORT_REASONS, isReportReason } from "@/lib/moderation";
import AdminAction from "../../AdminAction";
import { AuditTable, Badge, Empty, LoadError, Section, UserLink, when } from "../../ui";
import ListingEditForm from "./ListingEditForm";

export const metadata = { title: "Listing" };

type Row = PropertyRow & {
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

interface ReportRow {
  id: number;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

/** One listing: everything about it, editable, with its reports and history. */
export default async function AdminListing({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  const { id } = await params;

  const [{ data: l, error }, reports, history] = await Promise.all([
    db.from("properties").select("*").eq("id", id).maybeSingle<Row>(),
    db
      .from("listing_reports")
      .select("id, reporter_id, reason, details, status, created_at")
      .eq("property_id", id)
      .order("created_at", { ascending: false })
      .overrideTypes<ReportRow[], { merge: false }>(),
    auditHistory({ type: "listing", id }, 50),
  ]);
  if (!l && !error) notFound();

  return (
    <>
      <LoadError errors={[error?.message, reports.error?.message, history.error]} />
      {l && (
        <>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">
                {l.building_name || l.address} <Badge label={l.status} />
                {l.featured && <span className="ml-2 text-[13px]">★ featured</span>}
              </h1>
              <p className="mt-1 text-[13px] text-plum-soft">
                <code>{l.id}</code> · listed {when(l.created_at)} by <UserLink id={l.user_id} />
              </p>
              {l.reviewed_at && (
                <p className="mt-1 text-[13px] text-plum-soft">
                  Last reviewed {when(l.reviewed_at)} by <UserLink id={l.reviewed_by} />
                  {l.review_note ? ` — “${l.review_note}”` : ""}
                </p>
              )}
              {l.status === "live" && (
                <Link href={`/property/${l.id}`} className="mt-1 inline-block text-[13px] underline">
                  Open public page ↗
                </Link>
              )}
            </div>
            <AdminAction
              endpoint={`/api/admin/listings/${l.id}`}
              actions={[
                l.status === "live"
                  ? { action: "reject", label: "Hide", tone: "neutral", askNote: true }
                  : { action: "approve", label: l.status === "pending" ? "Approve" : "Unhide", tone: "primary" },
                {
                  action: "delete",
                  label: "Delete",
                  tone: "danger",
                  method: "DELETE",
                  confirm: "Permanently delete this listing and its photos? This can't be undone.",
                  askNote: true,
                  notePrompt: "Reason for deleting (kept in the audit log)",
                  redirectTo: "/admin/listings",
                },
              ]}
            />
          </div>

          <Section title="Details">
            <ListingEditForm
              id={l.id}
              initial={{
                buildingName: l.building_name ?? "",
                owner: l.owner ?? "",
                address: l.address,
                city: l.city ?? "",
                price: Number(l.price),
                type: l.type,
                kind: l.kind,
                beds: l.beds,
                baths: l.baths,
                sqft: l.sqft,
                rooms: l.rooms,
                areaM: l.area_m,
                floors: l.floors,
                lng: l.lng,
                lat: l.lat,
                photos: l.photos?.length ? l.photos : l.photo ? [l.photo] : [],
              }}
            />
          </Section>
        </>
      )}

      <Section title="Reports" count={reports.data?.length ?? 0}>
        {reports.data?.length ? (
          <ul className="grid gap-2">
            {reports.data.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white/70 p-3 text-[13px]">
                <strong>{isReportReason(r.reason) ? REPORT_REASONS[r.reason] : r.reason}</strong>{" "}
                <Badge label={r.status} />
                {r.details ? <div>{r.details}</div> : null}
                <div className="text-plum-soft">
                  {when(r.created_at)} by <UserLink id={r.reporter_id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No reports for this listing.</Empty>
        )}
      </Section>

      <Section title="Admin history">
        <AuditTable rows={history.entries} showTarget={false} />
      </Section>
    </>
  );
}
