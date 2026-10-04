import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const skip = new Set(["node_modules", ".next", ".git", ".vercel"]);
const findings = [];
const patterns = [
  { name: "postgres URL with inline credentials", re: /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@/gi },
  { name: "private key header", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "common API key assignment", re: /(?:api[_-]?key|secret[_-]?key|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/gi }
];

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (entry.name.startsWith(".env")) continue;
    const stat = await fs.stat(full);
    if (stat.size > 1_000_000) continue;
    let text;
    try { text = await fs.readFile(full, "utf8"); } catch { continue; }
    for (const pattern of patterns) {
      if (pattern.re.test(text)) findings.push(`${path.relative(root, full)}: ${pattern.name}`);
      pattern.re.lastIndex = 0;
    }
  }
}

await walk(root);
if (findings.length) {
  console.error("비밀값 후보가 발견되었습니다:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("소스/배포 대상 파일에서 비밀값 원문 후보 0건");
