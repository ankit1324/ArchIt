"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/types";
import { reverseGeocode, searchPlace } from "@/lib/geocode";
import { hasLocation } from "@/lib/showcase";
import type { FlyTarget } from "@/components/PinPickerMap";

const PinPickerMap = dynamic(() => import("@/components/PinPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-2xl bg-white/60" />,
});

const MAX_PLACE = 120; // same cap as the publish route (lib/showcase.ts)

const publishErrorText = (status: number) =>
  status === 404
    ? "This design no longer exists."
    : status === 429
      ? "Too many tries — wait a minute and try again."
      : status === 400
        ? "That spot can’t be used — pick another one."
        : "Couldn’t publish — try again.";

/**
 * Publish a saved design to the showcase, optionally with a map pin. For an
 * already-published design it is the "Move pin" dialog. Unpublishing is not
 * done here (the designs list confirms and POSTs `{ published: false }`).
 */
export default function PublishDialog({
  design,
  onDone,
  onCancel,
}: {
  design: Design;
  onDone: (d: Design) => void;
  onCancel: () => void;
}) {
  const stored = hasLocation(design.plotCenter[0], design.plotCenter[1])
    ? design.plotCenter
    : null;
  const movingPin = Boolean(design.publishedAt && stored);

  const [pin, setPin] = useState<[number, number] | null>(stored);
  const [place, setPlace] = useState(stored ? (design.place ?? "") : "");
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const searchCtrl = useRef<AbortController | null>(null);
  const geoCtrl = useRef<AbortController | null>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Escape closes; abort any in-flight lookups on unmount
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      searchCtrl.current?.abort();
      geoCtrl.current?.abort();
    };
  }, []);

  /** move the pin and label it from Nominatim (best effort) */
  const dropPin = (coords: [number, number]) => {
    setPin(coords);
    setPlace("");
    setError("");
    geoCtrl.current?.abort();
    const ctrl = new AbortController();
    geoCtrl.current = ctrl;
    setLocating(true);
    reverseGeocode(coords, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setLocating(false);
      // don't clobber a label the user typed while the lookup ran
      if (r) setPlace((p) => p || r.label);
    });
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    searchCtrl.current?.abort();
    const ctrl = new AbortController();
    searchCtrl.current = ctrl;
    setSearching(true);
    setSearchMsg("");
    try {
      const hit = await searchPlace(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!hit) {
        setSearchMsg("No place found — try another name.");
        return;
      }
      setFlyTo({ center: hit.center, bbox: hit.bbox });
      // drop the pin there too, so search alone works if the map is down;
      // a click on the map refines it
      dropPin(hit.center);
    } catch {
      if (!ctrl.signal.aborted) {
        setSearchMsg("Search is unavailable — click the map instead.");
      }
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  };

  const submit = async (withPin: boolean) => {
    if (busy) return;
    if (withPin && !pin) {
      setError("Click the map to drop a pin first.");
      return;
    }
    setBusy(true);
    setError("");
    const body =
      withPin && pin
        ? {
            published: true,
            location: {
              lng: pin[0],
              lat: pin[1],
              place: place.trim().slice(0, MAX_PLACE) || undefined,
            },
          }
        : // `location: false` removes any stored spot: "without a pin" must
          // really take the design off the map
          { published: true, location: false };
    try {
      const res = await fetch(`/api/designs/${encodeURIComponent(design.id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(publishErrorText(res.status));
        return;
      }
      onDone((await res.json()) as Design);
    } catch {
      setError("Couldn’t publish — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-plum/35 p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
        className="glass flex max-h-full w-[440px] max-w-full flex-col gap-3 overflow-y-auto rounded-[28px] p-5 shadow-[0_30px_80px_-30px_rgba(61,24,48,.35)]"
      >
        <div>
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-coral">
            {movingPin ? "Move pin" : design.publishedAt ? "Add map pin" : "Publish to showcase"}
          </span>
          <h2
            id="publish-dialog-title"
            className="mt-0.5 truncate text-[19px] font-extrabold tracking-tight text-plum"
          >
            {design.name}
          </h2>
        </div>

        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place, e.g. Sector 8, Chandigarh"
            aria-label="Search a place"
            className="min-w-0 flex-1 rounded-full bg-white/70 px-3.5 py-2 text-[13px] font-semibold text-plum outline-none placeholder:font-medium placeholder:text-plum-soft/60"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="shrink-0 rounded-full bg-white/80 px-3.5 py-2 text-[12.5px] font-bold text-plum transition-colors hover:bg-white disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {searchMsg && (
          <p className="-mt-1 px-1 text-[11.5px] font-semibold text-coral">{searchMsg}</p>
        )}

        <div className="h-[260px] shrink-0">
          <PinPickerMap value={pin} onChange={dropPin} flyTo={flyTo} />
        </div>

        <label className="flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[13px]">
          <span className="shrink-0 font-medium text-plum-soft">Place</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            maxLength={MAX_PLACE}
            disabled={!pin}
            placeholder={
              !pin ? "Click the map to drop a pin" : locating ? "Looking up…" : "optional label"
            }
            className="w-full min-w-0 bg-transparent font-bold text-plum outline-none placeholder:font-medium placeholder:text-plum-soft/50 disabled:cursor-not-allowed"
          />
        </label>

        <p className="px-1 text-[12px] font-medium text-plum-soft">
          Anyone, including people who are not signed in, can see this design, the spot you
          pick and your name as the author (your first name, or your username).
        </p>

        {error && <p className="px-1 text-[12px] font-semibold text-coral">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy || !pin}
            className="rounded-full bg-plum py-2.5 text-[13.5px] font-bold text-cream shadow-[0_12px_28px_-10px_rgba(61,24,48,.55)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Saving…" : movingPin ? "Save pin" : design.publishedAt ? "Add pin" : "Publish"}
          </button>
          {/* Sends `location: false`, which clears a stored spot too. Hidden
              only for a published design that has no pin (nothing to do). */}
          {(!design.publishedAt || stored) && (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={busy}
              className="rounded-full bg-white/70 py-2 text-[12.5px] font-bold text-plum transition-colors hover:bg-white disabled:opacity-50"
            >
              {design.publishedAt ? "Remove map pin (gallery only)" : "Publish without map pin"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full py-1.5 text-[12px] font-semibold text-plum-soft transition-colors hover:text-plum"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
