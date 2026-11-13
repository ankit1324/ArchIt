import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// catalog.js has no imports: run it whole and read what it exports
const src = readFileSync(new URL('../builder/src/catalog.js', import.meta.url), 'utf8')
  .replace(/^export \{([^}]*)\};?\s*$/m, (_, names) => `globalThis.api = {${names}};`);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { C, roomShell, shellWalls } = ctx.api;

test('the rooms an Indian home plan needs are in the catalog', () => {
  for (const key of ['puja', 'dining', 'toilet', 'store', 'utility', 'study', 'parking', 'terrace']) {
    assert.ok(C.rooms[key], `missing room type ${key}`);
  }
  // types saved designs already use must stay
  for (const key of ['bedroom', 'hall', 'hallway', 'kitchen', 'bath', 'balcony', 'veranda', 'stairs']) {
    assert.ok(C.rooms[key], `existing room type ${key} was removed`);
  }
});

test('every room type can be drawn and resized', () => {
  for (const [key, r] of Object.entries(C.rooms)) {
    assert.match(r.fill, /^#[0-9a-f]{6}$/i, key);
    assert.match(r.floor, /^#[0-9a-f]{6}$/i, key);
    assert.ok(r.w >= C.roomMin && r.len >= C.roomMin, `${key} starts smaller than the ${C.roomMin} m minimum`);
    assert.ok(r.w <= C.roomMax && r.len <= C.roomMax, key);
    assert.ok(['closed', 'balcony', 'veranda', 'porch'].includes(roomShell(key)), key);
  }
});

test('shell decides the walls: closed 4, veranda open at the front, balcony and porch none', () => {
  assert.deepEqual(Array.from(shellWalls('bedroom')), [0, 1, 2, 3]);
  assert.deepEqual(Array.from(shellWalls('puja')), [0, 1, 2, 3]);
  assert.deepEqual(Array.from(shellWalls('veranda')), [1, 2, 3]);
  assert.deepEqual(Array.from(shellWalls('balcony')), []);
  assert.deepEqual(Array.from(shellWalls('parking')), []);
  assert.deepEqual(Array.from(shellWalls('terrace')), []);
});

test('wall-less rooms are open rooms, so they are not asked for a door', () => {
  for (const [key, r] of Object.entries(C.rooms)) {
    if (shellWalls(key).length < 4) assert.equal(r.open, true, `${key} has an open shell but is not marked open`);
  }
  assert.equal(roomShell('parking'), 'porch');   // roofed, on posts
  assert.equal(roomShell('terrace'), 'balcony'); // railed, open to the sky
});
