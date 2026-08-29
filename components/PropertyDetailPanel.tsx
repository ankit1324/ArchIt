"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/types";
// [PAYWALL DISABLED — free for now]
// import { payFee } from "@/lib/checkout";
// [PAYWALL DISABLED — free for now] celebrate was only used inside unlockOwner() below
// import { celebrate } from "@/components/Celebration";
// [PAYWALL DISABLED — free for now]
// import { feeLabel } from "@/lib/fees";
import { safeImageUrl } from "@/lib/url";
import { CloseIcon } from "./icons";

interface PropertyDetailPanelProps {
  listing: Listing;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
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
  // reset fetched detail state per listing (adjust-state-during-render —
  // avoids a setState-in-effect cascade)
  const [listing, setListingRaw] = useState(propListing);
  const setListing = setListingRaw;
  const [prevId, setPrevId] = useState(propListing.id);
  if (prevId !== propListing.id) {
    setPrevId(propListing.id);
    setListingRaw(propListing);
  }
  const sale = listing.type === "sale";
  // only the lister manages a property; the server tells us via `mine`
  // (the raw lister id is never sent to the client)
  const { userId } = useAuth();
  const canManage = !!listing.mine;
  // [PAYWALL DISABLED — free for now] owner contact is free, no unlock gate.
  // was: owner contact is paywalled; a paid unlock persists per listing in the
  // purchases ledger, so it survives reloads and sessions
  // const [unlockedId, setUnlockedId] = useState<string | null>(null);
  // const [unlocking, setUnlocking] = useState(false);
  // const ownerUnlocked = unlockedId === listing.id;

  /* [PAYWALL DISABLED — free for now]
  useEffect(() => {
    let stale = false;
    fetch(`/api/purchases?purpose=contact_owner&ref=${listing.id}`)
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((d: { unlocked?: boolean }) => {
        if (!stale && d.unlocked) setUnlockedId(listing.id);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [listing.id]);
  */

  // the public list drops the paywalled `owner` field — refetch the gated
  // detail route when the lister or a paying viewer opens this panel
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`/api/properties/${listing.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Listing | null) => {
        if (!stale && d) setListing(d);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
    // ponytail: refetches only on unlock change; a manual refresh button is
    // the upgrade when staleness matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id, userId]);

  /* [PAYWALL DISABLED — free for now]
  const unlockOwner = async () => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      if (await payFee("contact_owner", "Contact owner fee", listing.id)) {
        setUnlockedId(listing.id);
        celebrate("Owner contact unlocked!");
      }
    } finally {
      setUnlocking(false);
    }
  };
  */
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
        {/* [PAYWALL DISABLED — free for now] was: {listing.owner && ownerUnlocked && ( */}
        {listing.owner && (
          <Fact label="Owner" value={listing.owner} />
        )}
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

      {/* [PAYWALL DISABLED — free for now]
      {listing.owner && !ownerUnlocked && (
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
      */}

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
