import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { after } from "next/server";
import { db } from "./db";
import { sendEmail } from "./email";
import {
  contactUnlockedEmail,
  listingDecisionEmail,
  receiptEmail,
  type EmailMessage,
} from "./email-templates";
import type { LedgerRow } from "./record-purchase";
import { whatsapp, type WhatsAppMessage } from "./whatsapp";

/**
 * Who gets told what, after the fact. Recipients come from Clerk (the app
 * stores no emails of its own). Every function here is best-effort and never
 * throws — the purchase or moderation action it follows has already happened.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://archit.chaudharyankit.in").replace(
  /\/$/,
  "",
);

interface Contact {
  email: string | null;
  phone: string | null;
}

async function contactFor(userId: string): Promise<Contact> {
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return {
      email: user.primaryEmailAddress?.emailAddress ?? null,
      phone: user.primaryPhoneNumber?.phoneNumber ?? null,
    };
  } catch (e) {
    console.error(`notify: Clerk lookup for ${userId} failed:`, e instanceof Error ? e.message : e);
    return { email: null, phone: null };
  }
}

async function deliver(userId: string, email: EmailMessage, wa: WhatsAppMessage) {
  const contact = await contactFor(userId);
  if (contact.email) await sendEmail(contact.email, email);
  else console.info(`notify: no email on file for ${userId}, skipped "${email.subject}"`);
  if (contact.phone) await whatsapp.send(contact.phone, wa);
}

async function listingInfo(id: string) {
  const { data } = await db
    .from("properties")
    .select("building_name, address, user_id")
    .eq("id", id)
    .maybeSingle<{ building_name: string | null; address: string; user_id: string | null }>();
  if (!data) return null;
  return { name: data.building_name || data.address, listerId: data.user_id };
}

/**
 * Run after the response is sent (Next `after`), so a slow Clerk or Resend
 * call never delays checkout confirmation. Outside a request scope — which
 * shouldn't happen, every caller is a route — fall back to fire-and-forget.
 */
export function afterResponse(task: () => Promise<void>) {
  const safe = () =>
    task().catch((e) => console.error("notify task failed:", e instanceof Error ? e.message : e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/**
 * A purchase was just recorded: email the buyer a receipt and, for a contact
 * unlock, tell the lister a buyer is about to get in touch.
 */
export async function notifyPurchaseRecorded(row: LedgerRow): Promise<void> {
  const listing =
    row.ref && (row.purpose === "contact_owner" || row.purpose === "featured_property")
      ? await listingInfo(row.ref)
      : null;
  const itemName = listing?.name ?? (row.purpose === "template_unlock" ? row.ref : null);

  await deliver(
    row.user_id,
    receiptEmail({
      purpose: row.purpose,
      amountPaise: row.amount,
      paymentId: row.payment_id,
      orderId: row.order_id,
      itemName,
      paidAt: new Date(),
      siteUrl: SITE_URL,
    }),
    { template: "payment_receipt", params: [String(row.amount / 100), row.payment_id] },
  );

  if (row.purpose === "contact_owner" && listing?.listerId && listing.listerId !== row.user_id) {
    await deliver(
      listing.listerId,
      contactUnlockedEmail({ listingName: listing.name, siteUrl: SITE_URL }),
      { template: "contact_unlocked", params: [listing.name] },
    );
  }
}

/** An admin approved or rejected a listing (or took it down after a report). */
export async function notifyListingDecision(input: {
  listerId: string | null;
  listingName: string;
  approved: boolean;
  note?: string | null;
}): Promise<void> {
  if (!input.listerId) return;
  await deliver(
    input.listerId,
    listingDecisionEmail({ ...input, siteUrl: SITE_URL }),
    {
      template: input.approved ? "listing_approved" : "listing_rejected",
      params: [input.listingName, ...(input.note ? [input.note] : [])],
    },
  );
}
