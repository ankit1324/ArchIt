"use client";

import { useState, type FormEvent } from "react";
import {
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
  MAX_CONTACT_EMAIL,
  MAX_CONTACT_MESSAGE,
  MAX_CONTACT_NAME,
  MIN_CONTACT_MESSAGE,
  validateContact,
} from "@/lib/contact";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

// user-invalid: only flags a field after the visitor has interacted with it,
// so an untouched form never opens covered in red.
const field =
  "mt-2 block min-h-11 w-full rounded-[5px] border border-line-strong bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors placeholder:text-ink-soft hover:border-ink focus-visible:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent user-invalid:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const label = "block text-[11px] font-bold uppercase tracking-[0.14em] text-ink";

/**
 * Contact form → POST /api/contact (stored for the admin inbox). Validates
 * with the same rules as the server first so typos get instant feedback.
 */
export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sending = status.kind === "sending";

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const checked = validateContact(body);
    if (typeof checked === "string") {
      setStatus({ kind: "error", message: checked });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        form.reset();
        setStatus({ kind: "sent" });
        return;
      }
      const serverMsg = await res
        .json()
        .then((j: { error?: string }) => j.error)
        .catch(() => undefined);
      const message =
        res.status === 429
          ? "You've sent several messages already. Please wait an hour and try again."
          : res.status === 400 && serverMsg
            ? serverMsg
            : res.status === 503 && serverMsg
              ? serverMsg
              : "Something went wrong sending your message. Please try again in a few minutes.";
      setStatus({ kind: "error", message });
    } catch {
      setStatus({ kind: "error", message: "Network error. Check your connection and try again." });
    }
  };

  if (status.kind === "sent") {
    return (
      <div role="status" className="rounded-[5px] border border-line bg-[#e7ece4] p-7 text-[15px] leading-[1.75] text-ink-soft md:p-9">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> Sent
        </p>
        <p className="mt-4 font-display text-[28px] leading-[1.15] font-normal tracking-[-0.02em] text-ink">
          Thanks, your message has been sent.
        </p>
        <p className="mt-3">We&apos;ll reply to the email address you gave us.</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-6 inline-flex min-h-6 items-center rounded-[2px] text-[14px] font-semibold text-ink underline underline-offset-4 hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={sending}
      className="relative rounded-[5px] border border-line bg-paper-soft p-6 md:p-9"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={label}>Your name</label>
          <input
            id="contact-name"
            name="name"
            required
            maxLength={MAX_CONTACT_NAME}
            autoComplete="name"
            disabled={sending}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={label}>Email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={MAX_CONTACT_EMAIL}
            autoComplete="email"
            disabled={sending}
            className={field}
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="contact-topic" className={label}>Topic</label>
        <div className="relative">
          <select
            id="contact-topic"
            name="topic"
            required
            defaultValue=""
            disabled={sending}
            className={`${field} appearance-none pr-10`}
          >
            <option value="" disabled>
              Choose a topic
            </option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {CONTACT_TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
          {/* appearance-none drops the native arrow; this replaces it */}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="pointer-events-none absolute top-1/2 right-3.5 mt-1 size-3 -translate-y-1/2 text-ink-soft"
          >
            <path d="M2 4.5L6 8.5L10 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="contact-message" className={label}>Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={MIN_CONTACT_MESSAGE}
          maxLength={MAX_CONTACT_MESSAGE}
          rows={6}
          aria-describedby="contact-message-hint"
          disabled={sending}
          className={`${field} resize-y leading-relaxed`}
        />
        <p id="contact-message-hint" className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {MIN_CONTACT_MESSAGE}–{MAX_CONTACT_MESSAGE} characters. For payments include the UTR or
          payment ID; for listings include the address or link.
        </p>
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="mt-5 rounded-[5px] border border-accent/40 border-l-[3px] border-l-accent bg-[#eee5d9] px-4 py-3 text-[14px] leading-relaxed font-semibold text-accent-deep">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-6 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {sending ? "Sending…" : "Send message"}
        {!sending && <span aria-hidden="true">↗</span>}
      </button>
    </form>
  );
}
