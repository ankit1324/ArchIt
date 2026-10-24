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

const field =
  "mt-1 w-full rounded-xl border border-plum/20 bg-white px-3 py-2 text-[15px] text-plum outline-none focus:border-plum focus:ring-2 focus:ring-plum/20 disabled:opacity-60";
const label = "block text-[14px] font-bold text-plum";

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
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-[15px] text-emerald-900">
        <p className="font-bold">Thanks, your message has been sent.</p>
        <p className="mt-1">We&apos;ll reply to the email address you gave us.</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-3 text-[14px] font-semibold underline"
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
      className="relative rounded-2xl border border-plum/10 bg-white/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="mt-4">
        <label htmlFor="contact-topic" className={label}>Topic</label>
        <select id="contact-topic" name="topic" required defaultValue="" disabled={sending} className={field}>
          <option value="" disabled>
            Choose a topic
          </option>
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TOPIC_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
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
          className={field}
        />
        <p id="contact-message-hint" className="mt-1 text-[12px] text-plum-soft">
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
        <p role="alert" className="mt-4 rounded-xl bg-coral/15 p-3 text-[14px] font-semibold text-plum">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="mt-5 w-full rounded-full bg-plum px-6 py-2.5 text-[15px] font-bold text-cream transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
