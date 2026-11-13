import bcrypt from "bcryptjs";
import fs from "node:fs";

const raw = fs.readFileSync(process.env.HASH_FILE, "utf8");
const m = raw.match(/\$2[aby]\$10\$[A-Za-z0-9/$.]+/);
if (!m) {
  console.log("no se encontró hash");
  process.exit(1);
}
const hash = m[0].replace(/\\u005c/g, "").trim();
console.log("hash:", hash.slice(0, 20) + "…");
const candidatos = [
  "Chejo,2026$#", "Chejo,2026", "Chejo,2026#",
  "Chejo,2026$#", "Chejo,2026`$#", "Chejo,2026\\$#", "Chejo,$#2026",
  "Chejo,2026$ ", "Chejo,2026$x", "Chejo,2026$$#",
];
for (const c of candidatos) {
  console.log(JSON.stringify(c), "→", bcrypt.compareSync(c, hash) ? "MATCH" : "no");
}
