"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";
import { feeLabel } from "@/lib/fees";
import { safeImageUrl } from "@/lib/url";
import { CloseIcon } from "./icons";

interface PropertyDetailPanelProps {
  listing: Listing;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
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
  if (prevId !== propListing.id) {
    setPrevId(propListing.id);
    setListing(cachedDetail(propListing.id, userId) ?? propListing);
  }
  const sale = listing.type === "sale";
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
  const showUnlock =
    !!userId && !canManage && !listing.owner && listing.hasOwner === true;
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

      {safeImageUrl(listing.photo) && (
        <div className="relative h-[140px] overflow-hidden rounded-2xl">
          <Image
            src={safeImageUrl(listing.photo)!}
            alt={listing.address}
            fill
            sizes="268px"
            className="object-cover"
          />
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-1.5">
        {listing.owner && <Fact label="Owner" value={listing.owner} />}
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

      <a
        href={`/property/${listing.id}`}
        target="_blank"
        rel="noopener"
        className="text-center text-[12px] font-semibold text-plum-soft underline underline-offset-4 hover:text-plum"
      >
        Open shareable listing page ↗
      </a>

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
    </section>
  );
}
