import assert from "node:assert/strict";
import test from "node:test";
import { contactLinks, formatPhone, parseContact } from "../lib/contact-links.ts";

const hrefs = (contact, message) => contactLinks(contact, message).map((l) => l.href);

test("10-digit Indian mobiles get +91 for tel: and WhatsApp", () => {
  assert.deepEqual(hrefs("9876543210"), ["tel:+919876543210", "https://wa.me/919876543210"]);
  assert.deepEqual(hrefs("Ravi Kumar, 98765 43210"), ["tel:+919876543210", "https://wa.me/919876543210"]);
  assert.deepEqual(hrefs("98765-43210"), ["tel:+919876543210", "https://wa.me/919876543210"]);
});

test("domestic prefixes 0 and 91 are normalised to the same number", () => {
  assert.deepEqual(parseContact("09876543210"), { phone: "+919876543210", whatsapp: "919876543210", email: null });
  assert.deepEqual(parseContact("91 98765 43210"), { phone: "+919876543210", whatsapp: "919876543210", email: null });
  assert.deepEqual(parseContact("+91 98765 43210"), { phone: "+919876543210", whatsapp: "919876543210", email: null });
  assert.deepEqual(parseContact("0091 98765 43210").whatsapp, "919876543210");
});

test("explicit international numbers keep their country code", () => {
  assert.deepEqual(hrefs("+44 20 7946 0958"), ["tel:+442079460958", "https://wa.me/442079460958"]);
  assert.deepEqual(hrefs("+1 (415) 555-0132"), ["tel:+14155550132", "https://wa.me/14155550132"]);
});

test("landlines are callable but not offered on WhatsApp", () => {
  assert.deepEqual(hrefs("0172 270 0000"), ["tel:01722700000"]);
  assert.deepEqual(hrefs("+91 172 270 0000"), ["tel:+911722700000"]);
});

test("email addresses become mailto: links, digits inside them are not a phone", () => {
  assert.deepEqual(hrefs("owner2024@example.co.in"), ["mailto:owner2024@example.co.in"]);
  assert.deepEqual(hrefs("Asha — asha.k@mail.com / 9812345678"), [
    "tel:+919812345678",
    "https://wa.me/919812345678",
    "mailto:asha.k@mail.com",
  ]);
});

test("a message pre-fills the WhatsApp text and the email subject", () => {
  assert.deepEqual(hrefs("9876543210 a@b.co", "Hi, about Sunrise Tower & more"), [
    "tel:+919876543210",
    "https://wa.me/919876543210?text=Hi%2C%20about%20Sunrise%20Tower%20%26%20more",
    "mailto:a@b.co?subject=Hi%2C%20about%20Sunrise%20Tower%20%26%20more",
  ]);
});

test("names, short numbers and empty input produce no links", () => {
  assert.deepEqual(contactLinks("Ravi Kumar"), []);
  assert.deepEqual(contactLinks("Flat 12, Sector 17"), []);
  assert.deepEqual(contactLinks(""), []);
  assert.deepEqual(contactLinks(undefined), []);
  assert.deepEqual(contactLinks(null), []);
  // a 16+ digit run is not a phone number
  assert.deepEqual(contactLinks("1234567890123456"), []);
});

test("labels and display text are human-readable", () => {
  assert.deepEqual(
    contactLinks("9876543210 x@y.in").map(({ kind, label, display }) => [kind, label, display]),
    [
      ["call", "Call", "+91 98765 43210"],
      ["whatsapp", "WhatsApp", "+91 98765 43210"],
      ["email", "Email", "x@y.in"],
    ],
  );
  assert.equal(formatPhone("+442079460958"), "+442079460958");
});
