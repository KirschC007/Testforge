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
  // ─── EBENE 1: FRAMEWORK PREFIX STRIP ──────────────────────────────────────
  // Remove framework namespace prefixes that are NOT resource names.
  // "trpc.applications" → "applications" (trpc is a framework, not a resource)
  // "api.users" → "users" (api is a namespace, not a resource)
  const FRAMEWORK_PREFIXES = new Set(["trpc", "api", "v1", "v2", "v3", "v4", "rest", "graphql", "rpc", "grpc"]);
  if (raw.includes(".")) {
    const parts = raw.split(".");
    if (FRAMEWORK_PREFIXES.has(parts[0].toLowerCase()) && parts.length > 1) {
      raw = parts.slice(1).join(".");
    }
  }
  // Legacy: explicit trpc. strip (belt-and-suspenders)
  if (raw.startsWith("trpc.")) raw = raw.slice(5);
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
      if (segments.length === 1) {
        // Use HTTP method to determine action for simple paths like POST /api/devices
        const m = (method || 'GET').toUpperCase();
        const methodActionMap: Record<string, string> = {
          GET: 'list', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete'
        };
        return `${resource}.${methodActionMap[m] || 'list'}`;
      }
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
  // But normalize action synonyms: add/new/insert/store/register → create, download/getExport → export
  const simpleResource = /^[a-z][a-z0-9]*s?\.([a-z][a-z0-9]*)$/;
  const simpleMatch = simpleResource.exec(raw);
  if (simpleMatch) {
    const resource = raw.split('.')[0];
    const action = simpleMatch[1].toLowerCase();
    const actionSynonyms: Record<string, string> = {
      add: 'create', new: 'create', insert: 'create', store: 'create', post: 'create',
      register: 'create', book: 'create', generate: 'create', start: 'create',
      download: 'export', getexport: 'export', exportdata: 'export',
      remove: 'delete', destroy: 'delete',
      fetch: 'getById', retrieve: 'getById', show: 'getById',
      modify: 'update', edit: 'update', patch: 'update', put: 'update',
      all: 'list', find: 'list', search: 'list',
    };
    const normalizedAction = actionSynonyms[action] || action;
    return `${resource}.${normalizedAction}`;
  }
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
    // Verb-Synonyme: domain-spezifische Verben → generische Actions
    const verbSynonyms: Record<string, string> = {
      register: "create",   // registerPatient → patients.create
      book: "create",       // bookRental → rentals.create
      generate: "create",   // generateInvoice → invoices.create
      record: "create",     // recordMaintenance → devices.create (overridden by sub-action if present)
      submit: "create",
      enroll: "create",
      invite: "create",
    };
    const action = verbMap[verb] || verbSynonyms[verb] || verb;
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
      // If subAction is a meaningful verb (not just a resource name), use it directly
      const meaningfulSubActions = ['export', 'import', 'gdpr', 'freeze', 'unfreeze', 'cancel',
        'approve', 'reject', 'complete', 'archive', 'maintenance', 'status', 'extend', 'return',
        'payment', 'utilization', 'anonymize', 'delete', 'restore', 'publish', 'unpublish'];
      if (subAction && meaningfulSubActions.includes(subAction.toLowerCase())) {
        const actionMap: Record<string, string> = { gdpr: 'gdprDelete' };
        return `${resource}.${actionMap[subAction.toLowerCase()] || subAction.toLowerCase()}`;
      }
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
  // "patients.gdpr" → "patients.gdprDelete" (wenn kein Suffix nach gdpr)
  if (raw.endsWith(".gdpr")) return raw + "Delete";
  return raw;
}
// ─── LLM Output Sanitization ─────────────────────────────────────────────────

/**
 * Ensures a value is a string array. Handles all LLM hallucination patterns:
 * - undefined/null → []
 * - "single string" → ["single string"]
 * - 123 → ["123"]
 * - {object} → []
 * - ["already", "array"] → ["already", "array"]
 * - [123, "mixed"] → ["123", "mixed"]
 */
