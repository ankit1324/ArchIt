import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Found on the live site: admin pages loaded no Clerk browser script, so the
// session token expired about a minute after load and every admin button got
// 401 from proxy.ts. Mounting ClerkProvider keeps the token fresh.
test('the admin section mounts Clerk so its session stays fresh', () => {
  const layout = read('app/admin/layout.tsx');
  assert.match(layout, /import \{ ClerkProvider \} from "@clerk\/nextjs";/);
  assert.match(layout, /<ClerkProvider nonce=\{nonce\}>/);
  assert.match(layout, /headers\(\)\)\.get\("x-nonce"\)/);   // scripts must pass the per-request CSP
});

test('admin buttons explain an expired sign-in instead of "unauthorized"', () => {
  for (const file of ['app/admin/AdminAction.tsx', 'app/admin/ai-photos/AiPhotoTools.tsx']) {
    assert.match(read(file), /res\.status === 401[\s\S]{0,80}sign-in expired/, file);
  }
});

test('/admin keeps the per-request nonce CSP Clerk needs', () => {
  assert.match(read('proxy.ts'), /"\/admin",/);
});
