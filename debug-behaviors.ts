import { parseCodeToIR } from "./server/analyzer/code-parser";
import { semanticDedup } from "./server/analyzer/smart-parser";
import fs from "fs";

const files = [
  { path: "routers.ts", content: fs.readFileSync("/tmp/xpansio/xpansio-final-export/server/routers.ts", "utf-8") },
  { path: "xpansio-db.ts", content: fs.readFileSync("/tmp/xpansio/xpansio-final-export/server/xpansio-db.ts", "utf-8") },
  { path: "angebotProcessor.ts", content: fs.readFileSync("/tmp/xpansio/xpansio-final-export/server/angebotProcessor.ts", "utf-8") },
];

const result = parseCodeToIR(files);
console.log("=== Before Dedup:", result.ir.behaviors.length, "behaviors ===");
result.ir.behaviors.forEach((b, i) => console.log(` ${i+1}. "${b.title}" | endpoint: ${(b as any).endpoint || b.subject}`));

const deduped = semanticDedup(result.ir.behaviors, 0.95);
console.log("\n=== After Dedup (0.95):", deduped.length, "behaviors ===");
deduped.forEach((b, i) => console.log(` ${i+1}. "${b.title}"`));
