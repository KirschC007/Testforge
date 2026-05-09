import { describe, expect, it, vi } from "vitest";

describe("repo-scanner branch fallback", () => {
  it("falls back from requested branch to the repository default branch for code files", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/git/trees/main?recursive=1")) {
        return new Response('{"message":"Not Found"}', { status: 404 });
      }
      if (url.endsWith("/repos/expressjs/express")) {
        return new Response(JSON.stringify({ default_branch: "master" }), { status: 200 });
      }
      if (url.includes("/git/trees/master?recursive=1")) {
        return new Response(JSON.stringify({
          tree: [
            { path: "package.json", type: "blob", size: 80, sha: "1", url: "https://example.test/package.json" },
          ],
          truncated: false,
        }), { status: 200 });
      }
      if (url.includes("raw.githubusercontent.com/expressjs/express/master/package.json")) {
        return new Response(JSON.stringify({ dependencies: { express: "^4.0.0" } }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);
    const { fetchRepoCodeFiles } = await import("./analyzer/repo-scanner");

    const files = await fetchRepoCodeFiles("expressjs", "express", "main");
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("package.json");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("filters fetched code files to the requested subpath", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/git/trees/main?recursive=1")) {
        return new Response(JSON.stringify({
          tree: [
            { path: "examples/route-handlers/package.json", type: "blob", size: 80, sha: "1", url: "https://example.test/package.json" },
            { path: "examples/route-handlers/app/api/orders/route.ts", type: "blob", size: 150, sha: "2", url: "https://example.test/route.ts" },
            { path: "docs/ignore.ts", type: "blob", size: 50, sha: "3", url: "https://example.test/ignore.ts" },
          ],
          truncated: false,
        }), { status: 200 });
      }
      if (url.includes("examples/route-handlers/package.json")) {
        return new Response(JSON.stringify({ dependencies: { next: "^16.0.0" } }), { status: 200 });
      }
      if (url.includes("examples/route-handlers/app/api/orders/route.ts")) {
        return new Response("export async function POST() { return Response.json({ ok: true }); }", { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);
    const { fetchRepoCodeFiles } = await import("./analyzer/repo-scanner");

    const files = await fetchRepoCodeFiles("vercel", "next.js", "main", undefined, "examples/route-handlers");
    expect(files).toHaveLength(2);
    expect(files.every((file) => file.path.startsWith("examples/route-handlers/"))).toBe(true);
  });

  it("falls back to the repository default branch for spec scans", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/git/trees/main?recursive=1")) {
        return new Response('{"message":"Not Found"}', { status: 404 });
      }
      if (url.endsWith("/repos/OAI/OpenAPI-Specification")) {
        return new Response(JSON.stringify({ default_branch: "master" }), { status: 200 });
      }
      if (url.includes("/git/trees/master?recursive=1")) {
        return new Response(JSON.stringify({
          tree: [
            { path: "openapi.yaml", type: "blob", size: 120, sha: "2", url: "https://example.test/openapi.yaml" },
          ],
          truncated: false,
        }), { status: 200 });
      }
      if (url.includes("raw.githubusercontent.com/OAI/OpenAPI-Specification/master/openapi.yaml")) {
        return new Response("openapi: 3.1.0\npaths: {}\n", { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);
    const { scanGitHubRepo } = await import("./analyzer/repo-scanner");

    const result = await scanGitHubRepo("OAI", "OpenAPI-Specification", "main");
    expect(result.specs).toHaveLength(1);
    expect(result.branch).toBe("master");
  });
});
