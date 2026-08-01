import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/MarketingLanding.tsx", import.meta.url), "utf8");

assert.match(source, /<dialog[\s\S]*id="mobile-menu"[\s\S]*onCancel=/);
assert.match(source, /aria-controls="mobile-menu"/);
assert.doesNotMatch(source, /className=.*m-scrim/);
assert.equal(source.match(/preload="metadata"/g)?.length, 1);
assert.equal(source.match(/preload="none"/g)?.length, 7);

console.log("Marketing landing checks passed");
