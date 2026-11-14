import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanDesignName, cleanNote, extForMime, isRequestId, mimeForPath, sniffImage, toAiPhotoItem,
  MAX_PENDING_REQUESTS, MAX_REQUESTS_PER_DAY,
} from '../lib/ai-photos.ts';
import { builderSource } from '../scripts/builder-source.mjs';

const ID = '0b9f6e0a-3c1d-4f7e-9a55-2d0c8e4b7a11';
const row = (over = {}) => ({
  id: ID, user_id: 'user_secret', design_name: 'My home', place: 'Pune', prompt: 'SECRET PROMPT',
  input_path: 'in/abc.jpg', result_path: null, status: 'pending', admin_note: null,
  created_at: '2026-11-14T10:00:00Z', completed_at: null, ...over,
});

/* ============================== what the requester sees ============================== */
test('a waiting request shows no picture', () => {
  const it = toAiPhotoItem(row());
  assert.equal(it.status, 'pending'); assert.equal(it.image, null); assert.equal(it.note, null);
});

test('a finished request points at the same-origin picture route', () => {
  const it = toAiPhotoItem(row({ status: 'done', result_path: 'out/x.png', completed_at: '2026-11-15T09:00:00Z' }));
  assert.equal(it.image, `/api/ai-photos/${ID}/image`);
  assert.equal(it.completedAt, '2026-11-15T09:00:00Z');
});

test('a note is shown only for a request that was turned down', () => {
  assert.equal(toAiPhotoItem(row({ status: 'rejected', admin_note: 'Too dark to paint' })).note, 'Too dark to paint');
  assert.equal(toAiPhotoItem(row({ status: 'done', result_path: 'out/x.png', admin_note: 'internal' })).note, null);
});

test('a replaced photo gets a new URL, so nobody keeps seeing the old one', () => {
  const a = toAiPhotoItem(row({ status: 'done', result_path: `out/${ID}-1111aaaa-2222-4333-8444-5555aaaabbbb.png` })).image;
  const b = toAiPhotoItem(row({ status: 'done', result_path: `out/${ID}-1111aaaa-2222-4333-8444-6666ccccdddd.jpg` })).image;
  assert.equal(a, `/api/ai-photos/${ID}/image?v=5555aaaabbbb`);
  assert.notEqual(a, b);
});

test('done without a stored result still shows no picture', () => {
  assert.equal(toAiPhotoItem(row({ status: 'done', result_path: null })).image, null);
});

test('the prompt, storage paths and user id never reach the requester', () => {
  const text = JSON.stringify(toAiPhotoItem(row({ status: 'done', result_path: 'out/secret-path.png' })));
  for (const leak of ['SECRET PROMPT', 'user_secret', 'in/abc.jpg', 'secret-path', 'Pune']) assert.ok(!text.includes(leak), leak);
});

/* ============================== input cleaning ============================== */
test('request ids are UUIDs, nothing else', () => {
  assert.equal(isRequestId(ID), true);
  for (const bad of ['', '1', '../etc/passwd', ID + '/x', ID.replace('0', 'g'), null, 7]) assert.equal(isRequestId(bad), false, String(bad));
});

test('design names are one plain line of at most 80 characters', () => {
  assert.equal(cleanDesignName('  My\n home\t2  '), 'My home 2');
  assert.equal(cleanDesignName('<img src=x onerror=alert(1)>'), 'img src=x onerror=alert(1)');
  assert.ok(cleanDesignName('x'.repeat(300)).length <= 80);
  assert.equal(cleanDesignName(undefined), ''); assert.equal(cleanDesignName(12), '');
});

test('an admin note is trimmed to one line of 300 characters', () => {
  assert.equal(cleanNote(' The plan\nhas no rooms '), 'The plan has no rooms');
  assert.ok(cleanNote('y'.repeat(900)).length <= 300);
  assert.equal(cleanNote(null), '');
});

