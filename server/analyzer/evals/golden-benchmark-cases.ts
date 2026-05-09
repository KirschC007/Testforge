import { classifyStackAdapter, type StackAdapterId } from "../stack-adapters";
import type { CodeFile } from "../code-parser";

export interface GoldenBenchmarkCase {
  name: string;
  phase: 1 | 4;
  codeFiles: CodeFile[];
  expectedAdapter: StackAdapterId;
  minConfidence: number;
  notes: string;
}

const pkg = (dependencies: Record<string, string>): CodeFile => ({
  path: "package.json",
  content: JSON.stringify({ dependencies, devDependencies: { typescript: "^5.9.0" } }),
});

export const GOLDEN_BENCHMARK_CASES: GoldenBenchmarkCase[] = [
  {
    name: "next-auth-seo-single-tenant",
    phase: 1,
    expectedAdapter: "next-auth-app-router",
    minConfidence: 90,
    notes: "Customer-style SEO tool: Auth.js Credentials, App Router REST routes, no tenant model.",
    codeFiles: [
      pkg({ next: "^15.0.0", "next-auth": "^5.0.0", zod: "^4.0.0" }),
      { path: "app/api/auth/[...nextauth]/route.ts", content: "import NextAuth from 'next-auth'; import CredentialsProvider from 'next-auth/providers/credentials'; export const { handlers } = NextAuth({ providers: [CredentialsProvider({ authorize: async () => ({ id: '1' }) })] }); export const { GET, POST } = handlers;" },
      { path: "app/api/settings/models/route.ts", content: "export async function GET() { return Response.json({ models: [] }); } export async function POST(req: Request) { return Response.json({ ok: true }); }" },
    ],
  },
  {
    name: "next-app-router-zod",
    phase: 1,
    expectedAdapter: "next-app-router",
    minConfidence: 80,
    notes: "Plain Next.js App Router API route contract.",
    codeFiles: [pkg({ next: "^15.0.0", zod: "^4.0.0" }), { path: "app/api/orders/route.ts", content: "export async function POST() { return Response.json({ id: 1 }); }" }],
  },
  {
    name: "next-pages-api",
    phase: 1,
    expectedAdapter: "next-api-routes",
    minConfidence: 80,
    notes: "Legacy pages/api route contract.",
    codeFiles: [pkg({ next: "^14.0.0" }), { path: "pages/api/users.ts", content: "export default function handler(req, res) { res.json({ ok: true }); }" }],
  },
  {
    name: "trpc-zod-drizzle-gold",
    phase: 1,
    expectedAdapter: "trpc",
    minConfidence: 90,
    notes: "Gold-stack tRPC + Zod + Drizzle.",
    codeFiles: [pkg({ "@trpc/server": "^11.0.0", zod: "^4.0.0", "drizzle-orm": "^0.45.0" }), { path: "server/router.ts", content: "const t = initTRPC.create(); export const appRouter = t.router({ orders: t.procedure.input(z.object({ tenantId: z.number() })).query(() => []) });" }],
  },
  {
    name: "express-zod-rest",
    phase: 1,
    expectedAdapter: "express",
    minConfidence: 80,
    notes: "Express REST with Zod input validation.",
    codeFiles: [pkg({ express: "^4.0.0", zod: "^4.0.0" }), { path: "src/app.ts", content: "import express from 'express'; const app = express(); app.post('/users', (req, res) => res.json({ ok: true }));" }],
  },
  {
    name: "fastify-rest",
    phase: 1,
    expectedAdapter: "fastify",
    minConfidence: 75,
    notes: "Fastify route handlers.",
    codeFiles: [pkg({ fastify: "^5.0.0" }), { path: "src/server.ts", content: "const app = fastify(); app.post('/jobs', async () => ({ ok: true }));" }],
  },
  {
    name: "openapi-contract",
    phase: 1,
    expectedAdapter: "openapi",
    minConfidence: 95,
    notes: "OpenAPI-first contract.",
    codeFiles: [{ path: "openapi.yaml", content: "openapi: 3.1.0\npaths:\n  /payments:\n    post:\n      responses:\n        '200': { description: ok }\n" }],
  },
  {
    name: "shopify-preview-approval",
    phase: 1,
    expectedAdapter: "shopify",
    minConfidence: 75,
    notes: "Shopify writeback app with preview/approval signals.",
    codeFiles: [pkg({ "@shopify/shopify-api": "^12.0.0", next: "^15.0.0" }), { path: "app/api/writeback/route.ts", content: "export async function POST() { /* preview approval admin.graphql */ return Response.json({ ok: true }); }" }],
  },
  {
    name: "laravel-api",
    phase: 1,
    expectedAdapter: "laravel",
    minConfidence: 70,
    notes: "Laravel API routes.",
    codeFiles: [{ path: "routes/api.php", content: "<?php Route::post('/orders', [OrderController::class, 'store']);" }],
  },
  {
    name: "rails-routes",
    phase: 1,
    expectedAdapter: "rails",
    minConfidence: 70,
    notes: "Rails resource routes.",
    codeFiles: [{ path: "config/routes.rb", content: "Rails.application.routes.draw do\n resources :orders\nend" }],
  },
  {
    name: "fastapi-python",
    phase: 1,
    expectedAdapter: "fastapi",
    minConfidence: 70,
    notes: "FastAPI decorators.",
    codeFiles: [{ path: "main.py", content: "from fastapi import FastAPI\napp = FastAPI()\n@app.post('/orders')\ndef create_order(): return {'ok': True}" }],
  },
  {
    name: "django-urlconf",
    phase: 1,
    expectedAdapter: "django",
    minConfidence: 65,
    notes: "Django URL patterns.",
    codeFiles: [{ path: "urls.py", content: "from django.urls import path\nurlpatterns = [path('orders/', view)]" }],
  },
  {
    name: "remix-routes",
    phase: 4,
    expectedAdapter: "remix",
    minConfidence: 70,
    notes: "Remix route module.",
    codeFiles: [pkg({ "@remix-run/node": "^2.0.0" }), { path: "app/routes/orders.tsx", content: "export async function action() { return null; }" }],
  },
  {
    name: "hono-worker",
    phase: 4,
    expectedAdapter: "hono",
    minConfidence: 70,
    notes: "Hono edge worker routes.",
    codeFiles: [pkg({ hono: "^4.0.0" }), { path: "src/index.ts", content: "const app = new Hono(); app.post('/events', c => c.json({ ok: true }));" }],
  },
  {
    name: "nestjs-controller",
    phase: 4,
    expectedAdapter: "nestjs",
    minConfidence: 70,
    notes: "NestJS decorated controller.",
    codeFiles: [pkg({ "@nestjs/common": "^11.0.0" }), { path: "src/orders.controller.ts", content: "@Controller('orders') export class OrdersController { @Post() create() {} }" }],
  },
  {
    name: "spring-rest-controller",
    phase: 4,
    expectedAdapter: "spring",
    minConfidence: 70,
    notes: "Spring Boot REST controller.",
    codeFiles: [{ path: "src/main/java/App.java", content: "@SpringBootApplication class App {} @RestController class Orders { @RequestMapping('/orders') String list(){return 'ok';} }" }],
  },
  {
    name: "go-http-router",
    phase: 4,
    expectedAdapter: "go-http",
    minConfidence: 65,
    notes: "Go net/http route handlers.",
    codeFiles: [{ path: "main.go", content: "package main\nimport 'net/http'\nfunc main(){ http.HandleFunc('/orders', func(w http.ResponseWriter, r *http.Request){}) }" }],
  },
  {
    name: "php-rest-slim",
    phase: 4,
    expectedAdapter: "php-rest",
    minConfidence: 60,
    notes: "PHP/Slim-style request signals.",
    codeFiles: [{ path: "public/index.php", content: "<?php $app = new Slim\\App(); $id = $_POST['id'];" }],
  },
  {
    name: "generic-typescript-utility",
    phase: 4,
    expectedAdapter: "generic-typescript",
    minConfidence: 50,
    notes: "Weak TypeScript should stay minimal.",
    codeFiles: [pkg({ typescript: "^5.0.0" }), { path: "src/index.ts", content: "export const add = (a: number, b: number) => a + b;" }],
  },
  {
    name: "unknown-static-site",
    phase: 4,
    expectedAdapter: "generic-unknown",
    minConfidence: 15,
    notes: "No API evidence means unsupported/minimal.",
    codeFiles: [{ path: "README.md", content: "# static docs only" }],
  },
];

export interface GoldenBenchmarkResult {
  name: string;
  passed: boolean;
  adapter: StackAdapterId;
  expectedAdapter: StackAdapterId;
  confidence: number;
  minConfidence: number;
  failures: string[];
}

export function runGoldenBenchmarkSuite(): GoldenBenchmarkResult[] {
  return GOLDEN_BENCHMARK_CASES.map((entry) => {
    const assessment = classifyStackAdapter(entry.codeFiles);
    const failures: string[] = [];
    if (assessment.adapter !== entry.expectedAdapter) failures.push(`Expected ${entry.expectedAdapter}, got ${assessment.adapter}`);
    if (assessment.confidence < entry.minConfidence) failures.push(`Expected confidence >= ${entry.minConfidence}, got ${assessment.confidence}`);
    return {
      name: entry.name,
      passed: failures.length === 0,
      adapter: assessment.adapter,
      expectedAdapter: entry.expectedAdapter,
      confidence: assessment.confidence,
      minConfidence: entry.minConfidence,
      failures,
    };
  });
}

export function summarizeGoldenBenchmarkResults(results: GoldenBenchmarkResult[]) {
  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}
