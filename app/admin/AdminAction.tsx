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

// Filled accent for the go-ahead, outlined accent for destructive steps, a
// plain outline for the rest. Accent on paper and paper on accent are 5.1:1.
const TONES: Record<ActionSpec["tone"], string> = {
  primary: "border-accent bg-accent text-paper hover:border-accent-deep hover:bg-accent-deep",
  danger: "border-accent/70 text-accent-deep hover:border-accent hover:bg-accent/10",
  neutral: "border-line-strong text-ink hover:border-ink",
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
          className={`inline-flex min-h-11 items-center justify-center rounded-[5px] border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 ${TONES[spec.tone]}`}
        >
          {busy === spec.action ? "Working…" : spec.label}
        </button>
      ))}
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-accent">
          {error}
        </span>
      )}
    </div>
  );
}
