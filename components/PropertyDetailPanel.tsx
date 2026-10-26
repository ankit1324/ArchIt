"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Listing, ListingView } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";
import { feeLabel } from "@/lib/fees";
import { MAX_REPORT_DETAILS, REPORT_REASONS, type ReportReason } from "@/lib/moderation";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { contactLinks } from "@/lib/contact-links";
import { safeImageUrl, thumbnailUrl } from "@/lib/url";
import { CloseIcon } from "./icons";

interface PropertyDetailPanelProps {
  listing: Listing;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
  /** opens the attached published design in the read-only 3D viewer */
  onOpen3D?: (designId: string) => void;
}

// Gated detail responses (`owner`, `hasOwner`, `mine`) per listing id, so
// re-opening a card doesn't refetch. The response depends on the viewer, so
// the cache is dropped whenever the signed-in user changes.
const detailCache = new Map<string, Listing>();
let detailCacheUser: string | null | undefined;

/** Forget the cached detail for a listing (after unlock / edit / delete). */
export function invalidateListing(id: string) {
  detailCache.delete(id);
}

function cachedDetail(id: string, userId: string | null | undefined): Listing | undefined {
  if (detailCacheUser !== userId) {
    detailCache.clear();
    detailCacheUser = userId;
  }
  return detailCache.get(id);
}

/**
 * The API answers with terse machine strings ("unauthorized", "not found");
 * say what happened and what to do instead.
 */
function reportErrorMessage(status: number, serverMsg: string | null): string {
  if (status === 401) return "Your session has expired. Sign in again to report this listing.";
  if (status === 404) return "This listing is no longer on the map, so it can’t be reported.";
  if (status === 429) return "You’ve sent several reports recently. Please try again later.";
  if (status === 400 && /own listing/i.test(serverMsg ?? "")) {
    return "You can’t report your own listing.";
  }
  if (status === 400 && /details/i.test(serverMsg ?? "")) {
    return "Please add a few words about what’s wrong.";
  }
  return "Could not send the report. Please try again.";
}

/**
 * "Report listing": a reason + optional details, POSTed to /api/reports for
 * the admin queue. Collapsed to a quiet text button until opened.
 * Exported for UI checks; the panel renders it for signed-in non-listers.
 */
export function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("fraud");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // a different listing starts closed and clean (adjust-state-during-render)
  const [prevId, setPrevId] = useState(listingId);
  if (prevId !== listingId) {
    setPrevId(listingId);
    setOpen(false);
    setDetails("");
    setState("idle");
    setError(null);
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-center text-[12px] font-semibold text-plum-soft">
        Thanks — we&rsquo;ll review this listing.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-[12px] font-semibold text-plum-soft underline-offset-2 hover:text-plum hover:underline"
      >
        Report listing
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: listingId, reason, details: details.trim() || null }),
      });
      if (res.ok || res.status === 409) {
        // 409 = already reported by this user; same outcome from their side
        setState("sent");
        return;
      }
      const msg = await res
        .json()
        .then((j: { error?: string }) => j.error)
        .catch(() => null);
      setError(reportErrorMessage(res.status, msg ?? null));
      setState("idle");
    } catch {
      setError("Could not send the report. Please try again.");
      setState("idle");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl bg-white/55 p-3">
      <label className="text-[11px] font-bold uppercase tracking-wide text-plum-soft">
        What&rsquo;s wrong?
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className="mt-1 w-full rounded-xl bg-white px-2 py-1.5 text-[13px] font-semibold normal-case tracking-normal text-plum"
        >
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
            <option key={r} value={r}>
              {REPORT_REASONS[r]}
            </option>
          ))}
        </select>
      </label>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={MAX_REPORT_DETAILS}
        rows={3}
        required={reason === "other"}
        placeholder={reason === "other" ? "Tell us what's wrong" : "Details (optional)"}
        aria-label="Report details"
        className="rounded-xl bg-white px-2 py-1.5 text-[13px] text-plum"
      />
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-coral">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full bg-plum/10 py-2 text-[12px] font-bold text-plum"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex-1 rounded-full bg-coral py-2 text-[12px] font-bold text-white disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}

/**
 * The owner contact (shown to signed-in viewers while the paywall is off) as
 * tappable Call / WhatsApp / Email buttons; the raw text stays visible too,
 * since it often carries a name or a second number.
 */
