// Who to reach — one place, used by /contact and /pricing. The legal pages
// (/terms, /privacy, /refunds) still carry the same bracketed placeholders
// inline; fill these and those together before launch.
export const BUSINESS = {
  legalName: "[LEGAL ENTITY NAME]",
  address: "[REGISTERED ADDRESS]",
  supportEmail: "[SUPPORT EMAIL]",
  supportPhone: "[SUPPORT PHONE]",
  grievanceOfficer: "[GRIEVANCE OFFICER NAME]",
  /** Business-hours promise shown on /contact. */
  responseTime: "within 2 business days",
} as const;

/** True once supportEmail is a real address (so it can be a mailto: link). */
export const hasSupportEmail = BUSINESS.supportEmail.includes("@");
