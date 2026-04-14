import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT id, projectName, status, progressLayer, progressMessage, 
   validatedProofCount, behaviorCount,
   outputZipUrl IS NOT NULL as hasZip,
   LENGTH(resultJson) as resultJsonLen,
   createdAt, completedAt
   FROM analyses ORDER BY id DESC LIMIT 5`
);

console.log("=== Letzte 5 Jobs ===");
for (const r of rows) {
  console.log(JSON.stringify(r, null, 2));
}

// Schaue ob resultJson Testdateien hat
const [r2] = await conn.execute(
  `SELECT id, projectName, 
   JSON_LENGTH(resultJson, '$.validatedSuite.proofs') as proofCount,
   JSON_EXTRACT(resultJson, '$.testFileCount') as testFileCount,
   JSON_EXTRACT(resultJson, '$.validatedSuite.verdict.score') as score
   FROM analyses ORDER BY id DESC LIMIT 3`
);
console.log("\n=== resultJson Details ===");
for (const r of r2) {
  console.log(JSON.stringify(r, null, 2));
}

await conn.end();
