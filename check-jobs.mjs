import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, projectName, status, progressLayer, progressMessage, LENGTH(resultJson) as resultJsonLen, createdAt FROM analyses WHERE id = 180001"
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
