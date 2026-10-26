import assert from "node:assert/strict";
import test from "node:test";
import { reverseGeocode, searchPlace } from "../lib/geocode.ts";

const realFetch = globalThis.fetch;

/** stub fetch with one canned JSON response; records the requested URLs */
function stubFetch(body, { ok = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok, json: async () => body };
  };
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("searchPlace parses lon/lat and boundingbox into center + bbox", async () => {
  const calls = stubFetch([
    {
      lat: "30.7410",
      lon: "76.7794",
      boundingbox: ["30.70", "30.79", "76.73", "76.83"], // [s, n, w, e]
    },
  ]);
  const hit = await searchPlace("Sector 8, Chandigarh");
  assert.deepEqual(hit, {
    center: [76.7794, 30.741],
    bbox: [
      [76.73, 30.7],
      [76.83, 30.79],
    ],
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://nominatim.openstreetmap.org/search?q=Sector%208%2C%20Chandigarh&format=jsonv2&limit=1",
  );
});

test("searchPlace passes the abort signal through", async () => {
  const calls = stubFetch([]);
  const ctrl = new AbortController();
  await searchPlace("x", ctrl.signal);
  assert.equal(calls[0].init.signal, ctrl.signal);
});

test("searchPlace returns null for an empty result", async () => {
  stubFetch([]);
  assert.equal(await searchPlace("nowhere at all"), null);
});

test("searchPlace returns null for a blank query without fetching", async () => {
  const calls = stubFetch([]);
  assert.equal(await searchPlace("   "), null);
  assert.equal(calls.length, 0);
});

test("searchPlace returns null when the hit has no usable coordinates", async () => {
  stubFetch([{ lat: "abc", lon: "", boundingbox: ["1", "2", "3", "4"] }]);
  assert.equal(await searchPlace("bad"), null);
});

test("searchPlace throws when the service is unavailable", async () => {
  stubFetch({}, { ok: false });
  await assert.rejects(() => searchPlace("Chandigarh"));
});

test("reverseGeocode builds a short label from road, suburb and city", async () => {
  const calls = stubFetch({
    display_name: "12, Madhya Marg, Sector 8, Chandigarh, 160009, India",
    address: {
      house_number: "12",
      road: "Madhya Marg",
      suburb: "Sector 8",
      city: "Chandigarh",
      postcode: "160009",
    },
  });
  const r = await reverseGeocode([76.7794, 30.741]);
  assert.deepEqual(r, { label: "Madhya Marg, Sector 8, Chandigarh", city: "Chandigarh" });
  assert.equal(
    calls[0].url,
    "https://nominatim.openstreetmap.org/reverse?lat=30.741&lon=76.7794&format=jsonv2&zoom=18",
  );
});

test("reverseGeocode falls back to town, then village, for the city", async () => {
  stubFetch({ address: { suburb: "Old Town", town: "Kasauli" } });
  assert.deepEqual(await reverseGeocode([76.9, 30.9]), {
    label: "Old Town, Kasauli",
    city: "Kasauli",
  });
  stubFetch({ address: { road: "Mall Road", village: "Dharamkot" } });
  assert.deepEqual(await reverseGeocode([76.3, 32.2]), {
    label: "Mall Road, Dharamkot",
    city: "Dharamkot",
  });
});

test("reverseGeocode prefers city over town and village", async () => {
  stubFetch({ address: { city: "Mohali", town: "T", village: "V" } });
  assert.deepEqual(await reverseGeocode([76.7, 30.7]), { label: "Mohali", city: "Mohali" });
});

test("reverseGeocode truncates the label to 120 characters", async () => {
  stubFetch({ address: { road: "R".repeat(200), city: "Chandigarh" } });
  const r = await reverseGeocode([76.7, 30.7]);
  assert.equal(r.label.length, 120);
  assert.equal(r.label, "R".repeat(120));
});

test("reverseGeocode returns null when nothing usable comes back", async () => {
  stubFetch({ error: "Unable to geocode" });
  assert.equal(await reverseGeocode([0.1, 0.1]), null);
});

test("reverseGeocode returns null when the service fails", async () => {
  stubFetch({}, { ok: false });
  assert.equal(await reverseGeocode([76.7, 30.7]), null);
  globalThis.fetch = async () => {
    throw new TypeError("network down");
  };
  assert.equal(await reverseGeocode([76.7, 30.7]), null);
});