function OwnerContact({ listing }: { listing: Listing }) {
  const contact = listing.owner ?? "";
  const name = listing.buildingName || listing.address;
  const links = contactLinks(contact, `Hi, I saw your listing “${name}” on ArchIt.`);
  return (
    <div className="rounded-2xl bg-white/55 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-plum-soft">
        Owner contact
      </div>
      <div className="break-words text-[13px] font-bold text-plum">{contact}</div>
      {links.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {links.map((l) => (
            <a
              key={l.kind}
              href={l.href}
              // wa.me opens WhatsApp (app or web) in a new tab; tel:/mailto:
              // hand off to the OS and must not leave a blank tab behind
              {...(l.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={`${l.label} ${l.display}`}
              className={`flex-1 rounded-full py-2 text-center text-[12px] font-bold transition-opacity hover:opacity-90 ${
                l.kind === "call"
                  ? "bg-plum text-cream"
                  : l.kind === "whatsapp"
                    ? "bg-[#1f7a4d] text-white"
                    : "bg-plum/10 text-plum"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/55 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-plum-soft">
        {label}
      </div>
      <div className="truncate text-[13px] font-bold text-plum">{value}</div>
    </div>
  );
}

export default function PropertyDetailPanel({
  listing: propListing,
  onClose,
  onEdit,
  onDelete,
  deleting = false,
  onOpen3D,
}: PropertyDetailPanelProps) {
  // only the lister manages a property; the server tells us via `mine`
  // (the raw lister id is never sent to the client)
  const { userId } = useAuth();
  // reset fetched detail state per listing (adjust-state-during-render —
  // avoids a setState-in-effect cascade); a cached detail wins immediately
  const [listing, setListing] = useState(
    () => cachedDetail(propListing.id, userId) ?? propListing,
  );
  const [prevId, setPrevId] = useState(propListing.id);
  // Photos or the attached 3D design: the lister's choice opens first
  const [view, setView] = useState<ListingView>(propListing.defaultView ?? "photos");
  if (prevId !== propListing.id) {
    setPrevId(propListing.id);
    setListing(cachedDetail(propListing.id, userId) ?? propListing);
    setView(propListing.defaultView ?? "photos");
  }
  const sale = listing.type === "sale";
  const showcase = listing.type === "showcase";
  // the lister also gets designId for an unpublished design, which visitors
  // (and the viewer route) can't open — the 3D tab shows only while published
  const designId =
    listing.designId && listing.designPublished !== false ? listing.designId : null;
  const designSnapshot = safeImageUrl(listing.designSnapshot);
  const canManage = !!listing.mine;
  // bumped to force a refetch (after a paid unlock, which is what makes the
  // server start returning `owner`)
  const [detailVersion, setDetailVersion] = useState(0);
  const [unlocking, setUnlocking] = useState(false);

  // The public list drops the paywalled `owner` field. The gated detail route
  // returns it iff the viewer is the lister or has paid (and `hasOwner` either
  // way), so one fetch covers both the "mine" and "unlocked" cases — no
  // separate purchases lookup needed.
  useEffect(() => {
    if (!userId) return;
    if (cachedDetail(propListing.id, userId)) return;
    const controller = new AbortController();
    fetch(`/api/properties/${propListing.id}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Listing | null) => {
        if (controller.signal.aborted || !d) return;
        detailCache.set(propListing.id, d);
        setListing(d);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [propListing.id, userId, detailVersion]);

  const unlockOwner = async () => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      if (await payFee("contact_owner", "Contact owner fee", listing.id)) {
        // the server flips the gate; refetch so `owner` lands in the panel
        invalidateListing(listing.id);
        setDetailVersion((v) => v + 1);
        celebrate("Owner contact unlocked!");
      }
    } finally {
      setUnlocking(false);
    }
  };
  // Offer the unlock to a signed-in viewer who is not the lister, once the
  // detail fetch has confirmed there is a contact to buy. The lister (or a
  // past buyer) already has `owner` in hand.
  const thumb = thumbnailUrl(listing.photo, 480);
  const photo = thumb ?? safeImageUrl(listing.photo);
  // never while the paywall is off: there is nothing to buy (the server
  // returns `owner` to every signed-in viewer)
  const showUnlock =
    PAYWALL_ENABLED && !!userId && !canManage && !listing.owner && listing.hasOwner === true;
  return (
    <section className="glass no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-2.5 overflow-y-auto rounded-3xl p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold leading-snug text-plum">
            {listing.buildingName || listing.address}
          </h3>
          <p className="text-[12px] font-medium text-plum-soft">
            {listing.buildingName ? `${listing.address}, ` : ""}
            {listing.city}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close property details"
          className="shrink-0 rounded-full p-1 text-plum-soft transition-colors hover:bg-plum/5 hover:text-plum"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      {designId && (
        <div role="tablist" aria-label="Listing view" className="grid grid-cols-2 gap-1 rounded-full bg-plum/5 p-1">
          {(["photos", "3d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                view === v ? "bg-plum text-cream" : "text-plum hover:bg-white/70"
              }`}
            >
              {v === "photos" ? "Photos" : "3D design"}
            </button>
          ))}
        </div>
      )}

      {canManage && listing.designId && listing.designPublished === false && (
        <p className="rounded-2xl bg-coral/10 px-3 py-2 text-[11.5px] font-semibold text-plum">
          The attached 3D design is unpublished, so visitors don&rsquo;t see it. Publish it in the
          Designer to show it again.
        </p>
      )}

      {designId && view === "3d" ? (
        <div className="flex flex-col gap-2">
          <div className="relative grid h-[140px] place-items-center overflow-hidden rounded-2xl bg-white/55 ring-2 ring-violet-500">
            {designSnapshot ? (
              <Image
                src={designSnapshot}
                alt={`3D design of ${listing.buildingName || listing.address}`}
                fill
                sizes="268px"
                className="object-cover"
              />
            ) : (
              <span className="text-[13px] font-bold text-violet-700">3D</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpen3D?.(designId)}
            className="rounded-full bg-violet-600 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Open 3D
          </button>
        </div>
      ) : photo ? (
        <div className="relative h-[140px] overflow-hidden rounded-2xl">
          <Image
            src={photo}
            unoptimized={!!thumb}
            alt={listing.address}
            fill
            sizes="268px"
            className="object-cover"
          />
        </div>
      ) : designId ? (
        <p className="rounded-2xl bg-white/55 px-3 py-6 text-center text-[12px] font-medium text-plum-soft">
          No photos yet
        </p>
      ) : null}

      {canManage && listing.status && (
        <p
          role="status"
          className={`rounded-2xl px-3 py-2 text-[12px] font-semibold ${
            listing.status === "pending" ? "bg-lime/60 text-plum" : "bg-coral/15 text-plum"
          }`}
        >
          {listing.status === "pending"
            ? "Pending review — only you can see this listing until it\u2019s approved."
            : "Not approved — hidden from the map. Edit the listing to send it back for review."}
        </p>
      )}

      {showcase ? (
        <div className="flex items-center gap-2">
          <span className="bg-violet-600 px-1.5 py-0.5 text-[14px] font-extrabold text-white">
            Showcase · not for sale/rent
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 text-[16px] font-extrabold ${
              sale ? "bg-lime text-plum" : "bg-magenta text-white"
            }`}
          >
            {formatPrice(listing)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              sale ? "bg-lime text-plum" : "bg-magenta text-white"
            }`}
          >
            {sale ? "For Sale" : "For Rent"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Fact label="Type" value={listing.kind} />
        <Fact label="Beds" value={String(listing.beds)} />
        <Fact label="Baths" value={String(listing.baths)} />
        <Fact label="Floors" value={String(listing.floors)} />
        <Fact label="Sqft" value={listing.sqft.toLocaleString()} />
        <Fact label="Area" value={`${listing.areaM} m²`} />
        <Fact
          label="Location"
          value={`${listing.coords[1].toFixed(4)}, ${listing.coords[0].toFixed(4)}`}
        />
      </div>

      {listing.owner && <OwnerContact listing={listing} />}

      {/* a listing that isn't live has no public page yet */}
      {!listing.status && (
        <a
          href={`/property/${listing.id}`}
          target="_blank"
          rel="noopener"
          className="text-center text-[12px] font-semibold text-plum-soft underline underline-offset-4 hover:text-plum"
        >
          Open shareable listing page ↗
        </a>
      )}

      {showUnlock && (
        <button
          onClick={unlockOwner}
          disabled={unlocking}
          className="rounded-full bg-magenta py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {unlocking
            ? "Opening payment…"
            : `Contact owner · ${feeLabel("contact_owner")}`}
        </button>
      )}

      {canManage && (
      <div className="mt-1 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex-1 rounded-full bg-coral py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      )}

      {!!userId && !canManage && <ReportListing listingId={listing.id} />}
    </section>
  );
}
