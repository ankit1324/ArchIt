import "server-only";

/**
 * WhatsApp channel — interface only, for later. lib/notify.ts already calls
 * it next to every email, so wiring a provider (Meta Cloud API, Gupshup,
 * Twilio) means implementing `send` here and nothing else. Template names are
 * what WhatsApp Business requires for business-initiated messages.
 */
export type WhatsAppTemplate =
  | "payment_receipt"
  | "contact_unlocked"
  | "listing_approved"
  | "listing_rejected";

export interface WhatsAppMessage {
  template: WhatsAppTemplate;
  /** Positional template parameters, in the order the approved template uses them. */
  params: string[];
}

export interface WhatsAppChannel {
  /** E.164 phone number, e.g. +919812345678. Resolves false when not sent. */
  send(toE164: string, message: WhatsAppMessage): Promise<boolean>;
}

/** No provider yet: every send is a no-op. */
export const whatsapp: WhatsAppChannel = {
  async send() {
    return false;
  },
};
