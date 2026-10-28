"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/types";
import { reverseGeocode, searchPlace } from "@/lib/geocode";
import { hasLocation } from "@/lib/showcase";
import type { FlyTarget } from "@/components/PinPickerMap";

const PinPickerMap = dynamic(() => import("@/components/PinPickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-md border border-line bg-paper-soft" />,
});

const MAX_PLACE = 120; // same cap as the publish route (lib/showcase.ts)

const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
        className="flex max-h-full w-[460px] max-w-full flex-col gap-3 overflow-y-auto rounded-md border border-line bg-paper p-6 shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)]"
      >
        <div>
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {movingPin ? "Move pin" : design.publishedAt ? "Add map pin" : "Publish to showcase"}
          </span>
          <h2
            id="publish-dialog-title"
            className="mt-2 truncate font-display text-[26px] font-normal leading-tight tracking-[-0.02em] text-ink"
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
            className="min-h-11 min-w-0 flex-1 rounded-[5px] border border-line bg-paper-soft/60 px-3.5 text-[14px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-soft/80 focus:border-ink"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className={`min-h-11 shrink-0 rounded-[5px] border border-line-strong px-4 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50 ${focusRing}`}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        {searchMsg && (
          <p role="status" className="-mt-1 px-1 text-[14px] font-semibold text-accent">{searchMsg}</p>
        )}

        <div className="h-[260px] shrink-0">
          <PinPickerMap value={pin} onChange={dropPin} flyTo={flyTo} />
        </div>

        <label className="flex items-baseline gap-1.5 rounded-[5px] border border-line bg-paper-soft/60 px-3.5 py-2.5 text-[14px] focus-within:border-ink">
          <span className="shrink-0 text-[13px] font-medium text-ink-soft">Place</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            maxLength={MAX_PLACE}
            disabled={!pin}
            placeholder={
              !pin ? "Click the map to drop a pin" : locating ? "Looking up…" : "optional label"
            }
            className="w-full min-w-0 bg-transparent font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-soft/80 disabled:cursor-not-allowed"
          />
        </label>

        <p className="px-1 text-[14px] leading-relaxed text-ink-soft">
          Anyone, including people who are not signed in, can see this design, the spot you
          pick and your name as the author (your first name, or your username).
        </p>

        {error && (
          <p role="alert" className="px-1 text-[14px] font-semibold text-accent">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy || !pin}
            className={`min-h-11 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep disabled:opacity-50 disabled:hover:bg-accent ${focusRing}`}
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
              className={`min-h-11 rounded-[5px] border border-line-strong px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50 ${focusRing}`}
            >
              {design.publishedAt ? "Remove map pin (gallery only)" : "Publish without map pin"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`inline-flex min-h-6 items-center justify-center self-center text-[13px] font-semibold text-ink-soft underline underline-offset-4 transition-colors hover:text-ink ${focusRing}`}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
