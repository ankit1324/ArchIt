/**
 * Presentation rules for the dashboard's "My listings" / "My designs" /
 * "My AI photos" panel.
 * Pure (no imports, no env, no "server-only") so `node --test` can load it
 * directly — see tests/me.test.mjs. lib/me.ts does the I/O.
 *
 * The statuses mirror lib/moderation.ts LISTING_STATUSES ("pending" | "live" |
 * "rejected"); they're repeated as plain strings here to keep this file
 * import-free.
 */

export type ListingTone = "live" | "review" | "rejected";

export interface ListingStatusView {
  /** short badge text */
  label: string;
  /** drives the badge colour */
  tone: ListingTone;
  /** one sentence telling the lister what happens next */
  help: string;
  /** the admin's note, shown only when it explains a rejection */
  note: string | null;
  /** only live listings have a public /property/:id page */
  isPublic: boolean;
}

/**
 * status → badge + help text. Anything unrecognised (null from an old row, a
 * status added later) is shown as "In review": never claim a listing is public
 * unless the row says 'live'.
 */
export function listingStatusView(
  status: string | null | undefined,
  reviewNote?: string | null,
): ListingStatusView {
  if (status === "live") {
    return {
      label: "Live",
      tone: "live",
      help: "Approved and visible to everyone on the map.",
      note: null,
      isPublic: true,
    };
  }
  if (status === "rejected") {
    return {
      label: "Not approved",
      tone: "rejected",
      help: "Only you can see it. Edit it on the map to send it back for review.",
      note: reviewNote?.trim() || null,
      isPublic: false,
    };
  }
  // pending, or unknown. A stale review_note from an earlier rejection is not
  // shown: the lister already edited and resubmitted.
  return {
    label: "In review",
    tone: "review",
    help: "Only you can see it until an admin approves it.",
    note: null,
    isPublic: false,
  };
}

/** Deep link that opens the listing's panel on the map (/find?property=). */
export function listingMapHref(id: string): string {
  return `/find?property=${encodeURIComponent(id)}`;
}

/** Public, crawlable listing page — only meaningful once the listing is live. */
export function listingPublicHref(id: string): string {
  return `/property/${encodeURIComponent(id)}`;
}

/** "₹45,00,000" for sale, "₹25,000/mo" for rent (same format as lib/types formatPrice). */
export function listingPriceLabel(price: number, type: string): string {
  if (type === "showcase") return "Showcase";
  const n = `₹${(Number(price) || 0).toLocaleString("en-IN")}`;
  return type === "rent" ? `${n}/mo` : n;
}

/** Headline for a row: building name, else the street address. */
export function listingTitle(l: { buildingName?: string | null; address?: string | null }): string {
  return l.buildingName?.trim() || l.address?.trim() || "Untitled listing";
}

/** "2 live · 1 in review · 1 not approved", skipping zero counts. */
export function listingsSummary(statuses: ReadonlyArray<string | null | undefined>): string {
  const counts: Record<ListingTone, number> = { live: 0, review: 0, rejected: 0 };
  for (const s of statuses) counts[listingStatusView(s).tone]++;
  const parts: string[] = [];
  if (counts.live) parts.push(`${counts.live} live`);
  if (counts.review) parts.push(`${counts.review} in review`);
  if (counts.rejected) parts.push(`${counts.rejected} not approved`);
  return parts.join(" · ") || "No listings yet";
}

/** "No designs yet" / "1 saved design" / "3 saved designs". */
export function designsSummary(count: number): string {
  if (!(count > 0)) return "No designs yet";
  return `${count} saved design${count === 1 ? "" : "s"}`;
}

/** The fields of lib/ai-photos.ts AiPhotoItem this panel reads (kept structural: no imports). */
export interface AiPhotoLike {
  id: string;
  status: string;
  designName: string;
  note: string | null;
  image: string | null;
}

export interface AiPhotosView<T extends AiPhotoLike> {
  /** finished, with a picture to show */
  done: T[];
  /** still waiting for an admin */
  pending: number;
  /** "2 being made", or null when none are */
  pendingLabel: string | null;
  /** turned down; the note says why */
  rejected: T[];
}

/**
 * Split the user's newest requests for the "My AI photos" card. A "done" row
 * with no picture (lost result) is left out rather than shown as a broken image.
 */
export function aiPhotosView<T extends AiPhotoLike>(items: ReadonlyArray<T>): AiPhotosView<T> {
  const done = items.filter((p) => p.status === "done" && p.image);
  const pending = items.filter((p) => p.status === "pending").length;
  const rejected = items.filter((p) => p.status === "rejected");
  return { done, pending, pendingLabel: pending > 0 ? `${pending} being made` : null, rejected };
}

/** Alt text for a finished photo: names the design so a list of them is distinguishable. */
export function aiPhotoAlt(designName: string | null | undefined): string {
  const name = designName?.trim();
  return name ? `AI photo of ${name}` : "AI photo of your design";
}
