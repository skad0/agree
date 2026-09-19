import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sourceDir = join("src", "assets");
const targetDir = join("dist", "src", "assets");
mkdirSync(targetDir, { recursive: true });
for (const name of readdirSync(sourceDir).filter((entry) => /\.(woff2|png)$/.test(entry))) {
  copyFileSync(join(sourceDir, name), join(targetDir, name));
}