export function ensureArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(v => typeof v === "string" ? v : String(v));
  if (typeof val === "string" && val.length > 0) return [val];
  if (typeof val === "number") return [String(val)];
  return [];
}

/**
 * Ensures a value is a string. Handles:
 * - undefined/null → fallback
 * - number → "number"
 * - ["array"] → "array[0]"
 * - {object} → fallback
 */
export function ensureString(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  return fallback;
}

/**
 * Sanitize a single Behavior object from LLM output.
 * Ensures every field has the correct type regardless of what the LLM returned.
 */
export function sanitizeBehavior(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    id: ensureString(raw.id, `B-${Date.now()}`),
    title: ensureString(raw.title, "Untitled behavior"),
    subject: ensureString(raw.subject, "System"),
    action: ensureString(raw.action, "handles"),
    object: ensureString(raw.object, "request"),
    preconditions: ensureArray(raw.preconditions),
    postconditions: ensureArray(raw.postconditions),
    errorCases: ensureArray(raw.errorCases),
    errorCodes: ensureArray(raw.errorCodes),
    tags: ensureArray(raw.tags),
    riskHints: ensureArray(raw.riskHints),
    relatedBehaviors: ensureArray(raw.relatedBehaviors),
    outputFields: ensureArray(raw.outputFields),
    chapter: ensureString(raw.chapter, ""),
    specAnchor: ensureString(raw.specAnchor, ""),
    structuredSideEffects: Array.isArray(raw.structuredSideEffects) ? raw.structuredSideEffects : [],
  };
}

/**
 * Sanitize a UserFlow object from LLM output.
 */
export function sanitizeUserFlow(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    id: ensureString(raw.id, `UF-${Date.now()}`),
    name: ensureString(raw.name, "Unnamed flow"),
    actor: ensureString(raw.actor, "user"),
    steps: ensureArray(raw.steps),
    successCriteria: ensureArray(raw.successCriteria),
    errorScenarios: ensureArray(raw.errorScenarios),
    relatedEndpoints: ensureArray(raw.relatedEndpoints),
  };
}

/**
 * Sanitize an APIEndpoint object from LLM output.
 */
export function sanitizeEndpoint(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    name: ensureString(raw.name, "unknown.endpoint"),
    method: ensureString(raw.method, "POST"),
    auth: ensureString(raw.auth, "requireAuth"),
    relatedBehaviors: ensureArray(raw.relatedBehaviors),
    inputFields: Array.isArray(raw.inputFields) ? raw.inputFields : [],
    outputFields: Array.isArray(raw.outputFields)
      ? raw.outputFields
      : (typeof raw.outputFields === "string" ? [raw.outputFields] : []),
  };
}

/**
 * Sanitize the complete IR from LLM output.
 * Call this ONCE after parsing, BEFORE anything else touches the data.
 */
export function sanitizeLLMOutput(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    behaviors: Array.isArray(raw.behaviors)
      ? raw.behaviors.map(b => sanitizeBehavior(b as Record<string, unknown>))
      : [],
    apiEndpoints: Array.isArray(raw.apiEndpoints)
      ? raw.apiEndpoints.map(e => sanitizeEndpoint(e as Record<string, unknown>))
      : [],
    userFlows: Array.isArray(raw.userFlows)
      ? raw.userFlows.map(f => sanitizeUserFlow(f as Record<string, unknown>))
      : [],
    invariants: Array.isArray(raw.invariants) ? raw.invariants : ensureArray(raw.invariants),
    ambiguities: Array.isArray(raw.ambiguities) ? raw.ambiguities : ensureArray(raw.ambiguities),
    contradictions: Array.isArray(raw.contradictions) ? raw.contradictions : ensureArray(raw.contradictions),
    services: Array.isArray(raw.services) ? raw.services : [],
    dataModels: Array.isArray(raw.dataModels) ? raw.dataModels : [],
  };
}
