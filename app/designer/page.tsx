"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Design, DesignStateV3 } from "@/lib/types";
import DesignerOverlay from "@/components/DesignerOverlay";
import { CloseIcon } from "@/components/icons";

interface Setup {
  name: string;
  w: number; // plot width, meters
  d: number; // plot depth, meters
}

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
  const [w, setW] = useState("20");
  const [d, setD] = useState("15");
  const [error, setError] = useState("");

  const wN = Number(w) || 0;
  const dN = Number(d) || 0;

  const start = () => {
    if (!name.trim()) return setError("Give the project a name");
    if (wN < 6 || dN < 6) return setError("Plot sides must be at least 6 m");
    if (wN > 120 || dN > 120) return setError("Plot sides max 120 m");
    onStart({ name: name.trim(), w: wN, d: dN });
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

        <div className="grid grid-cols-2 gap-1.5">
          <label className={field}>
            <span className={fieldLabel}>Width m</span>
            <input
              className={fieldInput}
              type="number"
              min={6}
              max={120}
              value={w}
              onChange={(e) => setW(e.target.value)}
            />
          </label>
          <label className={field}>
            <span className={fieldLabel}>Depth m</span>
            <input
              className={fieldInput}
              type="number"
              min={6}
              max={120}
              value={d}
              onChange={(e) => setD(e.target.value)}
            />
          </label>
        </div>

        <p className="px-1 text-[12px] font-medium text-plum-soft">
          Plot area:{" "}
          <span className="font-bold text-plum">
            {wN > 0 && dN > 0 ? `${Math.round(wN * dN)} m²` : "—"}
          </span>{" "}
          — shown as an outline in the builder.
        </p>

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
  const savingRef = useRef(false);

  useEffect(() => {
    fetch("/api/designs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Design[]) => setDesigns(data))
      .catch(() => {});
  }, []);

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
    } catch {
      window.alert("Could not save the design — try again.");
    } finally {
      savingRef.current = false;
    }
  };

  const openDesign = (d: Design) => {
    setCurrentId(d.id);
    setSetup({ name: d.name, w: d.plotW, d: d.plotD });
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

  return (
    <div className="h-full bg-cream">
      {setup ? (
        <DesignerOverlay
          key={`${currentId ?? "new"}-${session}`}
          plot={{ w: setup.w, d: setup.d }}
          neighbors={[]}
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
                      <span className="truncate text-[12px] font-semibold text-plum">
                        {d.name}
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
