"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-[5px] border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9";

/**
 * The by-hand path for one AI photo request: copy the prompt, save the
 * builder's picture, make the photo in an image tool, then upload it here.
 */
export default function AiPhotoTools({ id, prompt, done }: { id: string; prompt: string; done: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the prompt text and copy it by hand.");
    }
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose the photo you made first.");
    if (file.size > 4 * 1024 * 1024) return setError("The photo is larger than 4 MB. Save it as JPEG or WebP, or make it smaller.");
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/ai-photos/${id}`, { method: "POST", body: form });
      if (!res.ok) {
        const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
        setError(msg || `Failed (${res.status})`);
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className={`${btn} border-line-strong text-ink hover:border-ink`}>
          {copied ? "Copied" : "Copy prompt"}
        </button>
        <a
          href={`/api/ai-photos/${id}/image?which=input&download=1`}
          className={`${btn} border-line-strong text-ink hover:border-ink`}
        >
          Download picture
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`file-${id}`}>
          The photo you made
        </label>
        <input
          id={`file-${id}`}
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="max-w-full text-[13px] file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-[5px] file:border file:border-line-strong file:bg-paper file:px-3 file:text-[13px] file:font-semibold file:text-ink"
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy || refreshing}
          className={`${btn} border-accent bg-accent text-paper hover:border-accent-deep hover:bg-accent-deep`}
        >
          {busy ? "Uploading…" : done ? "Replace photo" : "Upload and send to user"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-accent-deep">
          {error}
        </p>
      )}
    </div>
  );
}
