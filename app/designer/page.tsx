"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Design, DesignMeta, DesignStateV3 } from "@/lib/types";
import DesignerOverlay from "@/components/DesignerOverlay";
import { CloseIcon } from "@/components/icons";
import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";
import { feeLabel } from "@/lib/fees";

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

const field =
  "flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[13px]";
const fieldLabel = "shrink-0 font-medium text-plum-soft";
const fieldInput =
  "w-full min-w-0 bg-transparent font-bold text-plum outline-none placeholder:font-medium placeholder:text-plum-soft/50";

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-cream">
      <section className="glass flex w-[340px] flex-col gap-3 rounded-3xl p-5">
        <h2 className="text-[16px] font-bold text-plum">New home design</h2>

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
          <span className="text-[12px] font-semibold text-plum-soft">
            Plot size in
          </span>
          <div className="flex gap-1">
            {(["m", "ft"] as const).map((u) => (
              <button
                key={u}
                onClick={() => switchUnit(u)}
                className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${
                  unit === u
                    ? "bg-plum text-cream"
                    : "bg-white/55 text-plum hover:bg-white/85"
                }`}
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

        <p className="px-1 text-[12px] font-medium text-plum-soft">
          Plot area:{" "}
          <span className="font-bold text-plum">
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
          <span className="text-[12px] font-semibold text-plum-soft">Floors</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((f) => (
              <button
                key={f}
                onClick={() => setFloors(f)}
                className={`w-9 rounded-full py-1 text-[12px] font-bold transition-colors ${
                  floors === f
                    ? "bg-plum text-cream"
                    : "bg-white/55 text-plum hover:bg-white/85"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold text-plum-soft">
            Plot facing
          </span>
          <div className="flex gap-1">
            {(["N", "E", "S", "W"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFacing(facing === f ? undefined : f)}
                className={`w-9 rounded-full py-1 text-[12px] font-bold transition-colors ${
                  facing === f
                    ? "bg-plum text-cream"
                    : "bg-white/55 text-plum hover:bg-white/85"
                }`}
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

        <label className={`${field} !rounded-2xl`}>
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
          <p className="text-[12px] font-semibold text-coral">{error}</p>
        )}

        <button
          onClick={start}
          className="rounded-full bg-plum py-2.5 text-[13.5px] font-bold text-cream transition-opacity hover:opacity-90"
        >
          Start designing
        </button>
        <button
          onClick={onBack}
          className="rounded-full py-1.5 text-[12px] font-semibold text-plum-soft transition-colors hover:text-plum"
        >
          ← Back to map
        </button>
      </section>
    </div>
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
  const [session, setSession] = useState(0); // bump to remount the builder
  const [listOpen, setListOpen] = useState(true);
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = checking
  const [paying, setPaying] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
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

  const saveDesign = async (designState: DesignStateV3, snapshot: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      let snapshotUrl = current?.snapshot;
      const blob = await (await fetch(snapshot)).blob();
      const fd = new FormData();
      fd.append("file", new File([blob], "snapshot.png", { type: "image/png" }));
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (up.ok) snapshotUrl = ((await up.json()) as { url: string }).url;

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
        window.alert("Could not save the design — try again.");
        return;
      }
      const saved = (await res.json()) as Design;
      setDesigns((prev) =>
        current
          ? prev.map((d) => (d.id === saved.id ? saved : d))
          : [...prev, saved],
      );
      setCurrentId(saved.id);
      celebrate(current ? "Design saved!" : "Design created!");
    } catch {
      window.alert("Could not save the design — try again.");
    } finally {
      savingRef.current = false;
    }
  };

  const openDesign = (d: Design) => {
    setCurrentId(d.id);
    setSetup({
      name: d.name,
      w: d.plotW,
      d: d.plotD,
      unit: d.meta?.unit ?? "m",
      floors: d.design.state.floors?.length ?? 1,
      facing: d.meta?.facing,
      budget: d.meta?.budget,
      notes: d.meta?.notes,
    });
    setSession((s) => s + 1);
  };

  const newDesign = () => {
    setCurrentId(null);
    setSetup(null); // back to the setup questions
  };

  const deleteDesign = async (id: string) => {
    if (!window.confirm("Delete this design? This cannot be undone.")) return;
    const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      if (id === currentId) newDesign();
    }
  };

  if (unlocked !== true) {
    return (
      <div className="flex h-full items-center justify-center bg-cream">
        {unlocked === false && (
          <section className="glass flex w-[340px] flex-col gap-3 rounded-3xl p-5 text-center">
            <h2 className="text-[16px] font-bold text-plum">ArchIt Builder</h2>
            <p className="text-[13px] font-medium text-plum-soft">
              Design homes in 3D — rooms, floors, finishes — and save unlimited
              projects. One-time unlock, yours forever.
            </p>
            <button
              onClick={buyUnlock}
              disabled={paying}
              className="rounded-full bg-plum py-2.5 text-[13.5px] font-bold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {paying
                ? "Opening checkout…"
                : `Unlock builder — ${feeLabel("builder_unlock")} one-time`}
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-full py-1.5 text-[12px] font-semibold text-plum-soft transition-colors hover:text-plum"
            >
              ← Back to map
            </button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="h-full bg-cream">
      {setup ? (
        <DesignerOverlay
          key={`${currentId ?? "new"}-${session}`}
          plot={{ w: setup.w, d: setup.d }}
          neighbors={[]}
          floors={setup.floors}
          facing={setup.facing}
          existingDesign={current?.design}
          onSave={saveDesign}
          onClose={() => router.push("/")}
        />
      ) : (
        <SetupDialog
          onStart={(s) => {
            setSetup(s);
            setSession((v) => v + 1);
          }}
          onBack={() => router.push("/")}
        />
      )}

      {/* saved designs drawer, floats above the builder */}
      <div className="fixed left-3 top-16 z-[80] w-[230px]">
        <div className="glass flex flex-col gap-2 rounded-3xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-plum">My designs</span>
            <button
              onClick={() => setListOpen((o) => !o)}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-plum-soft hover:bg-plum/5"
            >
              {listOpen ? "Hide" : "Show"}
            </button>
          </div>

          {listOpen && (
            <>
              <button
                onClick={newDesign}
                className={`rounded-full py-2 text-[12.5px] font-bold transition-colors ${
                  currentId === null
                    ? "bg-plum text-cream"
                    : "bg-white/55 text-plum hover:bg-white/85"
                }`}
              >
                + New design
              </button>

              <div className="no-scrollbar flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
                {designs.length === 0 && (
                  <p className="px-1 py-2 text-[11.5px] font-medium text-plum-soft">
                    Nothing saved yet — design a home and hit “Save design”.
                  </p>
                )}
                {designs.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center gap-2 rounded-2xl p-1.5 transition-colors ${
                      d.id === currentId ? "bg-plum/10" : "hover:bg-white/55"
                    }`}
                  >
                    <button
                      onClick={() => openDesign(d)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg bg-white/60">
                        {d.snapshot && (
                          <Image
                            src={d.snapshot}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-plum">
                          {d.name}
                        </span>
                        {d.meta?.budget ? (
                          <span className="block text-[10.5px] font-medium text-plum-soft">
                            ₹{d.meta.budget.toLocaleString("en-IN")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteDesign(d.id)}
                      aria-label={`Delete ${d.name}`}
                      className="shrink-0 rounded-full p-1 text-plum-soft transition-colors hover:bg-coral/10 hover:text-coral"
                    >
                      <CloseIcon width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
