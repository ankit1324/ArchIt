import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBuilderCsp, buildCsp } from '../lib/csp.ts';
import { builderSource } from '../scripts/builder-source.mjs';

const html = readFileSync(new URL('../public/builder/builder.html', import.meta.url), 'utf8');
const directive = (csp, name) => csp.split('; ').find(d => d.startsWith(name + ' '));

test('builder CSP allows only same-origin scripts', () => {
  for (const isDev of [false, true]) {
    const csp = buildBuilderCsp({ isDev });
    assert.equal(directive(csp, 'script-src'), "script-src 'self'");
    assert.doesNotMatch(csp, /jsdelivr/);
    assert.equal(directive(csp, 'frame-ancestors'), "frame-ancestors 'self'");
  }
  assert.doesNotMatch(buildCsp({ isDev: false, nonce: 'n' }), /jsdelivr/);
});

test('builder.html runs no inline script, so that policy is enough', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.deepEqual(scripts.map(m => m[1].trim()), ['type="module" src="js/builder.js"']);
  assert.ok(scripts.every(m => !m[2].trim()), 'no inline script body');
  assert.doesNotMatch(html, /importmap|cdn\.|\son[a-z]+=/i);
  assert.doesNotMatch(builderSource(), /\son[a-z]+="|cdn\.jsdelivr|unpkg\.com/, 'no inline handlers or CDN imports in builder/src');
});
