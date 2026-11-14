import assert from "node:assert/strict";
import test from "node:test";

import {
  aiPhotoDecisionEmail,
  aiPhotoRequestedEmail,
  contactUnlockedEmail,
  escapeHtml,
  listingDecisionEmail,
  receiptEmail,
  rupees,
} from "../lib/email-templates.ts";

test("rupees formats paise in Indian grouping", () => {
  assert.equal(rupees(5000), "₹50");
  assert.equal(rupees(200000), "₹2,000");
  assert.equal(rupees(9900), "₹99");
});

test("receipt carries the amount and the ids support needs", () => {
  const m = receiptEmail({
    purpose: "contact_owner",
    amountPaise: 5000,
    paymentId: "pay_123",
    orderId: "contact_owner_abc",
    itemName: "Sukhna View",
    paidAt: new Date("2026-10-23T10:00:00Z"),
    siteUrl: "https://example.test",
  });
  assert.match(m.subject, /₹50/);
  for (const part of ["pay_123", "contact_owner_abc", "Owner contact unlock — Sukhna View", "https://example.test/contact"]) {
    assert.ok(m.text.includes(part), part);
  }
});

test("user content is escaped in HTML but kept raw in text", () => {
  const evil = `<img src=x onerror="alert(1)">`;
  const m = contactUnlockedEmail({ listingName: evil, siteUrl: "https://example.test" });
  assert.ok(!m.html.includes("<img"));
  assert.ok(m.html.includes(escapeHtml(evil)));
  assert.ok(m.text.includes(evil));
});

test("rejection email includes the reason only when given", () => {
  const withNote = listingDecisionEmail({ listingName: "Flat", approved: false, note: "No photos", siteUrl: "https://e.test" });
  assert.match(withNote.text, /Reason: No photos/);
  const without = listingDecisionEmail({ listingName: "Flat", approved: false, siteUrl: "https://e.test" });
  assert.doesNotMatch(without.text, /Reason:/);
  const approved = listingDecisionEmail({ listingName: "Flat", approved: true, siteUrl: "https://e.test" });
  assert.match(approved.subject, /live/);
});

test("AI photo ready email links to the designer", () => {
  const m = aiPhotoDecisionEmail({ designName: "Villa", done: true, siteUrl: "https://e.test" });
  assert.equal(m.subject, "Your AI photo is ready");
  assert.ok(m.text.includes("https://e.test/designer"));
  assert.ok(m.html.includes('href="https://e.test/designer"'));
  assert.ok(m.text.includes('"Villa"'));
});

test("AI photo rejection email carries the note only when given", () => {
  const withNote = aiPhotoDecisionEmail({ designName: "Villa", done: false, note: "Too dark", siteUrl: "https://e.test" });
  assert.match(withNote.subject, /could not make/);
  assert.match(withNote.text, /Note: Too dark/);
  assert.ok(withNote.text.includes("https://e.test/designer"));
  const without = aiPhotoDecisionEmail({ designName: "Villa", done: false, note: null, siteUrl: "https://e.test" });
  assert.doesNotMatch(without.text, /Note:/);
});

test("AI photo emails read fine without a design name", () => {
  const m = aiPhotoDecisionEmail({ designName: "", done: true, siteUrl: "https://e.test" });
  assert.match(m.text, /your home/);
  assert.doesNotMatch(m.text, /""/);
});

test("new AI photo request email points admins at the queue", () => {
  const m = aiPhotoRequestedEmail({ designName: "Villa", siteUrl: "https://e.test" });
  assert.equal(m.subject, "New AI photo request");
  assert.ok(m.text.includes("Villa"));
  assert.ok(m.html.includes('href="https://e.test/admin/ai-photos"'));
});

test("AI photo emails escape design names and notes in HTML", () => {
  const evil = `<img src=x onerror="alert(1)">`;
  for (const m of [
    aiPhotoDecisionEmail({ designName: evil, done: false, note: evil, siteUrl: "https://e.test" }),
    aiPhotoRequestedEmail({ designName: evil, siteUrl: "https://e.test" }),
  ]) {
    assert.ok(!m.html.includes("<img"));
    assert.ok(m.html.includes(escapeHtml(evil)));
    assert.ok(m.text.includes(evil));
  }
});
