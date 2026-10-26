// Who we are and how to reach us — the single source of truth for /contact,
// /pricing and the legal pages (/terms, /privacy, /refunds). Replace a
// bracketed placeholder below with the real value and every page picks it up;
// while a value is still a placeholder the pages render neutral wording (or
// omit the sentence) instead of printing the brackets.
//
// Import-free on purpose: tests load this file directly with Node.
export const BUSINESS = {
  legalName: "[LEGAL ENTITY NAME]",
  address: "[REGISTERED ADDRESS]",
  supportEmail: "[SUPPORT EMAIL]",
  supportPhone: "[SUPPORT PHONE]",
  grievanceOfficer: "[GRIEVANCE OFFICER NAME]",
  /** GST registration number, shown in the Terms preamble once filled. */
  gstin: "[GST NUMBER]",
  /** City whose courts have jurisdiction under the Terms. */
  jurisdictionCity: "[JURISDICTION CITY]",
  /** "Last updated" date shown on /terms, /privacy and /refunds. */
  lastUpdated: "24 October 2026",
  /** Business-hours promise shown on /contact. */
  responseTime: "within 2 business days",
} as const;

/** True once supportEmail is a real address (so it can be a mailto: link). */
export const hasSupportEmail = BUSINESS.supportEmail.includes("@");

/**
 * True while a BUSINESS value is still unfilled: empty/whitespace, or a
 * bracketed placeholder such as "[SUPPORT EMAIL]".
 */
export function isPlaceholder(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || /^\[[^\]]*\]$/.test(v);
}

/** The value once it is real, otherwise null — handy for `filled(x) && …`. */
export function filled(value: string | null | undefined): string | null {
  return isPlaceholder(value) ? null : (value as string).trim();
}

/** The value once it is real, otherwise the given neutral fallback text. */
export function orFallback(
  value: string | null | undefined,
  fallback: string,
): string {
  return filled(value) ?? fallback;
}

/** Entity name for legal copy: the registered name, or a neutral phrase. */
export const legalEntityName = orFallback(
  BUSINESS.legalName,
  "the operator of ArchIt",
);
