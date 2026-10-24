import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_TOPICS,
  MAX_CONTACT_EMAIL,
  MAX_CONTACT_MESSAGE,
  MAX_CONTACT_NAME,
  MIN_CONTACT_MESSAGE,
  isContactTopic,
  isPlaceholder,
  replyHref,
  validateContact,
} from "../lib/contact.ts";

const good = {
  name: "Asha Rao",
  email: "asha@example.com",
  topic: "payment",
  message: "My payment went through but the listing is still locked.",
};

test("accepts a well-formed message and trims it", () => {
  const out = validateContact({
    ...good,
    name: "  Asha   Rao ",
    email: " asha@example.com ",
    message: `  ${good.message}\n`,
  });
  assert.deepEqual(out, { spam: false, ...good });
});

test("honeypot: a filled website field is spam, regardless of the rest", () => {
  assert.deepEqual(validateContact({ ...good, website: "http://spam.example" }), { spam: true });
  assert.deepEqual(validateContact({ website: "x" }), { spam: true });
});

test("an empty or missing honeypot is fine", () => {
  assert.equal(validateContact({ ...good, website: "" }).spam, false);
  assert.equal(validateContact({ ...good, website: null }).spam, false);
  assert.equal(validateContact(good).spam, false);
});

test("rejects non-object bodies", () => {
  for (const b of [null, "hi", 3, [good]]) assert.equal(typeof validateContact(b), "string");
});

test("name is required and capped", () => {
  assert.match(validateContact({ ...good, name: "   " }), /name/i);
  assert.match(validateContact({ ...good, name: 42 }), /name/i);
  assert.equal(validateContact({ ...good, name: "a".repeat(MAX_CONTACT_NAME) }).spam, false);
  assert.match(validateContact({ ...good, name: "a".repeat(MAX_CONTACT_NAME + 1) }), /name/i);
});

test("email must look like an email and fit", () => {
  for (const email of ["", "asha", "asha@", "@example.com", "a b@example.com", "asha@example", "a@@b.co"]) {
    assert.equal(typeof validateContact({ ...good, email }), "string", email);
  }
  const long = `${"a".repeat(MAX_CONTACT_EMAIL)}@example.com`;
  assert.match(validateContact({ ...good, email: long }), /email/i);
  assert.equal(validateContact({ ...good, email: "a.b+tag@mail.example.co.in" }).spam, false);
});

test("topic must be one of the known topics; missing defaults to other", () => {
  for (const topic of CONTACT_TOPICS) assert.equal(validateContact({ ...good, topic }).topic, topic);
  assert.equal(validateContact({ ...good, topic: undefined }).topic, "other");
  assert.equal(validateContact({ ...good, topic: "" }).topic, "other");
  assert.match(validateContact({ ...good, topic: "billing" }), /topic/i);
  assert.match(validateContact({ ...good, topic: 1 }), /topic/i);
});

test("message length is bounded after trimming", () => {
  assert.match(validateContact({ ...good, message: "short" }), /at least/);
  assert.match(validateContact({ ...good, message: `   ${"a".repeat(MIN_CONTACT_MESSAGE - 1)}   ` }), /at least/);
  assert.equal(validateContact({ ...good, message: "a".repeat(MIN_CONTACT_MESSAGE) }).spam, false);
  assert.equal(validateContact({ ...good, message: "a".repeat(MAX_CONTACT_MESSAGE) }).spam, false);
  assert.match(validateContact({ ...good, message: "a".repeat(MAX_CONTACT_MESSAGE + 1) }), /at most/);
  assert.match(validateContact({ ...good, message: null }), /at least/);
});

test("unknown fields are dropped", () => {
  const out = validateContact({ ...good, user_id: "user_evil", status: "handled" });
  assert.deepEqual(Object.keys(out).sort(), ["email", "message", "name", "spam", "topic"]);
});

test("isContactTopic", () => {
  assert.ok(isContactTopic("listing"));
  assert.ok(!isContactTopic("LISTING"));
  assert.ok(!isContactTopic(undefined));
});

test("isPlaceholder spots bracketed business fields", () => {
  assert.ok(isPlaceholder("[SUPPORT EMAIL]"));
  assert.ok(isPlaceholder(" [REGISTERED ADDRESS] "));
  assert.ok(isPlaceholder(""));
  assert.ok(!isPlaceholder("support@archit.in"));
  assert.ok(!isPlaceholder("Flat [2B], Pune"));
});

test("replyHref builds a mailto with a subject", () => {
  const href = replyHref("asha@example.com", "payment");
  assert.ok(href.startsWith("mailto:asha@example.com?subject="));
  assert.match(decodeURIComponent(href), /Re: Payments & refunds/);
  // A crafted address can't smuggle extra mailto params.
  assert.ok(!replyHref("a@b.co?bcc=x@y.co", "other").includes("?bcc="));
});
