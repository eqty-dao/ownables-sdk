import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const MAX_CLASS_LENGTH = 120;
const DUPLICATE_LITERAL_MIN = 40;
const allowedExt = new Set([".ts", ".tsx"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walk(p, out);
      continue;
    }
    if (allowedExt.has(path.extname(p))) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const errors = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const regex = /className\s*=\s*"([^"]+)"/g;
  const seen = new Map();

  let match;
  while ((match = regex.exec(content)) !== null) {
    const classes = match[1].trim();
    if (!classes) continue;

    if (classes.length > MAX_CLASS_LENGTH) {
      errors.push(`${path.relative(process.cwd(), file)}: className length ${classes.length} > ${MAX_CLASS_LENGTH}`);
    }

    if (classes.length >= DUPLICATE_LITERAL_MIN) {
      seen.set(classes, (seen.get(classes) || 0) + 1);
    }
  }

  for (const [literal, count] of seen) {
    if (count > 1) {
      errors.push(
        `${path.relative(process.cwd(), file)}: repeated long class literal (${count}x): "${literal.slice(0, 110)}${literal.length > 110 ? "..." : ""}"`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Style check failed:\n");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log("Style check passed.");
