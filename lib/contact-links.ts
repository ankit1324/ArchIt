/**
 * Turns a listing's free-text owner contact ("Ravi 98765 43210",
 * "+44 20 7946 0958 / ravi@example.com", …) into tappable links: tel:,
 * WhatsApp (wa.me) and mailto:. Pure and import-free, so it runs in client
 * code and directly under `node --test`.
 *
 * Numbers without a country code are read as Indian: a 10-digit mobile
 * (starting 6–9), optionally written with a leading 0 or 91, becomes +91….
 * WhatsApp is only offered for numbers that can be on it: Indian mobiles and
 * explicit international (+ / 00) numbers. A domestic landline ("0172 …")
 * still gets a tel: link, dialled as written.
 */

export type ContactLinkKind = "call" | "whatsapp" | "email";

export interface ContactLink {
  kind: ContactLinkKind;
  href: string;
  /** button text: "Call", "WhatsApp", "Email" */
  label: string;
  /** the number / address the link targets, formatted for display */
  display: string;
}

export interface ParsedContact {
  /** E.164 ("+919876543210") when the country is known, else digits as written */
  phone: string | null;
  /** digits for https://wa.me/<digits>; null when it cannot be on WhatsApp */
  whatsapp: string | null;
  email: string | null;
}

// conservative: no spaces, quotes or brackets in either part, a dotted domain
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
// a run of digits with the usual separators, optionally led by + (7+ digits)
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** one phone-looking run → { phone, whatsapp }, or null if it isn't a number */
function parsePhone(raw: string): Pick<ParsedContact, "phone" | "whatsapp"> | null {
  let digits = raw.replace(/\D/g, "");
  let international = raw.trim().startsWith("+");
  if (!international && digits.startsWith("00")) {
    // 00 is the international dialling prefix in India and most of the world
    digits = digits.slice(2);
    international = true;
  }
  if (digits.length < 7 || digits.length > 15) return null;

  if (international) {
    // +91 with a non-mobile national number is a landline: callable only
    if (digits.startsWith("91") && digits.length === 12 && !INDIAN_MOBILE.test(digits.slice(2))) {
      return { phone: `+${digits}`, whatsapp: null };
    }
    return { phone: `+${digits}`, whatsapp: digits };
  }
  // Indian mobile written domestically: 98765 43210, 098765 43210, 91 98765 43210
  const national =
    digits.length === 10 ? digits
    : digits.length === 11 && digits.startsWith("0") ? digits.slice(1)
    : digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
    : null;
  if (national && INDIAN_MOBILE.test(national)) {
    return { phone: `+91${national}`, whatsapp: `91${national}` };
  }
  // a landline with its STD code, or something we can't place: dial as written
  return { phone: digits, whatsapp: null };
}

/** the first phone number and the first email address found in `contact` */
export function parseContact(contact: string | null | undefined): ParsedContact {
  const text = (contact ?? "").trim();
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  // don't read digits inside the email address as a phone number
  const rest = email ? text.replace(email, " ") : text;
  let phone: ParsedContact["phone"] = null;
  let whatsapp: ParsedContact["whatsapp"] = null;
  for (const match of rest.matchAll(PHONE_RE)) {
    const parsed = parsePhone(match[0]);
    if (parsed) {
      ({ phone, whatsapp } = parsed);
      break;
    }
  }
  return { phone, whatsapp, email };
}

/** "+919876543210" → "+91 98765 43210"; anything else is returned unchanged */
export function formatPhone(phone: string): string {
  const m = /^\+91([6-9]\d{4})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

/**
 * Links for a contact string, in display order (call, WhatsApp, email).
 * `message` pre-fills the WhatsApp chat and the email subject.
 */
export function contactLinks(
  contact: string | null | undefined,
  message?: string,
): ContactLink[] {
  const { phone, whatsapp, email } = parseContact(contact);
  const links: ContactLink[] = [];
  if (phone) {
    links.push({ kind: "call", href: `tel:${phone}`, label: "Call", display: formatPhone(phone) });
  }
  if (whatsapp) {
    const text = message ? `?text=${encodeURIComponent(message)}` : "";
    links.push({
      kind: "whatsapp",
      href: `https://wa.me/${whatsapp}${text}`,
      label: "WhatsApp",
      display: formatPhone(`+${whatsapp}`),
    });
  }
  if (email) {
    const subject = message ? `?subject=${encodeURIComponent(message)}` : "";
    links.push({
      kind: "email",
      href: `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}${subject}`,
      label: "Email",
      display: email,
    });
  }
  return links;
}
