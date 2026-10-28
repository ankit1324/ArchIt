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

const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primaryBtn = `${focusRing} min-h-11 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep disabled:opacity-50`;
const secondaryBtn = `${focusRing} min-h-11 rounded-[5px] border border-line-strong bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50`;
const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const inset = "rounded-[5px] border border-line bg-paper-soft";

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
      <p role="status" className="text-center text-[14px] font-semibold text-ink-soft">
        Thanks — we&rsquo;ll review this listing.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${focusRing} inline-flex min-h-6 items-center self-center rounded-[3px] text-[13px] font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline`}
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
    <form onSubmit={submit} className={`${inset} flex flex-col gap-2 p-3`}>
      <label className={eyebrow}>
        What&rsquo;s wrong?
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className={`${focusRing} mt-1 w-full rounded-[5px] border border-line-strong bg-paper px-2 py-2 text-[14px] font-semibold normal-case tracking-normal text-ink`}
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
        className={`${focusRing} rounded-[5px] border border-line-strong bg-paper px-2 py-1.5 text-[14px] text-ink placeholder:text-ink-soft`}
      />
      {error && (
        <p role="alert" className="text-[14px] font-semibold text-accent">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${secondaryBtn} flex-1`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === "sending"}
          className={`${primaryBtn} flex-1 px-3`}
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
    <div className={`${inset} px-3 py-2`}>
      <div className={eyebrow}>Owner contact</div>
      <div className="break-words text-[14px] font-semibold text-ink">{contact}</div>
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
              className={`${focusRing} flex min-h-11 flex-1 items-center justify-center rounded-[5px] px-2 text-center text-[13px] font-semibold transition-colors ${
                l.kind === "call"
                  ? "bg-forest text-paper hover:bg-ink"
                  : l.kind === "whatsapp"
                    ? // WhatsApp's own green: users look for it; paper on it is 4.9:1
                      "bg-[#1f7a4d] text-paper hover:bg-[#19633f]"
                    : "border border-line-strong bg-paper text-ink hover:border-ink"
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

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 bg-paper-soft px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <div className={eyebrow}>{label}</div>
      <div className="truncate text-[14px] font-semibold tabular-nums text-ink">{value}</div>
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
    <section className="no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-3 overflow-y-auto rounded-md border border-line bg-paper/95 p-4 text-ink shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] backdrop-blur">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[20px] font-normal leading-tight tracking-[-0.02em] text-ink">
            {listing.buildingName || listing.address}
          </h3>
          <p className="mt-0.5 text-[14px] text-ink-soft">
            {listing.buildingName ? `${listing.address}, ` : ""}
            {listing.city}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close property details"
          className={`${focusRing} grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink`}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      {designId && (
        <div role="tablist" aria-label="Listing view" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-paper-soft p-1">
          {(["photos", "3d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`${focusRing} min-h-9 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                view === v ? "bg-ink text-paper" : "text-ink hover:bg-paper"
              }`}
            >
              {v === "photos" ? "Photos" : "3D design"}
            </button>
          ))}
        </div>
      )}

      {canManage && listing.designId && listing.designPublished === false && (
        <p className="rounded-[5px] border border-accent/30 bg-accent/10 px-3 py-2 text-[14px] leading-snug text-ink">
          The attached 3D design is unpublished, so visitors don&rsquo;t see it. Publish it in the
          Designer to show it again.
        </p>
      )}

      {designId && view === "3d" ? (
        <div className="flex flex-col gap-2">
          <div className={`${inset} relative grid h-[140px] place-items-center overflow-hidden`}>
            {designSnapshot ? (
              <Image
                src={designSnapshot}
                alt={`3D design of ${listing.buildingName || listing.address}`}
                fill
                sizes="268px"
                className="object-cover"
              />
            ) : (
              <span className="font-display text-[20px] text-ink-soft">3D</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpen3D?.(designId)}
            className={`${focusRing} min-h-11 rounded-[5px] bg-forest px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-ink`}
          >
            Open 3D <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : photo ? (
        <div className="relative h-[140px] overflow-hidden rounded-[5px] border border-line">
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
        <p className={`${inset} px-3 py-6 text-center text-[14px] text-ink-soft`}>
          No photos yet
        </p>
      ) : null}

      {canManage && listing.status && (
        <p
          role="status"
          className={`rounded-[5px] border px-3 py-2 text-[14px] leading-snug text-ink ${
            listing.status === "pending"
              ? "border-highlight-deep bg-highlight"
              : "border-accent/30 bg-accent/10"
          }`}
        >
          {listing.status === "pending"
            ? "Pending review — only you can see this listing until it\u2019s approved."
            : "Not approved — hidden from the map. Edit the listing to send it back for review."}
        </p>
      )}

      {/* category fills match the map prisms and PropertyCard: sale is
          highlight, rent is clay, showcase is mist, all with ink text */}
      {showcase ? (
        <div className="flex items-center gap-2">
          <span className="rounded-[3px] bg-mist px-1.5 py-0.5 text-[14px] font-bold text-ink">
            Showcase · not for sale/rent
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className={`rounded-[3px] px-1.5 py-0.5 text-[18px] font-bold tabular-nums text-ink ${
              sale ? "bg-highlight" : "bg-clay"
            }`}
          >
            {formatPrice(listing)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-ink ${
              sale ? "bg-highlight" : "bg-clay"
            }`}
          >
            {sale ? "For Sale" : "For Rent"}
          </span>
        </div>
      )}

      {/* a spec sheet: hairlines between cells come from the 1px gap */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[5px] border border-line bg-line">
        <Fact label="Type" value={listing.kind} />
        <Fact label="Beds" value={String(listing.beds)} />
        <Fact label="Baths" value={String(listing.baths)} />
        <Fact label="Floors" value={String(listing.floors)} />
        <Fact label="Sqft" value={listing.sqft.toLocaleString()} />
        <Fact label="Area" value={`${listing.areaM} m²`} />
        <Fact
          label="Location"
          value={`${listing.coords[1].toFixed(4)}, ${listing.coords[0].toFixed(4)}`}
          wide
        />
      </div>

      {listing.owner && <OwnerContact listing={listing} />}

      {/* a listing that isn't live has no public page yet */}
      {!listing.status && (
        <a
          href={`/property/${listing.id}`}
          target="_blank"
          rel="noopener"
          className={`${focusRing} inline-flex min-h-6 items-center self-center rounded-[3px] text-[13px] font-semibold text-accent underline underline-offset-4 hover:text-accent-deep`}
        >
          Open shareable listing page ↗
        </a>
      )}

      {showUnlock && (
        <button
          onClick={unlockOwner}
          disabled={unlocking}
          className={primaryBtn}
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
          className={`${primaryBtn} flex-1`}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className={`${secondaryBtn} flex-1 text-accent hover:border-accent`}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      )}

      {!!userId && !canManage && <ReportListing listingId={listing.id} />}
    </section>
  );
}
