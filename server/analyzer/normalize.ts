/**
 * Normalize LLM-generated or REST-path endpoint names to consistent resource.action format.
 * Single source of truth — imported by llm-parser.ts and job-runner.ts.
 *
 * Examples:
 *   "createAccount.create"     → "accounts.create"
 *   "/api/owners/:id/gdpr"     → "owners.gdprDelete"
 *   "listAccounts"             → "accounts.list"
 *   "gdprDeleteOwner"          → "owners.gdprDelete"
 *   "ownerDatas.export"        → "owners.export"
 */
export function normalizeEndpointName(raw: string, method?: string): string {
  // FIRST: If raw IS a REST path (starts with /), convert to dot-notation
  if (raw.startsWith("/")) {
    // "/api/owners/:id/gdpr" → "owners.gdprDelete"
    // "/api/auth/csrf-token" → "auth.csrfToken"
    // "/api/accounts/:id/freeze" → "accounts.freeze"
    // "/api/students/:id/export" → "students.export"
    const segments = raw
      .replace(/^\/api\/(?:v\d+\/)?/, "")  // Strip /api/ or /api/v1/
      .split("/")
      .filter(s => !s.startsWith(":") && s.length > 0);  // Remove :id params and empty
    if (segments.length >= 1) {
      const resource = segments[0].toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (segments.length === 1) return `${resource}.list`;
      const action = segments[segments.length - 1].toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      // Map common actions
      if (action === "gdpr") return `${resource}.gdprDelete`;
      if (action === "export") return `${resource}.export`;
      if (action === "import") return `${resource}.import`;
      if (action === "freeze") return `${resource}.freeze`;
      if (action === "unfreeze") return `${resource}.unfreeze`;
      if (action === "cancel") return `${resource}.cancel`;
      if (action === "approve") return `${resource}.approve`;
      if (action === "reject") return `${resource}.reject`;
      if (action === "complete") return `${resource}.complete`;
      if (action === "archive") return `${resource}.archive`;
      return `${resource}.${action}`;
    }
  }
  // Cleanup: "ownerDatas.export" → "owners.export", "petDatas.list" → "pets.list"
  if (raw.includes(".")) {
    let [left, right] = raw.split(".");
    if (/Datas?$/i.test(left)) {
      left = left.replace(/Datas?$/i, "s").replace(/^([A-Z])/, c => c.toLowerCase());
      if (!left.endsWith("s") && left.length > 2) left += "s";
      return `${left}.${right}`;
    }
  }
  // Already correct: simple resource.action dot-notation
  const simpleResource = /^[a-z][a-z0-9]*s?\.[a-z][a-z0-9]*$/;
  if (simpleResource.test(raw)) return raw;
  // Pattern: "createAccount.create" → verb-duplicate → "accounts.create"
  const dupMatch = raw.match(/^(create|list|get|update|delete|find|add|remove)([A-Z]\w*)\.(\1)$/i);
  if (dupMatch) {
    const resource = dupMatch[2].toLowerCase().replace(/^([a-z]+)$/, m => m.endsWith("s") ? m : m + "s");
    return `${resource}.${dupMatch[1].toLowerCase()}`;
  }
  // Pattern: dot-notation with camelCase left side: "createAccount.create", "listAccounts.list"
  if (/^[a-z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/.test(raw)) {
    const [left, right] = raw.split(".");
    const verbs = ["create", "list", "get", "update", "delete", "add", "remove", "find", "fetch",
      "patch", "set", "freeze", "unfreeze", "cancel", "approve", "reject", "complete", "archive",
      "send", "export", "import", "anonymize", "void", "mark", "close", "open", "start", "stop",
      "pause", "resume", "skip", "scan"];
    const matchedVerb = verbs.find(v => left.toLowerCase().startsWith(v) && left.length > v.length);
    if (matchedVerb) {
      const resourceRaw = left.slice(matchedVerb.length);
      const resourceBase = resourceRaw
        .replace(/([A-Z][a-z]+)/g, (m) => m.toLowerCase() + "-")
        .replace(/-+$/, "")
        .split("-")[0];
      const resource = resourceBase.endsWith("s") ? resourceBase : resourceBase + "s";
      let action = right;
      const extraSuffix = resourceRaw.includes("-") ? resourceRaw.split("-").slice(1).join("") : "";
      if (extraSuffix && extraSuffix.toLowerCase() !== "s") {
        action = right + extraSuffix.charAt(0).toUpperCase() + extraSuffix.slice(1).toLowerCase();
      }
      if (resourceRaw.toUpperCase().includes("GDPR")) {
        action = "gdpr" + right.charAt(0).toUpperCase() + right.slice(1);
      }
      return `${resource}.${action}`;
    }
    return raw;
  }
  // Compound verbs: gdprDeleteOwner → owners.gdprDelete, bulkDeletePets → pets.bulkDelete
  const compoundMatch = raw.match(/^(gdprDelete|gdprExport|gdprAnonymize|bulkDelete|bulkUpdate|bulkCreate|softDelete|hardDelete|forceDelete)([A-Z]\w*)$/);
  if (compoundMatch) {
    const action = compoundMatch[1]; // "gdprDelete"
    let resource = compoundMatch[2].replace(/^[A-Z]/, c => c.toLowerCase());
    resource = resource.endsWith("s") ? resource : resource + "s";
    return `${resource}.${action}`;
  }
  // Pattern: pure camelCase without dot: "createAccount" → "accounts.create"
  const verbFirst = raw.match(/^(create|list|get|find|update|patch|delete|remove|close|freeze|unfreeze|cancel|approve|reject|complete|archive|anonymize|export|send|mark|register|book|record|submit|assign|enroll|invite|verify|confirm|activate|suspend|ban|block|unblock|void|refund|grade|rate|publish|unpublish|schedule|reschedule|check)([A-Z]\w*)$/);
  if (verbFirst) {
    const verb = verbFirst[1].toLowerCase();
    let resource = verbFirst[2]
      .replace(/GDPR|Gdpr|ById|ByPhone|ByEmail|Status$/g, "")
      .replace(/^[A-Z]/, c => c.toLowerCase());
    resource = resource.endsWith("s") ? resource : resource + "s";
    const verbMap: Record<string, string> = {
      create: "create", add: "create",
      list: "list", find: "list",
      get: "getById", fetch: "getById",
      update: "update", patch: "update",
      delete: "delete", remove: "delete", close: "delete",
    };
    const action = verbMap[verb] || verb;
    if (verbFirst[2].includes("Status")) return `${resource}.updateStatus`;
    if (verbFirst[2].toUpperCase().includes("GDPR")) return `${resource}.gdprDelete`;
    return `${resource}.${action}`;
  }
  // REST pattern: "POST /api/accounts" or "GET /api/accounts/:id/freeze"
  if (method) {
    const pathMatch = method.match(/(GET|POST|PUT|PATCH|DELETE)\s+\/api\/(?:v\d+\/)?([\w-]+)/i);
    if (pathMatch) {
      const resource = pathMatch[2].toLowerCase();
      const httpVerb = pathMatch[1].toUpperCase();
      const path = method.toLowerCase();
      const actionMatch = path.match(/\/([a-z][a-z0-9_]*)$/);
      const lastSegment = actionMatch?.[1];
      if (lastSegment && !lastSegment.startsWith(":") && lastSegment !== resource && lastSegment !== "id") {
        return `${resource}.${lastSegment}`;
      }
      const map: Record<string, string> = { GET: "list", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };
      if (path.includes(":id") || path.includes("{id}")) return `${resource}.${httpVerb === "GET" ? "getById" : map[httpVerb]}`;
      return `${resource}.${map[httpVerb] || "call"}`;
    }
  }
  // REST pattern in name itself
  const restMatch = raw.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (restMatch) {
    const httpMethod = restMatch[1].toUpperCase();
    const path = restMatch[2];
    const segments = path.replace(/^\/api\//, "").split("/").filter(s => s && !s.startsWith(":") && !s.startsWith("{"));
    if (segments.length > 0) {
      const resource = segments[0];
      const subAction = segments.length > 1 ? segments[segments.length - 1] : null;
      const hasIdParam = path.includes(":") || path.includes("{");
      const methodMap: Record<string, string> = {
        GET: hasIdParam ? "getById" : "list",
        POST: subAction || "create",
        PUT: subAction || "update",
        PATCH: subAction || "update",
        DELETE: subAction || "delete",
      };
      return `${resource}.${methodMap[httpMethod] || subAction || "call"}`;
    }
  }
  return raw;
}
