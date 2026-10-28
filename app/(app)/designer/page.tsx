"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { safeImageUrl } from "@/lib/url";
import { hasLocation } from "@/lib/showcase";
import type { Design, DesignMeta, DesignStateV3 } from "@/lib/types";
import DesignerOverlay, { type SaveResult } from "@/components/DesignerOverlay";
import PublishDialog from "@/components/PublishDialog";
import { CloseIcon } from "@/components/icons";
import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";
import { feeLabel } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";

interface Setup {
  name: string;
  w: number; // plot width, meters (converted if entered in ft)
  d: number; // plot depth, meters
  unit: "m" | "ft";
  floors: number; // 1–3, pre-created in the builder for new designs
  facing?: DesignMeta["facing"];
  budget?: number; // ₹
  notes?: string;
}

const FT_PER_M = 3.28084;
const toM = (v: number, unit: "m" | "ft") => (unit === "ft" ? v / FT_PER_M : v);

const SNAPSHOT_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** what a failed /api/designs write tells the user (shown in the builder toast) */
function saveErrorMessage(status: number): string {
  if (status === 401) return "you are signed out — sign in again, then save";
  if (status === 402) return "the builder is locked for this account";
  if (status === 404) return "this design no longer exists";
  if (status === 413) return "the design is too large to save";
  if (status === 400) return "the design data was rejected";
  return `server error (${status}) — try again`;
}

