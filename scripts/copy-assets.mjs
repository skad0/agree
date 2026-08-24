// Cross-platform asset copy for `npm run build` — the previous `mkdir -p && cp` failed on Windows.
import { mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = "dist/src/assets";
mkdirSync(out, { recursive: true });
for (const file of readdirSync("src/assets")) if (file.endsWith(".woff2")) copyFileSync(join("src/assets", file), join(out, file));
