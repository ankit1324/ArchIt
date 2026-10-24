"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ActionSpec {
  action: string;
  label: string;
  tone: "primary" | "danger" | "neutral";
  /** Prompt for a note (sent to the lister as the reason). */
  askNote?: boolean;
  /** Prompt text for the note; defaults to the lister-reason wording. */
  notePrompt?: string;
  /** Ask "are you sure?" with this text before acting. */
  confirm?: string;
  /** DELETE the endpoint instead of POSTing `{ action, note }`. */
  method?: "POST" | "DELETE";
  /** Navigate here afterwards instead of refreshing (e.g. after a delete). */
  redirectTo?: string;
}

const TONES: Record<ActionSpec["tone"], string> = {
  primary: "bg-plum text-cream",
  danger: "bg-coral text-white",
  neutral: "bg-plum/10 text-plum",
};

/**
 * Buttons for one admin decision. Posts `{ action, note }` to `endpoint`,
 * then refreshes the server-rendered page so the item drops out of its queue.
 * Deliberately Clerk-free so it renders under any layout.
 */
export default function AdminAction({
  endpoint,
  actions,
}: {
  endpoint: string;
  actions: ActionSpec[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stay disabled until the refresh/redirect lands: `busy` clears as soon as
  // the request returns, and a second click on the stale row would re-send.
  const [refreshing, startTransition] = useTransition();

  const run = async (spec: ActionSpec) => {
    if (spec.confirm && !window.confirm(spec.confirm)) return;
    let note: string | null = null;
    if (spec.askNote) {
      note = window.prompt(spec.notePrompt ?? `${spec.label}: reason (emailed to the lister)`, "");
      if (note === null) return; // cancelled
    }
    setBusy(spec.action);
    setError(null);
    try {
      const res =
        spec.method === "DELETE"
          ? await fetch(note ? `${endpoint}?note=${encodeURIComponent(note)}` : endpoint, {
              method: "DELETE",
            })
          : await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: spec.action, note }),
            });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => null);
        setError(msg || `Failed (${res.status})`);
        return;
      }
      const to = spec.redirectTo;
      startTransition(() => (to ? router.push(to) : router.refresh()));
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((spec) => (
        <button
          key={spec.action}
          type="button"
          onClick={() => run(spec)}
          disabled={busy !== null || refreshing}
          className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50 ${TONES[spec.tone]}`}
        >
          {busy === spec.action ? "Working…" : spec.label}
        </button>
      ))}
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-coral">
          {error}
        </span>
      )}
    </div>
  );
}
