/**
 * Contact form rules. Pure (no "server-only", no env, no imports) so
 * `node --test` can load it directly and the client form can share the
 * limits; app/api/contact does the I/O.
 */

export const CONTACT_TOPICS = ["payment", "listing", "account", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  payment: "Payments & refunds",
  listing: "A listing",
  account: "My account or data",
  other: "Something else",
};

export const MAX_CONTACT_NAME = 100;
export const MAX_CONTACT_EMAIL = 200;
export const MIN_CONTACT_MESSAGE = 10;
export const MAX_CONTACT_MESSAGE = 2000;
/** Generous ceiling for the whole JSON body (the fields above plus slack). */
export const MAX_CONTACT_BYTES = 16 * 1024;

export function isContactTopic(v: unknown): v is ContactTopic {
  return typeof v === "string" && (CONTACT_TOPICS as readonly string[]).includes(v);
}

/** Deliberately loose: one @, no spaces, a dot in the domain. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
}

/**
 * `spam: true` means the honeypot field was filled: the route answers as if
 * the message was accepted (so bots learn nothing) but stores nothing.
 */
export type ContactResult = { spam: true } | ({ spam: false } & ContactInput);

/**
 * Validate a parsed contact-form body. Returns the cleaned input or a
 * human-readable error string (shown to the sender as-is).
 */
export function validateContact(body: unknown): ContactResult | string {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "body must be a JSON object";
  }
  const b = body as Record<string, unknown>;

  // Honeypot: a visually hidden "website" input real people never fill.
  if (b.website !== undefined && b.website !== null && b.website !== "") {
    return { spam: true };
  }

  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return "Please enter your name.";
  if (name.length > MAX_CONTACT_NAME) return `Name must be at most ${MAX_CONTACT_NAME} characters.`;

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email) return "Please enter your email.";
  if (email.length > MAX_CONTACT_EMAIL || !EMAIL_SHAPE.test(email)) {
    return "Please enter a valid email address.";
  }

  const topic = b.topic === undefined || b.topic === "" ? "other" : b.topic;
  if (!isContactTopic(topic)) return "Please pick a topic.";

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < MIN_CONTACT_MESSAGE) {
    return `Message must be at least ${MIN_CONTACT_MESSAGE} characters.`;
  }
  if (message.length > MAX_CONTACT_MESSAGE) {
    return `Message must be at most ${MAX_CONTACT_MESSAGE} characters.`;
  }

  return { spam: false, name, email, topic, message };
}

/** Business fields still holding a "[PLACEHOLDER]" value aren't shown. */
export function isPlaceholder(v: string | null | undefined): boolean {
  return !v || /^\[.*\]$/.test(v.trim());
}

/** A mailto: reply link for an inbox message (subject prefilled). */
export function replyHref(email: string, topic: string): string {
  const label = isContactTopic(topic) ? CONTACT_TOPIC_LABELS[topic] : "your message";
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(
    `Re: ${label} (ArchIt support)`,
  )}`;
}
