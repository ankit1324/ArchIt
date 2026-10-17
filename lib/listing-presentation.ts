// Rules for a listing's intent (sale/rent/showcase) and its attached design.
// Pure: the routes do the lookups and pass the results in, so `node --test`
// can import this file directly (lib/url.ts is runtime-safe).
import type { Listing, ListingType, ListingView } from "./types";
import { safeImageUrl } from "./url.ts";

const VIEWS: readonly ListingView[] = ["photos", "3d"];

export type ListingWriteResult =
  | { ok: true; price: number; designId: string | null; defaultView: ListingView }
  | { ok: false; error: string; status: 400 };

/**
 * Validates the intent/design fields of a listing create or update.
 * `designId`: undefined = keep `storedDesignId`, null = detach, the stored id
 * = keep (no checks, so an edit never silently drops an attachment whose
 * design was since unpublished), any other id = attach, which needs
 * `newDesign` (the server's lookup of that id) to be owned and published.
 */
export function validateListingWrite(
  input: {
    type: ListingType;
    price: number;
    designId?: string | null;
    defaultView?: ListingView;
  },
  storedDesignId: string | null,
  newDesign: { owned: boolean; published: boolean } | null,
): ListingWriteResult {
  let price: number;
  if (input.type === "showcase") {
    price = 0;
  } else if (typeof input.price === "number" && Number.isFinite(input.price) && input.price > 0) {
    price = input.price;
  } else {
    return { ok: false, error: "Price must be greater than 0", status: 400 };
  }

  const defaultView = input.defaultView ?? "photos";
  if (!VIEWS.includes(defaultView)) {
    return { ok: false, error: "defaultView must be 'photos' or '3d'", status: 400 };
  }

  let designId: string | null;
  if (input.designId === undefined) {
    designId = storedDesignId;
  } else if (input.designId === null) {
    designId = null;
  } else if (input.designId === storedDesignId) {
    designId = storedDesignId;
  } else if (newDesign?.owned && newDesign.published) {
    designId = input.designId;
  } else {
    return { ok: false, error: "Attach one of your published designs", status: 400 };
  }

  return { ok: true, price, designId, defaultView };
}

/**
 * Adds the attached-design fields a viewer may see. Visitors get the design
 * (and the stored defaultView) only while it is published; the owner always
 * gets designId, the stored defaultView and whether the design is published.
 */
export function presentListing(
  listing: Listing,
  row: { design_id: string | null; default_view: ListingView },
  design: { published: boolean; snapshot: string | null } | undefined,
  mine: boolean,
): Listing {
  const out: Listing = { ...listing, defaultView: "photos" };
  // start clean so nothing design-related leaks through from the input
  delete out.designId;
  delete out.designSnapshot;
  delete out.designPublished;

  const designId = row.design_id;
  const published = !!designId && !!design?.published;
  if (designId && design?.published) {
    out.designId = designId;
    const snapshot = safeImageUrl(design.snapshot);
    if (snapshot) out.designSnapshot = snapshot;
    out.defaultView = row.default_view;
  }
  if (mine) {
    if (designId) out.designId = designId;
    out.defaultView = row.default_view;
    out.designPublished = published;
  }
  return out;
}
