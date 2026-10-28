import { existsSync, readFileSync } from 'node:fs';
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

test('builder fonts are self-hosted: no Google Fonts in its CSP or markup', () => {
  for (const isDev of [false, true]) {
    const csp = buildBuilderCsp({ isDev });
    assert.doesNotMatch(csp, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.equal(directive(csp, 'font-src'), "font-src 'self'");
    assert.equal(directive(csp, 'style-src'), "style-src 'self' 'unsafe-inline'");
  }
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  const font = html.match(/url\((fonts\/[^)]+\.woff2)\)/)?.[1];
  assert.ok(font, 'builder.html declares an @font-face from fonts/');
  assert.ok(existsSync(new URL(`../public/builder/${font}`, import.meta.url)), `${font} is checked in`);
});

test('builder.html runs no inline script, so that policy is enough', () => {
  // exactly one script element, and it is the bundle with an empty body
  assert.equal(html.match(/<script\b/gi)?.length, 1);
  assert.ok(html.includes('<script type="module" src="js/builder.js"></script>'));
  assert.doesNotMatch(html, /importmap|cdn\.|\son[a-z]+=/i);
  assert.doesNotMatch(builderSource(), /\son[a-z]+="|cdn\.jsdelivr|unpkg\.com/, 'no inline handlers or CDN imports in builder/src');
});
