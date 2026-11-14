/**
 * Transactional email content. Pure (no env, no I/O) so the wording and the
 * HTML escaping are testable; lib/notify.ts decides who gets what and sends.
 */

export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paise → "₹50" / "₹2,000". */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const PURPOSE_LABELS: Record<string, string> = {
  contact_owner: "Owner contact unlock",
  featured_property: "Featured listing boost",
  builder_unlock: "ArchIt Designer — full builder suite",
  template_unlock: "Designer template",
};

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose] ?? purpose;
}

/**
 * Plain paragraphs → a minimal HTML body. Every value is escaped here, so
 * callers pass raw user content (listing names, reasons) as-is.
 */
function render(subject: string, paragraphs: string[], link?: { href: string; label: string }) {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.href}`] : []), "— ArchIt"].join(
    "\n\n",
  );
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join("");
  const cta = link
    ? `<p style="margin:18px 0"><a href="${escapeHtml(link.href)}" style="background:#3b1d3f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${escapeHtml(link.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#3b1d3f;line-height:1.5;max-width:560px;margin:0 auto;padding:24px"><h2 style="margin:0 0 16px">${escapeHtml(subject)}</h2>${body}${cta}<p style="margin:24px 0 0;color:#7a6a7c;font-size:13px">— ArchIt</p></body></html>`;
  return { subject, text, html };
}

export interface ReceiptInput {
  purpose: string;
  amountPaise: number;
  paymentId: string;
  orderId: string;
  /** What it was for, when there is something to name (listing title, template key). */
  itemName?: string | null;
  paidAt: Date;
  siteUrl: string;
}

export function receiptEmail(r: ReceiptInput): EmailMessage {
  const what = purposeLabel(r.purpose) + (r.itemName ? ` — ${r.itemName}` : "");
  return render(
    `Your ArchIt receipt: ${rupees(r.amountPaise)}`,
    [
      `Thanks for your payment. This email is your receipt.`,
      `Item: ${what}`,
      `Amount: ${rupees(r.amountPaise)} (INR, paid via UPI)`,
      `Payment ID: ${r.paymentId}`,
      `Order ID: ${r.orderId}`,
      `Date: ${r.paidAt.toUTCString()}`,
      `Keep the payment ID for any refund or support request.`,
    ],
    { href: `${r.siteUrl}/contact`, label: "Contact support" },
  );
}

export function contactUnlockedEmail(input: {
  listingName: string;
  siteUrl: string;
}): EmailMessage {
  return render(
    `Someone unlocked your contact on ArchIt`,
    [
      `A buyer just unlocked the owner contact for your listing "${input.listingName}". Expect a call or message soon.`,
      `If the listing is no longer available, please remove it from ArchIt so others don't pay to reach you.`,
    ],
    { href: `${input.siteUrl}/find`, label: "Manage your listings" },
  );
}

export function listingDecisionEmail(input: {
  listingName: string;
  approved: boolean;
  note?: string | null;
  siteUrl: string;
}): EmailMessage {
  if (input.approved) {
    return render(
      `Your listing is live on ArchIt`,
      [`Good news — "${input.listingName}" was approved and is now visible on the map.`],
      { href: `${input.siteUrl}/find`, label: "View it on the map" },
    );
  }
  return render(
    `Your ArchIt listing needs changes`,
    [
      `"${input.listingName}" was not approved and is hidden from the map.`,
      ...(input.note ? [`Reason: ${input.note}`] : []),
      `Edit the listing to fix it and it will go back into review.`,
    ],
    { href: `${input.siteUrl}/find`, label: "Edit your listing" },
  );
}

/** The design's name in a sentence; requests can arrive without one. */
const designLabel = (name: string | null | undefined) => (name ? `"${name}"` : "your home");

/** An admin finished (done) or turned down an AI photo request. */
export function aiPhotoDecisionEmail(input: {
  designName?: string | null;
  done: boolean;
  note?: string | null;
  siteUrl: string;
}): EmailMessage {
  if (input.done) {
    return render(
      `Your AI photo is ready`,
      [`The AI photo of ${designLabel(input.designName)} is ready. Find it on your dashboard under "My AI photos", or in the designer under Save & export, then "AI photo of your home".`],
      { href: `${input.siteUrl}/designer`, label: "Open the designer" },
    );
  }
  return render(
    `We could not make your AI photo`,
    [
      `Sorry, we could not make the AI photo of ${designLabel(input.designName)}.`,
      ...(input.note ? [`Note: ${input.note}`] : []),
      `You can change the view and ask again from the designer.`,
    ],
    { href: `${input.siteUrl}/designer`, label: "Open the designer" },
  );
}

/** Tells the admins a new AI photo request is waiting, so the queue is not left unseen. */
export function aiPhotoRequestedEmail(input: { designName?: string | null; siteUrl: string }): EmailMessage {
  return render(
    `New AI photo request`,
    [`Someone asked for an AI photo of ${designLabel(input.designName)}. It is waiting in the queue.`],
    { href: `${input.siteUrl}/admin/ai-photos`, label: "Open the queue" },
  );
}
