import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS, countFilters, findListings } from "../lib/find.ts";

const listings = [
  { id: "large", buildingName: "Garden House", address: "Sector 8", city: "Chandigarh", type: "sale", kind: "house", price: 25000000, areaM: 400, rooms: 6, floors: 2 },
  { id: "small", address: "Sector 17", city: "Chandigarh", type: "rent", kind: "room", price: 3000, areaM: 20, rooms: 1, floors: 6 },
  { id: "featured", address: "Garden Road", city: "Mohali", type: "rent", kind: "apartments", price: 18000, areaM: 75, rooms: 3, floors: 12, featured: true },
];
const find = (patch = {}, query = "", sort = "recommended") => findListings(listings, { ...DEFAULT_FILTERS, ...patch }, query, sort).map((l) => l.id);

test("default filters include large homes and low rents previously hidden", () => {
  assert.deepEqual(find(), ["featured", "large", "small"]);
  assert.equal(countFilters(DEFAULT_FILTERS), 0);
});
test("search matches all words across name, address and city regardless of case", () => {
  assert.deepEqual(find({}, " CHANDIGARH  garden "), ["large"]);
  assert.deepEqual(find({}, "sector 17"), ["small"]);
  assert.deepEqual(find({}, "unknown"), []);
});
test("buy/rent combines with rooms, area and floor boundaries", () => {
  assert.deepEqual(find({ type: "rent", floorArea: "6-10", areaTo: 20 }), ["small"]);
  assert.deepEqual(find({ type: "sale", rooms: 5 }), ["large"]);
  assert.deepEqual(find({ type: "rent", price: [18000, 18000], floorArea: "more10" }), ["featured"]);
  assert.deepEqual(find({ areaFrom: 100, areaTo: 50 }), []);
});
test("sorts results without mutating the loaded listings", () => {
  assert.deepEqual(find({}, "", "price-asc"), ["small", "featured", "large"]);
  assert.deepEqual(find({}, "", "price-desc"), ["large", "featured", "small"]);
  assert.deepEqual(find({}, "", "area-desc"), ["large", "featured", "small"]);
  assert.deepEqual(listings.map((l) => l.id), ["large", "small", "featured"]);
});
test("reset returns all listings after a restrictive search", () => {
  assert.deepEqual(find({ type: "sale" }, "Mohali"), []);
  assert.equal(find().length, listings.length);
});
