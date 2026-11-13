// Loads builder/src/units.js into a vm with a stand-in `state`, so tests can run
// the real unit helpers (the file imports state.js, which pulls in the DOM).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../builder/src/units.js', import.meta.url), 'utf8');

export function loadUnits(unit = 'm') {
  const body = SRC
    .replace(/^import .*$/gm, '')
    .replace(/^export \{([^}]*)\};?\s*$/m, (_, names) => `globalThis.api = {${names}};`);
  const ctx = { state: { unit } };
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  return { ...ctx.api, setUnit(u) { ctx.state.unit = u; } };
}
