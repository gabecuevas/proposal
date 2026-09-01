import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(root, "../src/.prisma-client-version");
fs.writeFileSync(target, String(Date.now()));
