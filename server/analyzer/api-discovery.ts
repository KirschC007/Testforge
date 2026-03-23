/**
 * api-discovery.ts — Automatic API endpoint discovery
 *
 * Attempts to discover real API endpoints from a running system by:
 * 1. Probing OpenAPI/Swagger endpoints (/api/openapi.json, /swagger.json, /api/docs)
 * 2. Probing tRPC panel endpoint (/api/trpc/)
 * 3. Probing common auth/CSRF endpoints (OPTIONS /api/auth/login, /api/auth/csrf-token)
 *
 * Results are merged back into the IR so LLM-guessed endpoints are replaced with real paths.
 */

export interface DiscoveredEndpoint {
  name: string;
  method: string;
  path: string;
  auth: string;
}

export interface DiscoveryResult {
  endpoints: DiscoveredEndpoint[];
  framework: "trpc" | "rest" | "graphql" | "unknown";
  csrfEndpoint?: string;
  openApiUrl?: string;
}

/**
 * Probe a URL with a timeout. Returns null on any error.
 */
async function probe(
  url: string,
  options: { method?: string; headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<{ status: number; body: string } | null> {
  const { method = "GET", headers = {}, timeoutMs = 5000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });
    const body = await res.text().catch(() => "");
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse OpenAPI 3.x / Swagger 2.x JSON and extract endpoints.
 */
function parseOpenApiEndpoints(json: unknown): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  if (typeof json !== "object" || json === null) return endpoints;

  const spec = json as Record<string, unknown>;
  const paths = spec["paths"] as Record<string, unknown> | undefined;
  if (!paths) return endpoints;

  for (const [path, methods] of Object.entries(paths)) {
    if (typeof methods !== "object" || methods === null) continue;
    for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) continue;
      const op = operation as Record<string, unknown>;
      // Derive a tRPC-style name from the path: /api/accounts → accounts.list (GET), accounts.create (POST)
      const segments = path.replace(/^\/api\//, "").split("/").filter(Boolean);
      const resource = segments[0] ?? "resource";
      const action = method.toLowerCase() === "get"
        ? (segments.length > 1 && !segments[1].startsWith(":") ? segments[1] : "list")
        : method.toLowerCase() === "post" ? "create"
        : method.toLowerCase() === "put" || method.toLowerCase() === "patch" ? "update"
        : "delete";
      const name = `${resource}.${action}`;

      // Detect auth from security field
      const security = op["security"] as unknown[] | undefined;
      const auth = security && security.length > 0 ? "required" : "none";

      endpoints.push({ name, method: method.toUpperCase(), path, auth });
    }
  }
  return endpoints;
}

/**
 * Parse tRPC panel response to extract procedure names.
 * tRPC panel returns a JSON with procedure names when queried.
 */
function parseTRPCEndpoints(body: string, basePath: string): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  try {
    // tRPC batch endpoint returns JSON with result array
    const json = JSON.parse(body);
    if (Array.isArray(json)) {
      for (const item of json) {
        if (item?.result?.data && typeof item.result.data === "object") {
          const procedures = item.result.data as Record<string, unknown>;
          for (const name of Object.keys(procedures)) {
            endpoints.push({
              name,
              method: "POST",
              path: `${basePath}/${name}`,
              auth: "unknown",
            });
          }
        }
      }
    }
  } catch {
    // Not JSON or unexpected format — ignore
  }
  return endpoints;
}

/**
 * Main discovery function. Probes the given baseUrl for API endpoints.
 * Returns a DiscoveryResult with all discovered endpoints.
 */
export async function discoverAPI(
  baseUrl: string,
  authToken?: string
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    endpoints: [],
    framework: "unknown",
  };

  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  // ── Step 1: Try OpenAPI / Swagger endpoints ──────────────────────────────
  const openApiPaths = [
    "/api/openapi.json",
    "/openapi.json",
    "/swagger.json",
    "/api/swagger.json",
    "/api/docs/openapi.json",
    "/api/v1/openapi.json",
  ];

  for (const apiPath of openApiPaths) {
    const url = `${baseUrl.replace(/\/$/, "")}${apiPath}`;
    const response = await probe(url, { headers });
    if (response && response.status === 200 && response.body.includes('"paths"')) {
      try {
        const json = JSON.parse(response.body);
        const parsed = parseOpenApiEndpoints(json);
        if (parsed.length > 0) {
          result.endpoints.push(...parsed);
          result.framework = "rest";
          result.openApiUrl = url;
          break; // Found OpenAPI spec — stop searching
        }
      } catch {
        // Not valid JSON — continue
      }
    }
  }

  // ── Step 2: Try tRPC panel ───────────────────────────────────────────────
  if (result.endpoints.length === 0) {
    const trpcPaths = ["/api/trpc/", "/trpc/", "/api/trpc"];
    for (const trpcPath of trpcPaths) {
      const url = `${baseUrl.replace(/\/$/, "")}${trpcPath}`;
      const response = await probe(url, { headers });
      if (response && response.status < 500) {
        // tRPC is likely present — mark framework
        result.framework = "trpc";
        const parsed = parseTRPCEndpoints(response.body, trpcPath);
        if (parsed.length > 0) {
          result.endpoints.push(...parsed);
          break;
        }
      }
    }
  }

  // ── Step 3: Probe common auth endpoints ─────────────────────────────────
  const commonAuthPaths = [
    { path: "/api/auth/login", method: "POST" },
    { path: "/api/auth/register", method: "POST" },
    { path: "/api/auth/logout", method: "POST" },
    { path: "/api/auth/me", method: "GET" },
    { path: "/api/auth/csrf-token", method: "GET" },
    { path: "/api/auth/refresh", method: "POST" },
  ];

  for (const { path, method } of commonAuthPaths) {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    const response = await probe(url, { method: "OPTIONS", headers });
    if (response && response.status !== 404) {
      // Endpoint exists
      const segments = path.replace(/^\/api\//, "").split("/");
      const name = segments.join(".");
      const existing = result.endpoints.find((e) => e.path === path);
      if (!existing) {
        result.endpoints.push({ name, method, path, auth: "none" });
      }
      // Detect CSRF endpoint
      if (path.includes("csrf")) {
        result.csrfEndpoint = path;
      }
    }
  }

  // ── Step 4: Probe common resource endpoints ──────────────────────────────
  const commonResourcePaths = [
    "/api/users",
    "/api/accounts",
    "/api/tasks",
    "/api/projects",
    "/api/orders",
    "/api/products",
    "/api/invoices",
    "/api/customers",
    "/api/events",
    "/api/tickets",
  ];

  for (const path of commonResourcePaths) {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    const response = await probe(url, { method: "OPTIONS", headers });
    if (response && response.status !== 404) {
      const resource = path.replace("/api/", "");
      const existing = result.endpoints.find((e) => e.path === path);
      if (!existing) {
        result.endpoints.push({ name: `${resource}.list`, method: "GET", path, auth: "required" });
        result.endpoints.push({ name: `${resource}.create`, method: "POST", path, auth: "required" });
      }
    }
  }

  // ── Deduplicate by name ──────────────────────────────────────────────────
  const seen = new Set<string>();
  result.endpoints = result.endpoints.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });

  return result;
}
