-- GET /api/properties?bbox=w,s,e,n ("search as I move" on /find) filters on
-- lng/lat ranges; keep that an index scan as the listing count grows.
CREATE INDEX IF NOT EXISTS properties_lng_lat_idx ON properties (lng, lat);
