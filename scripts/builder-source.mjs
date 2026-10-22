// The builder engine's source text (builder/src/*.js, concatenated). Scripts and
// tests parse the catalog and lift engine functions out of it verbatim, so what
// they check is exactly what public/builder/builder.html runs once bundled.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BUILDER_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "builder", "src");

export function builderSource() {
  return readdirSync(BUILDER_SRC)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => readFileSync(join(BUILDER_SRC, f), "utf8"))
    .join("\n");
}