test('images are recognised by their bytes', () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)])), 'image/webp');
  assert.equal(sniffImage(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(sniffImage(Buffer.from('GIF89a')), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
});

test('stored object names map back to the type they were written as', () => {
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(mimeForPath(`out/x.${extForMime(mime)}`), mime);
  assert.equal(mimeForPath('out/x.html'), 'application/octet-stream');   // never served as a page
  assert.equal(extForMime('image/svg+xml'), undefined);
});

test('limits are small: each request is work for a person', () => {
  assert.ok(MAX_PENDING_REQUESTS >= 1 && MAX_PENDING_REQUESTS <= 5);
  assert.ok(MAX_REQUESTS_PER_DAY >= MAX_PENDING_REQUESTS && MAX_REQUESTS_PER_DAY <= 10);
});

/* ============================== storage and table ============================== */
test('the pictures live in a private bucket and the table is service-role only', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261114100000_ai_photo_requests.sql', import.meta.url), 'utf8');
  assert.match(sql, /VALUES \('ai-photos', 'ai-photos', false,/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.ai_photo_requests TO service_role;/);
  assert.doesNotMatch(sql, /TO (anon|authenticated)/);
});

test('the caps are enforced in the database too, with the same numbers', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261114100000_ai_photo_requests.sql', import.meta.url), 'utf8');
  assert.match(sql, /BEFORE INSERT ON public\.ai_photo_requests/);
  assert.match(sql, /pg_advisory_xact_lock\(/);                       // serialises one user's inserts
  assert.match(sql, new RegExp(`status = 'pending'\\) >= ${MAX_PENDING_REQUESTS} THEN`));
  assert.match(sql, new RegExp(`interval '1 day'\\) >= ${MAX_REQUESTS_PER_DAY} THEN`));
  const route = readFileSync(new URL('../app/api/ai-photos/route.ts', import.meta.url), 'utf8');
  for (const tag of ['ai_photo_pending_cap', 'ai_photo_daily_cap']) {
    assert.ok(sql.includes(tag) && route.includes(tag), `${tag} must be raised by the trigger and handled by the route`);
  }
});

test('no route generates a picture for an ordinary user', () => {
  // the image model is reachable only from the admin route
  const userRoute = readFileSync(new URL('../app/api/ai-photos/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(userRoute, /renderImage|GEMINI_API_KEY/);
  const adminRoute = readFileSync(new URL('../app/api/admin/ai-photos/[id]/route.ts', import.meta.url), 'utf8');
  assert.match(adminRoute, /requireAdmin\(\)/);
  assert.match(adminRoute, /renderImage/);
});

/* ============================== the builder's "Your AI photos" list ============================== */
const src = builderSource();
function lift(name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `builder source has no function ${name}()`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}()`);
}
const constLine = (name) => { const m = src.match(new RegExp(`^const ${name} = .*;$`, 'm')); assert.ok(m, name); return m[0]; };
const ctx = { aiItems: null };
vm.createContext(ctx);
vm.runInContext([constLine('AI_STATUS'), constLine('AI_IMAGE_URL'), lift('escapeMarkup'), lift('cleanAiItems'), lift('aiListHTML'),
  'let aiItems = null, aiListFailed = false; globalThis.api = {cleanAiItems, list(items, failed = false){ aiItems = items; aiListFailed = failed; return aiListHTML(); }};'].join('\n'), ctx);
const { cleanAiItems, list } = ctx.api;

test('the list only links to our own picture route', () => {
  const items = cleanAiItems([
    { status: 'done', designName: 'A', createdAt: '2026-11-14T10:00:00Z', image: `/api/ai-photos/${ID}/image` },
    { status: 'done', designName: 'B', image: 'https://evil.example/x.png' },
    { status: 'done', designName: 'C', image: 'javascript:alert(1)' },
    { status: 'done', designName: 'D', image: `/api/ai-photos/${ID}/image?x="><script>` },
  ]);
  assert.deepEqual(Array.from(items, (i) => i.image), [`/api/ai-photos/${ID}/image`, null, null, null]);
  // a versioned URL is ours too, and its download link keeps the version
  const v = cleanAiItems([{ status: 'done', designName: 'V', image: `/api/ai-photos/${ID}/image?v=5555aaaabbbb` }]);
  assert.equal(v[0].image, `/api/ai-photos/${ID}/image?v=5555aaaabbbb`);
  assert.match(list(v), /image\?v=5555aaaabbbb&amp;download=1|image\?v=5555aaaabbbb&download=1/);
  const html = list(items);
  assert.ok(!html.includes('evil.example') && !html.includes('javascript:') && !html.includes('<script>'));
});

test('names and notes are escaped, unknown statuses dropped', () => {
  const items = cleanAiItems([
    { status: 'rejected', designName: '<b onmouseover=x>Home</b>', note: '"><img src=x onerror=alert(1)>' },
    { status: 'weird', designName: 'gone' }, null, 'x',
  ]);
  assert.equal(items.length, 1);
  const html = list(items);
  assert.ok(!/<b onmouseover|<img src=x/.test(html), html);
  assert.match(html, /Could not be made/);
});

test('loading, empty and waiting states read plainly', () => {
  assert.match(list(null), /Loading your photos/);
  assert.match(list([]), /not asked for a photo yet/);
  const html = list(cleanAiItems([{ status: 'pending', designName: 'My home', createdAt: '2026-11-14T10:00:00Z' }]));
  assert.match(html, /Being made/); assert.match(html, /aiwait/); assert.ok(!html.includes('<img'));
});

test('a failed load says so instead of "none yet"', () => {
  const html = list([], true);
  assert.match(html, /Could not load your photos/);
  assert.doesNotMatch(html, /not asked for a photo yet/);
});

test('a turned-down request does not look like one still being made', () => {
  const html = list(cleanAiItems([{ status: 'rejected', designName: 'X' }]));
  assert.match(html, /aiwait aino/);
});

test('junk from the page is an empty list, never a crash', () => {
  for (const junk of [undefined, null, 'x', 7, {}]) assert.equal(cleanAiItems(junk).length, 0);
});
