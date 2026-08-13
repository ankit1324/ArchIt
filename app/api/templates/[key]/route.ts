import { auth } from "@clerk/nextjs/server";
import { hasPurchase } from "@/lib/entitlements";
import { isPaidTemplate, TEMPLATE_KEYS } from "@/lib/template-catalog";
import { getTemplateGeometry } from "@/lib/template-geometry";

/**
 * GET /api/templates/[key] → the room geometry for one paid template.
 *
 * This is the paywall. The geometry for paid templates exists only on the server
 * (lib/template-geometry.ts), so an unpaid client cannot obtain it by reading the
 * bundle or builder.html — unlike the free templates, which stay inline.
 *
 * Free templates are not served here at all: builder.html already has them.
 *
 * Payload: whatever lib/template-geometry.ts holds for the key, passed through
 * untouched — `{v:2, profile, rooms:[RoomSpecV2]}` for every migrated template, or
 * the legacy `{profile, rooms:[[type,cx,cz,opts]]}` shape for one that has not been
 * migrated yet. The reader accepts both (plans/02-template-v2-contract.md §3), so
 * the version lives in the data and this route stays version-agnostic.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  if (!TEMPLATE_KEYS.has(key)) {
    return Response.json({ error: "unknown template" }, { status: 404 });
  }
  if (!isPaidTemplate(key)) {
    // Free geometry ships in builder.html; nothing to hand out (and nothing to
    // charge for). Explicit 400 beats implying the client should have got data.
    return Response.json(
      { error: "template is free — geometry is bundled in the builder" },
      { status: 400 },
    );
  }

  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const entitlement = await hasPurchase(userId, "template_unlock", key);
  if (!entitlement.ok) {
    return Response.json({ error: entitlement.error }, { status: 500 });
  }
  if (!entitlement.granted) {
    return Response.json(
      { error: "template locked", purpose: "template_unlock", ref: key },
      { status: 402 },
    );
  }

  const geometry = getTemplateGeometry(key);
  if (!geometry) {
    // Catalog and geometry are generated together, so this means they drifted.
    console.error(`Template ${key} is in the catalog but has no geometry`);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  return Response.json(geometry);
}