/** drafting-paper stage behind the designer's card screens */
function Backdrop({
  as: Tag = "div",
  className,
  children,
}: {
  /** "main" when the backdrop is the page itself (the locked screen) */
  as?: "main" | "div";
  className: string;
  children: React.ReactNode;
}) {
  return (
    // my-auto on the card, not items-center, so a card taller than a short
    // phone screen scrolls from its top instead of being cut off above it
    <Tag
      className={`${className} flex flex-col items-center overflow-y-auto bg-paper p-4`}
    >
      {/* the builder's 2D plan grid, faded out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(41 55 44 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(41 55 44 / 0.06) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 45%, transparent 100%)",
        }}
      />
      <div className="relative my-auto">{children}</div>
    </Tag>
  );
}

const card =
  "flex flex-col gap-3 rounded-md border border-line bg-paper p-6 shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)]";
const eyebrow =
  "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const field = `flex items-baseline gap-1.5 rounded-[5px] border border-line bg-paper-soft/60 px-3.5 py-2.5 text-[14px] focus-within:border-ink`;
const fieldLabel = "shrink-0 text-[13px] font-medium text-ink-soft";
const fieldInput =
  "w-full min-w-0 bg-transparent font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-soft/70";
const rowLabel = "text-[13px] font-semibold text-ink-soft";
/** small pill toggle (unit, floors, facing) */
const chip = (on: boolean) =>
  `min-h-8 rounded-full px-3 text-[12px] font-bold transition-colors ${focusRing} ${
    on
      ? "bg-forest text-paper"
      : "border border-line-strong text-ink hover:border-ink"
  }`;
const primaryBtn = `inline-flex min-h-11 items-center justify-center gap-3 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep disabled:opacity-50 ${focusRing}`;
const textLink = `inline-flex min-h-6 items-center justify-center self-center text-[13px] font-semibold text-ink-soft underline underline-offset-4 transition-colors hover:text-ink ${focusRing}`;

function SetupDialog({
  onStart,
  onBack,
}: {
  onStart: (s: Setup) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("My home");
  const [unit, setUnit] = useState<"m" | "ft">("m");
  const [w, setW] = useState("20");
  const [d, setD] = useState("15");
  const [floors, setFloors] = useState(1);
  const [facing, setFacing] = useState<DesignMeta["facing"]>();
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const wM = toM(Number(w) || 0, unit);
  const dM = toM(Number(d) || 0, unit);

  const switchUnit = (u: "m" | "ft") => {
    if (u === unit) return;
    const conv = (v: string) => {
      const n = Number(v);
      if (!n) return v;
      return String(
        Math.round((u === "ft" ? n * FT_PER_M : n / FT_PER_M) * 10) / 10,
      );
    };
    setW(conv(w));
    setD(conv(d));
    setUnit(u);
  };

  const start = () => {
    if (!name.trim()) return setError("Give the project a name");
    if (wM < 6 || dM < 6)
      return setError(
        unit === "ft"
          ? "Plot sides must be at least 20 ft"
          : "Plot sides must be at least 6 m",
      );
    if (wM > 120 || dM > 120)
      return setError(unit === "ft" ? "Plot sides max 394 ft" : "Plot sides max 120 m");
    const budgetN = Number(budget);
    onStart({
      name: name.trim(),
      w: Math.round(wM * 100) / 100,
      d: Math.round(dM * 100) / 100,
      unit,
      floors,
      facing,
      budget: budgetN > 0 ? budgetN : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Backdrop className="fixed inset-0 z-[70]">
      <section
        aria-labelledby="setup-title"
        className={`${card} w-[380px] max-w-[calc(100vw-32px)]`}
      >
        <div className="mb-1">
          <span className={eyebrow}>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Project setup
          </span>
          <h1
            id="setup-title"
            className="mt-2 font-display text-[28px] font-normal leading-tight tracking-[-0.02em] text-ink"
          >
            New home design
          </h1>
        </div>

        <label className={field}>
          <span className={fieldLabel}>Project</span>
          <input
            className={fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My home"
            autoFocus
          />
        </label>

        <div className="flex items-center justify-between px-1">
          <span className={rowLabel}>Plot size in</span>
          <div className="flex gap-1">
            {(["m", "ft"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => switchUnit(u)}
                className={chip(unit === u)}
              >
                {u === "m" ? "meters" : "feet"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className={field}>
            <span className={fieldLabel}>Width {unit}</span>
            <input
              className={fieldInput}
              type="number"
              value={w}
              onChange={(e) => setW(e.target.value)}
            />
          </label>
          <label className={field}>
            <span className={fieldLabel}>Depth {unit}</span>
            <input
              className={fieldInput}
              type="number"
              value={d}
              onChange={(e) => setD(e.target.value)}
            />
          </label>
        </div>

        <p className="px-1 text-[14px] leading-relaxed text-ink-soft">
          Plot area:{" "}
          <span className="font-bold tabular-nums text-ink">
            {wM > 0 && dM > 0
              ? `${Math.round(wM * dM)} m²${
                  unit === "ft"
                    ? ` (${Math.round(wM * dM * FT_PER_M * FT_PER_M)} ft²)`
                    : ""
                }`
              : "—"}
          </span>{" "}
          — shown as an outline in the builder.
        </p>

        <div className="flex items-center justify-between px-1">
          <span className={rowLabel}>Floors</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={floors === f}
                onClick={() => setFloors(f)}
                className={`w-9 ${chip(floors === f)}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className={rowLabel}>Plot facing</span>
          <div className="flex gap-1">
            {(["N", "E", "S", "W"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={facing === f}
                onClick={() => setFacing(facing === f ? undefined : f)}
                className={`w-9 ${chip(facing === f)}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <label className={field}>
          <span className={fieldLabel}>Budget ₹</span>
          <input
            className={fieldInput}
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="optional"
          />
        </label>

        <label className={field}>
          <span className={fieldLabel}>Notes</span>
          <textarea
            className={`${fieldInput} resize-none`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="optional"
          />
        </label>

        {error && (
          <p role="alert" className="px-1 text-[14px] font-semibold text-accent">
            {error}
          </p>
        )}

        <button type="button" onClick={start} className={`${primaryBtn} mt-1`}>
          Start designing <span aria-hidden>↗</span>
        </button>
        <button type="button" onClick={onBack} className={textLink}>
          ← Back to map
        </button>
      </section>
    </Backdrop>
  );
}

/**
 * Standalone ArchIt designer — full-screen builder with a saved-designs
 * drawer. Deliberately not connected to the map: designs live on their own.
 */
export default function DesignerPage() {
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  // The builder iframe mounts with the first design and then stays loaded (it
  // owns a WebGL context): `builderSetup` is the setup it was last opened with,
  // and bumping `session` hands it the next design without a reload.
  const [builderSetup, setBuilderSetup] = useState<Setup | null>(null);
  const [session, setSession] = useState(0);
  // null = never toggled: open on desktop, collapsed to a pill on phones, where
  // the open drawer would sit on top of the builder's own controls
  const [listOpen, setListOpen] = useState<boolean | null>(null);
  // the publish / move-pin dialog is open for this design
  const [publishing, setPublishing] = useState<Design | null>(null);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
  // null = checking. With the paywall off the builder is free for everyone, so
  // skip the round trip: a slow or failed /api/purchases would otherwise put the
  // "Unlock the builder" card in front of a free product.
  const [unlocked, setUnlocked] = useState<boolean | null>(
    PAYWALL_ENABLED ? null : true,
  );
  const [paying, setPaying] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!PAYWALL_ENABLED) return;
    fetch("/api/purchases?purpose=builder_unlock")
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((d: { unlocked?: boolean }) => setUnlocked(!!d.unlocked))
      .catch(() => setUnlocked(false));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/designs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Design[]) => setDesigns(data))
      .catch(() => {});
  }, [unlocked]);

  const buyUnlock = async () => {
    setPaying(true);
    try {
      if (await payFee("builder_unlock", "ArchIt Builder — one-time unlock")) {
        setUnlocked(true);
        celebrate("Builder unlocked — yours forever!");
      }
    } finally {
      setPaying(false);
    }
  };

  const current = designs.find((d) => d.id === currentId) ?? null;

  const saveDesign = async (
    designState: DesignStateV3,
    snapshot: Blob | string,
  ): Promise<SaveResult> => {
    if (savingRef.current) return { ok: false, error: "a save is already in progress" };
    savingRef.current = true;
    try {
      let snapshotUrl = current?.snapshot;
      // Thumbnail is best-effort: a failed upload keeps the old snapshot
      // instead of failing the whole save. The builder sends a small WebP/JPEG
      // Blob; a string (data URL from a stale cached builder) is skipped rather
      // than decoded — fetch(data:) is blocked by the CSP's connect-src.
      if (snapshot instanceof Blob) {
        try {
          const type = SNAPSHOT_EXT[snapshot.type] ? snapshot.type : "image/webp";
          const fd = new FormData();
          fd.append(
            "file",
            new File([snapshot], `snapshot.${SNAPSHOT_EXT[type]}`, { type }),
          );
          const up = await fetch("/api/upload", { method: "POST", body: fd });
          if (up.ok) snapshotUrl = ((await up.json()) as { url: string }).url;
        } catch (err) {
          console.warn("Snapshot upload failed", err);
        }
      }

      const body = {
        name: setup?.name ?? current?.name ?? "My design",
        // standalone designs carry no map location
        plotCenter: current?.plotCenter ?? [0, 0],
        plotW: setup?.w ?? current?.plotW ?? 30,
        plotD: setup?.d ?? current?.plotD ?? 30,
        design: designState,
        snapshot: snapshotUrl,
        meta: setup
          ? {
              unit: setup.unit,
              facing: setup.facing,
              budget: setup.budget,
              notes: setup.notes,
            }
          : current?.meta,
      };
      const res = current
        ? await fetch(`/api/designs/${current.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/designs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        // The builder shows this in its own toast ("Could not save: …"), so no
        // blocking alert on top of it.
        return { ok: false, error: saveErrorMessage(res.status) };
      }
      const saved = (await res.json()) as Design;
      setDesigns((prev) =>
        current
          ? prev.map((d) => (d.id === saved.id ? saved : d))
          : [...prev, saved],
      );
      setCurrentId(saved.id);
      celebrate(current ? "Design saved!" : "Design created!");
      return { ok: true };
    } catch (err) {
      console.warn("Design save failed", err);
      return { ok: false, error: "check your connection and try again" };
    } finally {
      savingRef.current = false;
    }
  };

  const openBuilder = (s: Setup) => {
    setSetup(s);
    setBuilderSetup(s);
    setSession((v) => v + 1);
  };

  const openDesign = (d: Design) => {
    setCurrentId(d.id);
    openBuilder({
      name: d.name,
      w: d.plotW,
      d: d.plotD,
      unit: d.meta?.unit ?? "m",
      floors: d.design.state.floors?.length ?? 1,
      facing: d.meta?.facing,
      budget: d.meta?.budget,
      notes: d.meta?.notes,
    });
  };

  const newDesign = () => {
    setCurrentId(null);
    setSetup(null); // back to the setup questions
  };

  const deleteDesign = async (id: string) => {
    const published = designs.find((d) => d.id === id)?.publishedAt;
    const warning = published
      ? "Delete this design? It leaves the showcase and the map, listings stop showing it, and this cannot be undone."
      : "Delete this design? This cannot be undone.";
    if (!window.confirm(warning)) return;
    try {
      const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        setDesigns((prev) => prev.filter((d) => d.id !== id));
        if (id === currentId) newDesign();
      } else {
        window.alert(`Could not delete the design: ${saveErrorMessage(res.status)}`);
      }
    } catch {
      window.alert("Could not delete the design — check your connection.");
    }
  };

  const replaceDesign = (saved: Design) =>
    setDesigns((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));

  /** confirm, then POST a publish-route body for `d` (one at a time) */
  const changePublishState = async (
    d: Design,
    body: { published: boolean; location?: false },
    confirmText: string,
    what: string,
  ) => {
    if (unpublishingId) return;
    if (!window.confirm(confirmText)) return;
    setUnpublishingId(d.id);
    try {
      const res = await fetch(`/api/designs/${encodeURIComponent(d.id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        window.alert(`Could not ${what}: ${saveErrorMessage(res.status)}`);
        return;
      }
      replaceDesign((await res.json()) as Design);
    } catch {
      window.alert(`Could not ${what} — check your connection.`);
    } finally {
      setUnpublishingId(null);
    }
  };

  const unpublishDesign = (d: Design) =>
    changePublishState(
      d,
      { published: false },
      `Unpublish “${d.name}”? It leaves the showcase and the map, and listings stop showing it.`,
      "unpublish the design",
    );

  // keeps it in the showcase gallery, takes it off the /find map
  const removePin = (d: Design) =>
    changePublishState(
      d,
      { published: true, location: false },
      `Remove the map pin of “${d.name}”? It stays in the showcase but leaves the map.`,
      "remove the map pin",
    );

  if (unlocked !== true) {
    return (
      <Backdrop as="main" className="app-shell relative h-full">
        {unlocked === false && (
          <section
            aria-labelledby="unlock-title"
            className={`${card} w-[420px] max-w-[calc(100vw-32px)] gap-4 p-7`}
          >
            <span className={eyebrow}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              ArchIt Builder
            </span>
            <h1
              id="unlock-title"
              className="font-display text-[32px] font-normal leading-[1.1] tracking-[-0.02em] text-ink"
            >
              Design your dream home in&nbsp;3D.
            </h1>
            <ul className="flex flex-col border-y border-line">
              {[
                "Drag-and-drop rooms, doors, windows & furniture",
                "Up to 3 floors, finishes & materials",
                "Plot outline, facing & real plot sizes",
                "Unlimited saved projects with 3D snapshots",
              ].map((t, i) => (
                <li
                  key={t}
                  className="flex items-start gap-3 border-b border-line py-2.5 text-[14px] leading-snug text-ink last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="pt-px text-[11px] font-bold tabular-nums text-accent"
                  >
                    0{i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex items-baseline gap-2.5 rounded-[5px] bg-paper-soft px-4 py-3">
              <span className="font-display text-[30px] font-normal tabular-nums tracking-[-0.02em] text-ink">
                {feeLabel("builder_unlock")}
              </span>
              <span className="text-[13px] font-semibold text-ink-soft">
                one-time · yours forever
              </span>
            </div>
            <button
              type="button"
              onClick={buyUnlock}
              disabled={paying}
              className={primaryBtn}
            >
              {paying ? "Opening checkout…" : "Unlock the builder"}
              {!paying && <span aria-hidden>↗</span>}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className={textLink}
            >
              ← Back to map
            </button>
          </section>
        )}
      </Backdrop>
    );
  }

  return (
    <main className="app-shell h-full bg-paper">
      {/* the visible heading lives in the setup card and the builder iframe */}
      {setup && <h1 className="sr-only">Home designer: {setup.name}</h1>}
      {builderSetup && (
        <DesignerOverlay
          session={session}
          hidden={!setup}
          plot={{ w: builderSetup.w, d: builderSetup.d }}
          neighbors={[]}
          floors={builderSetup.floors}
          facing={builderSetup.facing}
          existingDesign={current?.design}
          onSave={saveDesign}
          onClose={() => router.push("/")}
        />
      )}
      {!setup && (
        <SetupDialog onStart={openBuilder} onBack={() => router.push("/")} />
      )}

      {/* saved designs drawer, floats above the builder; on desktop it sits
          right of the builder's undo/redo buttons, which it used to cover */}
      <div
        className={`fixed left-[118px] top-[76px] z-[80] w-[230px] max-[760px]:left-12 max-[760px]:top-2 ${listOpen ? "" : "max-[760px]:w-auto"}`}
      >
        <div className="flex flex-col gap-2 rounded-md border border-line bg-paper p-3 shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] max-[760px]:p-1.5">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft ${listOpen ? "" : "max-[760px]:hidden"}`}
            >
              My designs
            </span>
            <Link
              href="/showcase"
              className={`ml-auto inline-flex min-h-6 items-center rounded-[4px] px-1.5 text-[12px] font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline ${focusRing} ${listOpen ? "" : "max-[760px]:hidden"}`}
            >
              Showcase
            </Link>
            <button
              type="button"
              // null until the visitor toggles: CSS decides (open on desktop,
              // collapsed on phones), so claim no state rather than a wrong one
              aria-expanded={listOpen ?? undefined}
              onClick={() =>
                setListOpen(
                  !(listOpen ?? !window.matchMedia("(max-width: 760px)").matches),
                )
              }
              className={`inline-flex min-h-6 items-center rounded-full px-2 text-[12px] font-semibold text-ink-soft hover:bg-ink/5 hover:text-ink max-[760px]:min-h-8 max-[760px]:text-ink ${focusRing}`}
            >
              <span className="max-[760px]:hidden">
                {listOpen === false ? "Show" : "Hide"}
              </span>
              <span className="hidden max-[760px]:inline">
                {listOpen ? "Hide" : "My designs"}
              </span>
            </button>
          </div>

          {listOpen !== false && (
            <div
              className={`flex flex-col gap-2 ${listOpen === null ? "max-[760px]:hidden" : ""}`}
            >
              <button
                type="button"
                onClick={newDesign}
                aria-pressed={currentId === null}
                className={`min-h-9 rounded-[5px] text-[13px] font-semibold transition-colors ${focusRing} ${
                  currentId === null
                    ? "bg-forest text-paper"
                    : "border border-line-strong text-ink hover:border-ink"
                }`}
              >
                + New design
              </button>

              <div className="no-scrollbar flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
                {designs.length === 0 && (
                  <p className="px-1 py-2 text-[14px] leading-snug text-ink-soft">
                    Nothing saved yet — design a home and hit “Save design”.
                  </p>
                )}
                {designs.map((d) => (
                  <div
                    key={d.id}
                    className={`flex flex-col gap-1 rounded-[5px] p-1.5 transition-colors ${
                      d.id === currentId
                        ? "bg-paper-soft shadow-[inset_2px_0_0_var(--color-accent)]"
                        : "hover:bg-paper-soft/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDesign(d)}
                        aria-current={d.id === currentId || undefined}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-[4px] text-left ${focusRing}`}
                      >
                        <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-[4px] border border-line bg-paper-soft">
                          {safeImageUrl(d.snapshot) && (
                            <Image
                              src={safeImageUrl(d.snapshot)!}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {d.name}
                          </span>
                          {d.meta?.budget ? (
                            <span className="block text-[11px] font-medium tabular-nums text-ink-soft">
                              ₹{d.meta.budget.toLocaleString("en-IN")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDesign(d.id)}
                        aria-label={`Delete ${d.name}`}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent ${focusRing}`}
                      >
                        <CloseIcon width={12} height={12} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 pl-14">
                      {d.publishedAt ? (
                        <>
                          <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink">
                            Published
                          </span>
                          <button
                            type="button"
                            onClick={() => setPublishing(d)}
                            className={`inline-flex min-h-6 items-center rounded-full px-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink ${focusRing}`}
                          >
                            {hasLocation(d.plotCenter[0], d.plotCenter[1]) ? "Move pin" : "Add pin"}
                          </button>
                          {hasLocation(d.plotCenter[0], d.plotCenter[1]) && (
                            <button
                              onClick={() => removePin(d)}
                              disabled={unpublishingId === d.id}
                              className={`inline-flex min-h-6 items-center rounded-full px-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50 ${focusRing}`}
                            >
                              Remove pin
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => unpublishDesign(d)}
                            disabled={unpublishingId === d.id}
                            className={`inline-flex min-h-6 items-center rounded-full px-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50 ${focusRing}`}
                          >
                            {unpublishingId === d.id ? "Saving…" : "Unpublish"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPublishing(d)}
                          className={`inline-flex min-h-6 items-center rounded-full border border-line-strong px-2 text-[11px] font-bold text-ink transition-colors hover:border-ink ${focusRing}`}
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {publishing && (
        <PublishDialog
          key={publishing.id}
          design={publishing}
          onDone={(saved) => {
            replaceDesign(saved);
            setPublishing(null);
            celebrate(publishing.publishedAt ? "Pin saved!" : "Published to the showcase!");
          }}
          onCancel={() => setPublishing(null)}
        />
      )}
    </main>
  );
}
