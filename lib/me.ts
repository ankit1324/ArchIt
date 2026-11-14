import "server-only";
import { db } from "./db";
import { toAiPhotoItem, type AiPhotoItem, type AiPhotoRow } from "./ai-photos";

/**
 * The signed-in user's own stuff for the dashboard: their listings (every
 * moderation status), how many designs they've saved, and their newest AI
 * photo requests.
 *
 * Every query is scoped with .eq("user_id", userId), where userId comes from
 * the Clerk session in the caller — never from a request body or URL — so this
 * only ever returns the caller's own rows. user_id itself is not selected.
 */

/** Most rows the dashboard lists; listingsTotal still reports the full count. */
export const MY_LISTINGS_LIMIT = 50;

/** Newest AI photo requests the dashboard shows; the builder dialog has the rest. */
export const MY_AI_PHOTOS_LIMIT = 6;
// Never prompt, input_path or user_id. result_path is read only so
// toAiPhotoItem can tell a finished photo from a broken one; it drops the path.
const AI_PHOTO_COLUMNS = "id, status, design_name, created_at, completed_at, admin_note, result_path";
type AiPhotoListRow = Pick<
  AiPhotoRow,
  "id" | "status" | "design_name" | "created_at" | "completed_at" | "admin_note" | "result_path"
>;

export interface MyListing {
  id: string;
  buildingName: string | null;
  address: string;
  city: string;
  price: number;
  type: string;
  /** pending | live | rejected (lib/moderation.ts) */
  status: string;
  /** admin's note from the last review; the UI shows it only when rejected */
  reviewNote: string | null;
  createdAt: string | null;
}

export interface MeSummary {
  listings: MyListing[];
  /** total listings owned; may exceed listings.length (MY_LISTINGS_LIMIT) */
  listingsTotal: number;
  designsTotal: number;
  /** newest first, at most MY_AI_PHOTOS_LIMIT */
  aiPhotos: AiPhotoItem[];
  /** a query failed: the UI says so instead of claiming "none yet" */
  error: boolean;
  listingsError: boolean;
  designsError: boolean;
  aiPhotosError: boolean;
}

interface Row {
  id: string;
  building_name: string | null;
  address: string | null;
  city: string | null;
  price: number | string | null;
  type: string | null;
  status: string | null;
  review_note: string | null;
  created_at: string | null;
}

const EMPTY: MeSummary = {
  listings: [],
  listingsTotal: 0,
  designsTotal: 0,
  aiPhotos: [],
  error: false,
  listingsError: false,
  designsError: false,
  aiPhotosError: false,
};

export async function getMySummary(userId: string | null | undefined): Promise<MeSummary> {
  if (!userId) return EMPTY;
  try {
    const [listingsRes, designsRes, aiPhotosRes] = await Promise.all([
      db
        .from("properties")
        .select("id, building_name, address, city, price, type, status, review_note, created_at", {
          count: "exact",
        })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MY_LISTINGS_LIMIT)
        .returns<Row[]>(),
      db.from("designs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      db
        .from("ai_photo_requests")
        .select(AI_PHOTO_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MY_AI_PHOTOS_LIMIT)
        .returns<AiPhotoListRow[]>(),
    ]);
    if (listingsRes.error) console.error("dashboard: my listings failed:", listingsRes.error.message);
    if (designsRes.error) console.error("dashboard: my designs failed:", designsRes.error.message);
    if (aiPhotosRes.error) console.error("dashboard: my AI photos failed:", aiPhotosRes.error.message);

    const rows = listingsRes.data ?? [];
    return {
      listings: rows.map((r) => ({
        id: r.id,
        buildingName: r.building_name,
        address: r.address ?? "",
        city: r.city ?? "",
        price: Number(r.price ?? 0),
        type: r.type ?? "sale",
        status: r.status ?? "pending",
        reviewNote: r.review_note,
        createdAt: r.created_at,
      })),
      listingsTotal: listingsRes.count ?? rows.length,
      designsTotal: designsRes.count ?? 0,
      aiPhotos: (aiPhotosRes.data ?? []).map(toAiPhotoItem),
      error: !!(listingsRes.error || designsRes.error || aiPhotosRes.error),
      listingsError: !!listingsRes.error,
      designsError: !!designsRes.error,
      aiPhotosError: !!aiPhotosRes.error,
    };
  } catch (e) {
    // missing env / network failure: the rest of the dashboard still renders
    console.error("dashboard: getMySummary failed:", (e as Error).message);
    return { ...EMPTY, error: true, listingsError: true, designsError: true, aiPhotosError: true };
  }
}
