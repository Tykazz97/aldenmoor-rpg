// Lance la validation des données puis tous les tests, et résume :  npm test
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = ["validate-data.js", ...readdirSync("scripts").filter((f) => /^test-.*\.js$/.test(f)).sort()];
const failed = [];
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [`scripts/${f}`], { encoding: "utf8" });
  const ok = r.status === 0;
  console.log(`${ok ? "✓" : "✗"} ${f.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!ok) { failed.push(f); console.log((r.stdout + r.stderr).split("\n").map((l) => "    " + l).join("\n")); }
}
console.log(failed.length ? `\n${failed.length} fichier(s) en échec : ${failed.join(", ")}` : `\nTout passe (${files.length} fichiers).`);
process.exit(failed.length ? 1 : 0);
