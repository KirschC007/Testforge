import type { AnalysisIR } from "./types";
import type { CodeFile } from "./code-parser";

export type StackAdapterId =
  | "next-auth-app-router"
  | "next-app-router"
  | "next-api-routes"
  | "trpc"
  | "express"
  | "fastify"
  | "openapi"
  | "shopify"
  | "laravel"
  | "rails"
  | "fastapi"
  | "django"
  | "remix"
  | "hono"
  | "nestjs"
  | "spring"
  | "go-http"
  | "php-rest"
  | "generic-typescript"
  | "generic-unknown";

export interface StackAdapterAssessment {
  adapter: StackAdapterId;
  confidence: number;
  evidence: string[];
  supported: boolean;
  recommendedMode: "gold" | "conservative" | "minimal";
}

function packageDeps(files: CodeFile[]): Record<string, string> {
  const pkg = files.find((file) => file.path.endsWith("package.json"));
  if (!pkg) return {};
  try {
    const parsed = JSON.parse(pkg.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
  } catch {
    return {};
  }
}

function hasPath(files: CodeFile[], pattern: RegExp): boolean {
  return files.some((file) => pattern.test(file.path));
}

function hasContent(files: CodeFile[], pattern: RegExp): boolean {
  return files.some((file) => pattern.test(file.content));
}

export function classifyStackAdapter(files: CodeFile[], ir?: AnalysisIR): StackAdapterAssessment {
  const deps = packageDeps(files);
  const depNames = Object.keys(deps).join("\n");
  const evidence: string[] = [];
  const add = (label: string) => evidence.push(label);

  if (hasPath(files, /openapi|swagger/i) || hasContent(files, /\bopenapi:\s*3|swagger:\s*['"]?2/i)) {
    add("OpenAPI/Swagger document detected");
    return { adapter: "openapi", confidence: 96, evidence, supported: true, recommendedMode: "gold" };
  }
  if (depNames.includes("@shopify") || hasContent(files, /shopify|admin\.graphql|writeback|preview/i)) {
    add("Shopify app/writeback signals detected");
    return { adapter: "shopify", confidence: 80, evidence, supported: true, recommendedMode: "conservative" };
  }
  if ((deps.next || depNames.includes("next")) && (depNames.includes("next-auth") || hasPath(files, /app\/api\/auth\/\[\.\.\.nextauth\]/) || hasContent(files, /NextAuth\s*\(|CredentialsProvider/))) {
    add("Next.js detected");
    add("Auth.js/NextAuth credentials flow detected");
    return { adapter: "next-auth-app-router", confidence: 92, evidence, supported: true, recommendedMode: "conservative" };
  }
  if (deps.next && hasPath(files, /app\/api\/.+route\.(ts|js)$/)) {
    add("Next.js App Router route handlers detected");
    return { adapter: "next-app-router", confidence: 86, evidence, supported: true, recommendedMode: "conservative" };
  }
  if (deps.next && hasPath(files, /pages\/api\//)) {
    add("Next.js pages/api routes detected");
    return { adapter: "next-api-routes", confidence: 82, evidence, supported: true, recommendedMode: "conservative" };
  }
  if (depNames.includes("@trpc/server") || hasContent(files, /protectedProcedure|publicProcedure|initTRPC|createTRPCRouter/)) {
    add("tRPC procedures detected");
    if (depNames.includes("zod")) add("Zod contracts detected");
    if (depNames.includes("drizzle-orm")) add("Drizzle schema dependency detected");
    return { adapter: "trpc", confidence: depNames.includes("zod") ? 90 : 76, evidence, supported: true, recommendedMode: depNames.includes("drizzle-orm") ? "gold" : "conservative" };
  }
  if (depNames.includes("fastify") || hasContent(files, /\bfastify\s*\(|server\.(get|post|put|patch|delete)\s*\(/)) {
    add("Fastify routes detected");
    return { adapter: "fastify", confidence: 78, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasContent(files, /FastAPI\s*\(|@\w+\.(get|post|put|patch|delete)\s*\(/)) {
    add("FastAPI decorators detected");
    return { adapter: "fastapi", confidence: 74, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (depNames.includes("hono") || hasContent(files, /new Hono|\.route\(/)) {
    add("Hono app detected");
    return { adapter: "hono", confidence: 70, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (depNames.includes("express") || hasContent(files, /\bexpress\s*\(|app\.(get|post|put|patch|delete)\s*\(/)) {
    add("Express routes detected");
    return { adapter: "express", confidence: 82, evidence, supported: true, recommendedMode: depNames.includes("zod") ? "conservative" : "minimal" };
  }
  if (hasPath(files, /routes\/web\.php|routes\/api\.php/) || hasContent(files, /Illuminate\\|Route::(get|post|put|patch|delete)/)) {
    add("Laravel route files detected");
    return { adapter: "laravel", confidence: 72, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasPath(files, /config\/routes\.rb/) || hasContent(files, /Rails\.application\.routes|resources\s+:/)) {
    add("Rails routes detected");
    return { adapter: "rails", confidence: 72, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasContent(files, /django\.urls|urlpatterns|path\(/)) {
    add("Django URL patterns detected");
    return { adapter: "django", confidence: 68, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (depNames.includes("@remix-run") || hasPath(files, /app\/routes\//)) {
    add("Remix routes detected");
    return { adapter: "remix", confidence: 70, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (depNames.includes("@nestjs") || hasContent(files, /@Controller|@Get\(|@Post\(/)) {
    add("NestJS controllers detected");
    return { adapter: "nestjs", confidence: 72, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasContent(files, /SpringBootApplication|@RestController|@RequestMapping/)) {
    add("Spring REST controller detected");
    return { adapter: "spring", confidence: 70, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasContent(files, /http\.HandleFunc|gin\.Default|router\.(GET|POST)/)) {
    add("Go HTTP handlers detected");
    return { adapter: "go-http", confidence: 68, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (hasContent(files, /\$_(GET|POST|REQUEST)|new Slim\\App|Route::/)) {
    add("PHP REST signals detected");
    return { adapter: "php-rest", confidence: 64, evidence, supported: true, recommendedMode: "minimal" };
  }
  if (depNames.includes("typescript") || files.some((file) => /\.(ts|tsx)$/.test(file.path)) || (ir?.apiEndpoints.length || 0) > 0) {
    add("TypeScript or endpoint signals detected");
    return { adapter: "generic-typescript", confidence: 52, evidence, supported: true, recommendedMode: "minimal" };
  }
  add("No deterministic adapter evidence detected");
  return { adapter: "generic-unknown", confidence: 20, evidence, supported: false, recommendedMode: "minimal" };
}
