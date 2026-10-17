import assert from "node:assert/strict";
import test from "node:test";
import { presentListing, validateListingWrite } from "../lib/listing-presentation.ts";

const sale = { type: "sale", price: 5000000 };
const ownedPublished = { owned: true, published: true };

test("absent designId keeps the stored design even when it is unpublished", () => {
  const r = validateListingWrite(sale, "d1", null);
  assert.deepEqual(r, { ok: true, price: 5000000, designId: "d1", defaultView: "photos" });
});

test("re-sending the stored id is allowed without any checks", () => {
  const r = validateListingWrite({ ...sale, designId: "d1" }, "d1", { owned: true, published: false });
  assert.equal(r.ok, true);
  assert.equal(r.designId, "d1");
  assert.equal(validateListingWrite({ ...sale, designId: "d1" }, "d1", null).ok, true);
});

test("a newly attached design must be owned and published", () => {
  const notOwned = validateListingWrite({ ...sale, designId: "d2" }, "d1", { owned: false, published: true });
  assert.equal(notOwned.ok, false);
  assert.equal(notOwned.status, 400);
  const unpublished = validateListingWrite({ ...sale, designId: "d2" }, null, { owned: true, published: false });
  assert.equal(unpublished.ok, false);
  assert.equal(unpublished.status, 400);
  assert.equal(validateListingWrite({ ...sale, designId: "d2" }, null, null).ok, false);
  const ok = validateListingWrite({ ...sale, designId: "d2" }, "d1", ownedPublished);
  assert.equal(ok.ok, true);
  assert.equal(ok.designId, "d2");
});

test("null designId detaches", () => {
  const r = validateListingWrite({ ...sale, designId: null }, "d1", null);
  assert.equal(r.ok, true);
  assert.equal(r.designId, null);
});

test("showcase listings are stored at price 0; others need a positive price", () => {
  const r = validateListingWrite({ type: "showcase", price: 5000 }, null, null);
  assert.equal(r.ok, true);
  assert.equal(r.price, 0);
  for (const price of [0, -1, Number.NaN]) {
    const bad = validateListingWrite({ type: "sale", price }, null, null);
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 400);
  }
  assert.equal(validateListingWrite({ type: "rent", price: 18000 }, null, null).price, 18000);
});

test("defaultView defaults to photos and must be a known view", () => {
  assert.equal(validateListingWrite({ ...sale, defaultView: "3d" }, null, null).defaultView, "3d");
  const bad = validateListingWrite({ ...sale, defaultView: "video" }, null, null);
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 400);
});

const listing = { id: "l1", address: "Sector 8", city: "Chandigarh", price: 0, type: "showcase", coords: [76.7, 30.7] };
const row = { design_id: "d1", default_view: "3d" };
const snap = "https://tdbnwismmyllpufurqus.supabase.co/storage/v1/object/public/d1.png";

test("visitors see the design only while it is published", () => {
  const pub = presentListing(listing, row, { published: true, snapshot: snap }, false);
  assert.equal(pub.designId, "d1");
  assert.equal(pub.designSnapshot, snap);
  assert.equal(pub.defaultView, "3d");
  assert.ok(!("designPublished" in pub));

  const priv = presentListing(listing, row, { published: false, snapshot: snap }, false);
  assert.ok(!("designId" in priv));
  assert.ok(!("designSnapshot" in priv));
  assert.equal(priv.defaultView, "photos");

  const missing = presentListing(listing, row, undefined, false);
  assert.ok(!("designId" in missing));
  assert.equal(missing.defaultView, "photos");
});

test("owner always sees the attachment and whether it is published", () => {
  const mine = presentListing(listing, row, { published: false, snapshot: snap }, true);
  assert.equal(mine.designId, "d1");
  assert.equal(mine.defaultView, "3d");
  assert.equal(mine.designPublished, false);
  assert.ok(!("designSnapshot" in mine));
  assert.equal(presentListing(listing, row, { published: true, snapshot: snap }, true).designPublished, true);
});

test("snapshot goes through safeImageUrl", () => {
  const p = presentListing(listing, row, { published: true, snapshot: "javascript:alert(1)" }, false);
  assert.equal(p.designId, "d1");
  assert.ok(!("designSnapshot" in p));
});

test("no attached design: visitors get photos, owner keeps the stored view", () => {
  const noDesign = { design_id: null, default_view: "3d" };
  const visitor = presentListing(listing, noDesign, undefined, false);
  assert.ok(!("designId" in visitor));
  assert.equal(visitor.defaultView, "photos");
  const owner = presentListing(listing, noDesign, undefined, true);
  assert.ok(!("designId" in owner));
  assert.equal(owner.defaultView, "3d");
  assert.equal(owner.designPublished, false);
});

test("presentListing does not mutate its input", () => {
  const input = { ...listing };
  presentListing(input, row, { published: true, snapshot: snap }, true);
  assert.deepEqual(input, listing);
});
