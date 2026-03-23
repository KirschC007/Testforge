// Simulate a full analysis run to catch Layer 2 crash
import { runAnalysisJob } from "./server/analyzer/job-runner";

const DEMO_SPEC = `# ShopCore API Specification

## Authentication
All endpoints require Bearer token. shopId is the tenant isolation key.

## POST /api/trpc/products.create
Input: shopId (number), name (string), price (number), stock (integer, min=0, max=10000)
Output: id, name, price, stock, createdAt
Behavior: Creates a product. Returns 400 if price <= 0 or stock < 0. Returns 403 if shopId doesn't match authenticated user.

## GET /api/trpc/products.getById
Input: shopId (number), productId (number)
Output: id, name, price, stock
Behavior: Returns product. Returns 403 if shopId doesn't match. Returns 404 if not found.

## POST /api/trpc/orders.create
Input: shopId (number), productId (number), quantity (integer, min=1, max=100)
Output: id, status, total, createdAt
Behavior: Creates order. Decrements stock. Returns 400 if stock insufficient. Returns 403 if cross-tenant.
Status transitions: pending→processing, processing→shipped, shipped→delivered. No skipping.

## Security
- shopId is the tenant isolation key — cross-tenant access must return 403
- Rate limiting: max 10 failed auth attempts per minute per IP
`;

console.log("Starting test analysis...");
try {
  const result = await runAnalysisJob(DEMO_SPEC, "TestShop", async (layer, message) => {
    console.log(`[Layer ${layer}] ${message}`);
  });
  console.log("SUCCESS! Behaviors:", result.analysisResult.ir.behaviors.length);
  console.log("Test files:", result.testFiles.length);
  console.log("Verdict score:", result.validatedSuite.verdict.score);
} catch (err: any) {
  console.error("FAILED at:", err.message);
  console.error(err.stack);
}
