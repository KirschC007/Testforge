/**
 * TestForge Code-Parser v1.0
 *
 * Parses TypeScript/JavaScript project files (tRPC routers, Drizzle schemas,
 * Express routes, Zod schemas) into AnalysisIR — the same intermediate
 * representation that the LLM-based spec parser produces.
 *
 * This is a DETERMINISTIC parser — no LLM calls, no API keys required.
 * It works by static analysis of the code structure.
 *
 * Supported frameworks:
 * - tRPC v10/v11 (router, procedure, protectedProcedure, publicProcedure)
 * - Drizzle ORM (mysqlTable, pgTable, sqliteTable)
 * - Zod schemas (z.object, z.string, z.number, z.enum, z.array)
 * - Express routes (router.get, router.post, etc.)
 * - Prisma schema (.prisma files)
 * - package.json (framework detection)
 */

import type {
  AnalysisIR,
  AnalysisResult,
  Behavior,
  APIEndpoint,
  EndpointField,
  AuthModel,
  AuthRole,
  DataModel,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeFile {
  path: string;
  content: string;
}

export interface CodeParseResult {
  framework: string;
  endpointCount: number;
  tableCount: number;
  authRoles: string[];
  tenantKey: string | null;
  piiFields: string[];
  ir: AnalysisIR;
}

// ─── Framework Detection ──────────────────────────────────────────────────────

export function detectFramework(files: CodeFile[]): string {
  const parts: string[] = [];

  // Check package.json
  const pkg = files.find(f => f.path.endsWith("package.json"));
  if (pkg) {
    try {
      const deps = JSON.parse(pkg.content);
      const allDeps = { ...deps.dependencies, ...deps.devDependencies };
      if (allDeps["@trpc/server"]) parts.push("tRPC");
      if (allDeps["drizzle-orm"]) parts.push("Drizzle");
      if (allDeps["@prisma/client"] || allDeps["prisma"]) parts.push("Prisma");
      if (allDeps["express"]) parts.push("Express");
      if (allDeps["next"] || allDeps["nextjs"]) parts.push("Next.js");
      if (allDeps["fastify"]) parts.push("Fastify");
      if (allDeps["zod"]) parts.push("Zod");
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Check file contents for framework signatures
  const allContent = files.map(f => f.content).join("\n");
  if (parts.length === 0) {
    if (allContent.includes("@trpc/server") || allContent.includes("createTRPCRouter") || allContent.includes("router({")) parts.push("tRPC");
    if (allContent.includes("drizzle-orm") || allContent.includes("mysqlTable") || allContent.includes("pgTable")) parts.push("Drizzle");
    if (allContent.includes("@prisma/client") || allContent.includes("PrismaClient")) parts.push("Prisma");
    if (allContent.includes("express()") || allContent.includes("Router()")) parts.push("Express");
  }

  return parts.length > 0 ? parts.join(" + ") : "TypeScript";
}

// ─── Drizzle Schema Parser ────────────────────────────────────────────────────

interface ParsedTable {
  name: string;
  tableName: string;
  fields: EndpointField[];
  hasPII: boolean;
  tenantKey: string | null;
  statusEnum: string[] | null;
}

const PII_FIELD_NAMES = new Set([
  "email", "phone", "phoneNumber", "address", "street", "city", "zip", "zipCode",
  "postalCode", "firstName", "lastName", "fullName", "name", "dateOfBirth", "dob",
  "ssn", "taxId", "passport", "nationalId", "iban", "creditCard", "bankAccount",
  "ip", "ipAddress", "location", "geoLocation",
]);

const TENANT_KEY_NAMES = new Set([
  "tenantId", "workspaceId", "organizationId", "orgId", "bankId", "companyId",
  "restaurantId", "shopId", "storeId", "accountId", "teamId",
  "customerId", "clientId",
  // Healthcare
  "clinicId", "hospitalId", "practiceId", "facilityId",
  // Other domains
  "projectId", "channelId", "groupId", "departmentId", "branchId",
]);

function parseDrizzleTable(tableName: string, tableBody: string): ParsedTable {
  const fields: EndpointField[] = [];
  let hasPII = false;
  let tenantKey: string | null = null;
  let statusEnum: string[] | null = null;

  // Extract field definitions: fieldName: type("col_name", { ... })
  const fieldRegex = /(\w+):\s*(?:int|varchar|text|boolean|timestamp|mysqlEnum|pgEnum|real|decimal|json|uuid)\s*\(/g;
  let match;
  while ((match = fieldRegex.exec(tableBody)) !== null) {
    const fieldName = match[1];
    if (fieldName === "id") continue; // Skip primary key

    const fieldType = inferFieldType(fieldName, tableBody, match.index);
    const field: EndpointField = {
      name: fieldName,
      type: fieldType.type,
      required: !tableBody.slice(match.index, match.index + 200).includes(".optional()") &&
                !tableBody.slice(match.index, match.index + 200).includes("default("),
      enumValues: fieldType.enumValues,
      min: fieldType.min,
      max: fieldType.max,
    };

    // Detect PII
    const lowerName = fieldName.toLowerCase();
    if (PII_FIELD_NAMES.has(lowerName) || PII_FIELD_NAMES.has(fieldName)) {
      hasPII = true;
    }

    // Detect tenant key
    if (TENANT_KEY_NAMES.has(fieldName)) {
      tenantKey = fieldName;
      field.isTenantKey = true;
    }

    // Detect status enum
    if (fieldName === "status" && fieldType.enumValues) {
      statusEnum = fieldType.enumValues;
    }

    fields.push(field);
  }

  return { name: tableName, tableName, fields, hasPII, tenantKey, statusEnum };
}

function inferFieldType(fieldName: string, body: string, startIdx: number): {
  type: EndpointField["type"];
  enumValues?: string[];
  min?: number;
  max?: number;
} {
  const snippet = body.slice(startIdx, startIdx + 300);

  // Check for enum — Bug 8 Fix: handle both mysqlEnum("name", [...]) and pgEnum("name", [...])
  // Also handle: mysqlEnum([...]) without a name argument
  const enumMatch = snippet.match(/(?:mysqlEnum|pgEnum|sqliteEnum)\s*\([^)]*?\[([^\]]+)\]/);
  if (enumMatch) {
    const enumValues = enumMatch[1]
      .split(",")
      .map(v => v.trim().replace(/['"]/g, ""))
      .filter(Boolean);
    if (enumValues.length > 0) return { type: "enum", enumValues };
  }
  // Also check for standalone enum reference: status: statusEnum (variable reference)
  // In this case the snippet will just be the field name + type, no inline values
  if (snippet.match(/^\s*\w+:\s*\w*[Ee]num/)) {
    // Try to find the enum definition in the full body
    const enumVarMatch = body.match(/(?:mysqlEnum|pgEnum|sqliteEnum)\s*\([^)]*?\[([^\]]+)\]/);
    if (enumVarMatch) {
      const enumValues = enumVarMatch[1]
        .split(",")
        .map(v => v.trim().replace(/['"]/g, ""))
        .filter(Boolean);
      if (enumValues.length > 0) return { type: "enum", enumValues };
    }
  }

  // Check for varchar with length
  const varcharMatch = snippet.match(/varchar.*?length:\s*(\d+)/);
  if (varcharMatch) {
    return { type: "string", max: parseInt(varcharMatch[1]) };
  }

  // Check for int
  if (snippet.match(/^(\w+):\s*int\(/)) {
    return { type: "number" };
  }

  // Check for boolean
  if (snippet.includes("boolean(")) {
    return { type: "boolean" };
  }

  // Check for timestamp/date
  if (snippet.includes("timestamp(") || fieldName.toLowerCase().includes("date") || fieldName.toLowerCase().includes("at")) {
    return { type: "date" };
  }

  // Check for json/array
  if (snippet.includes("json(") || fieldName.toLowerCase().includes("ids") || fieldName.toLowerCase().includes("tags")) {
    return { type: "array" };
  }

  // Infer from field name
  if (fieldName.toLowerCase().includes("id") || fieldName.toLowerCase().includes("count") || fieldName.toLowerCase().includes("amount")) {
    return { type: "number" };
  }

  return { type: "string" };
}

function parseDrizzleSchemas(files: CodeFile[]): ParsedTable[] {
  const tables: ParsedTable[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue;
    const content = file.content;

    // Match: export const tableName = mysqlTable("table_name", { ... })
    const tableRegex = /export\s+const\s+(\w+)\s*=\s*(?:mysqlTable|pgTable|sqliteTable)\s*\(\s*["']([^"']+)["']\s*,\s*\{([\s\S]*?)\}\s*\)/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      const varName = match[1];
      const tableBody = match[3];
      const parsed = parseDrizzleTable(varName, tableBody);
      tables.push(parsed);
    }
  }

  return tables;
}

// ─── Prisma Schema Parser ─────────────────────────────────────────────────────

function parsePrismaSchemas(files: CodeFile[]): ParsedTable[] {
  const tables: ParsedTable[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".prisma")) continue;
    const content = file.content;

    // ISSUE 3 FIX: First, extract all Prisma enum definitions
    // Pattern: enum StatusEnum { VALUE_A VALUE_B VALUE_C }
    const prismaEnums: Record<string, string[]> = {};
    const enumBlockRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumBlockRegex.exec(content)) !== null) {
      const enumName = enumMatch[1];
      const enumBody = enumMatch[2];
      const values = enumBody
        .split(/[\n,\s]+/)
        .map(v => v.trim())
        .filter(v => v && !v.startsWith("//") && !v.startsWith("@") && !v.startsWith("@@"));
      if (values.length > 0) {
        prismaEnums[enumName] = values;
      }
    }

    // Match: model ModelName { ... }
    const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1];
      const body = match[2];
      const fields: EndpointField[] = [];
      let hasPII = false;
      let tenantKey: string | null = null;
      let statusEnum: string[] | null = null;

      const fieldLines = body.split("\n").filter(l => l.trim() && !l.trim().startsWith("//"));
      for (const line of fieldLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("@") || trimmed.startsWith("@@") || trimmed.startsWith("//")) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 2) continue;
        const [fname, ftype] = parts;
        if (fname.startsWith("@") || fname.startsWith("//")) continue;

        const isOptional = ftype.endsWith("?");
        const baseType = ftype.replace("?", "").replace("[]", "");
        const isArray = ftype.includes("[]");

        let fieldType: EndpointField["type"] = "string";
        let enumValues: string[] | undefined;

        if (baseType === "Int" || baseType === "Float" || baseType === "Decimal") fieldType = "number";
        else if (baseType === "Boolean") fieldType = "boolean";
        else if (baseType === "DateTime") fieldType = "date";
        else if (isArray) fieldType = "array";
        else if (prismaEnums[baseType]) {
          // ISSUE 3 FIX: Resolve Prisma enum reference
          fieldType = "enum";
          enumValues = prismaEnums[baseType];
          // Track status enum
          if (fname === "status" && !statusEnum) {
            statusEnum = enumValues;
          }
        }

        const lowerName = fname.toLowerCase();
        if (PII_FIELD_NAMES.has(lowerName)) hasPII = true;
        if (TENANT_KEY_NAMES.has(fname)) tenantKey = fname;

        fields.push({ name: fname, type: fieldType, required: !isOptional, enumValues });
      }

      tables.push({ name: modelName, tableName: modelName.toLowerCase(), fields, hasPII, tenantKey, statusEnum });
    }
  }

  return tables;
}

// ─── tRPC Router Parser ───────────────────────────────────────────────────────

interface ParsedProcedure {
  name: string;
  fullName: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  isProtected: boolean;
  inputFields: EndpointField[];
  authMiddleware: string;
  detectedTenantKey?: string | null;  // e.g. 'orgId' from req.user.orgId
  detectedRoles?: string[];           // e.g. ['admin', 'doctor'] from user.role === 'admin'
}

function parseZodObject(zodBody: string): EndpointField[] {
  const fields: EndpointField[] = [];

  // Match: fieldName: z.type(...) or fieldName: z.type().optional()
  const fieldRegex = /(\w+):\s*z\.(string|number|boolean|enum|array|object|date|coerce)([^,\n]*)/g;
  let match;
  while ((match = fieldRegex.exec(zodBody)) !== null) {
    const fieldName = match[1];
    const zodType = match[2];
    const rest = match[3];

    let type: EndpointField["type"] = "string";
    let enumValues: string[] | undefined;
    let min: number | undefined;
    let max: number | undefined;
    let isTenantKey = false;

    if (zodType === "number") type = "number";
    else if (zodType === "boolean") type = "boolean";
    else if (zodType === "date") type = "date";
    else if (zodType === "array") type = "array";
    else if (zodType === "enum") {
      type = "enum";
      const enumMatch = rest.match(/\[([^\]]+)\]/);
      if (enumMatch) {
        enumValues = enumMatch[1]
          .split(",")
          .map(v => v.trim().replace(/['"]/g, ""))
          .filter(Boolean);
      }
    }

    // Extract min/max
    const minMatch = rest.match(/\.min\((\d+)\)/);
    const maxMatch = rest.match(/\.max\((\d+)\)/);
    if (minMatch) min = parseInt(minMatch[1]);
    if (maxMatch) max = parseInt(maxMatch[1]);

    const isRequired = !rest.includes(".optional()") && !rest.includes(".nullish()");

    if (TENANT_KEY_NAMES.has(fieldName)) isTenantKey = true;

    fields.push({ name: fieldName, type, required: isRequired, enumValues, min, max, isTenantKey });
  }

  return fields;
}

function parseTRPCRouters(files: CodeFile[], routerPrefix?: string): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue;
    const content = file.content;

    // Bug 3 Fix: Detect ALL router exports in the file using matchAll (not just the first)
    // Pattern: export const vehiclesRouter = createTRPCRouter({...}) → "vehicles"
    // Pattern: export const bookingsRouter = router({...}) → "bookings"
    // Fallback: use filename (e.g. accounts.ts → "accounts")
    const fileBase = file.path.split("/").pop()?.replace(/\.(ts|tsx)$/, "") || "api";
    const GENERIC_NAMES = new Set(["app", "api", "trpc", "main", "index", "router", "routers", "routes", "appRouter", "root", "server", "backend", "handlers", "controller", "controllers"]);

    // Find ALL router exports in the file
    const routerExportRegex = /export\s+const\s+(\w+)\s*=\s*(?:createTRPCRouter|router|createRouter|t\.router)\s*\(\s*\{/g;
    const routerExports = Array.from(content.matchAll(routerExportRegex));

    if (routerExports.length > 1) {
      // Multiple routers in one file → parse each block separately
      for (let i = 0; i < routerExports.length; i++) {
        const exportMatch = routerExports[i];
        const exportName = exportMatch[1];
        const stripped = exportName.replace(/(?:Router|router|Route|route|Handler|handler)$/i, "");
        const routerName = (stripped && !GENERIC_NAMES.has(stripped.toLowerCase()))
          ? stripped.toLowerCase()
          : fileBase;

        // Slice the content block for this router
        const startIdx = exportMatch.index! + exportMatch[0].length;
        const endIdx = i + 1 < routerExports.length
          ? routerExports[i + 1].index!
          : content.length;
        const routerBlock = content.slice(startIdx, endIdx);

        // Extract procedures from this router block
        const blockProcRegex = /(\w+):\s*(protectedProcedure|publicProcedure|require\w+|\w+Procedure)\s*(?:\.input\s*\(\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\))?\s*\.(query|mutation)/g;
        let blockMatch;
        while ((blockMatch = blockProcRegex.exec(routerBlock)) !== null) {
          const procName = blockMatch[1];
          const authMiddleware = blockMatch[2];
          const inputBody = blockMatch[3] || "";
          const queryOrMutation = blockMatch[4];

          const isProtected = authMiddleware !== "publicProcedure";
          let httpMethod: ParsedProcedure["method"] = queryOrMutation === "query" ? "GET" : "POST";
          if (queryOrMutation === "mutation") {
            if (procName.startsWith("delete") || procName.startsWith("remove")) httpMethod = "DELETE";
            else if (procName.startsWith("update") || procName.startsWith("patch") || procName.startsWith("edit")) httpMethod = "PATCH";
            else if (procName.startsWith("create") || procName.startsWith("add") || procName.startsWith("bulk")) httpMethod = "POST";
            else httpMethod = "POST";
          }

          const prefix = routerPrefix || routerName;
          const fullName = `${prefix}.${procName}`;
          const inputFields = parseZodObject(inputBody);

          procedures.push({ name: procName, fullName, method: httpMethod, isProtected, inputFields, authMiddleware });
        }
      }
    } else {
      // Single router or no named export
      let singleBase = fileBase;
      if (routerExports.length === 1) {
        const exportName = routerExports[0][1];
        const stripped = exportName.replace(/(?:Router|router|Route|route|Handler|handler)$/i, "");
        if (stripped && !GENERIC_NAMES.has(stripped.toLowerCase())) singleBase = stripped.toLowerCase();
      }

      // v9.1: Detect nested router() calls inside the main router
      // Pattern: auth: router({ login: publicProcedure... })
      // This gives us the correct prefix "auth" instead of "routers"
      const nestedRouterRegex = /(\w+)\s*:\s*(?:createTRPCRouter|router|createRouter|t\.router)\s*\(\s*\{/g;
      const nestedMatches = Array.from(content.matchAll(nestedRouterRegex));

      // Filter: only real nested routers (not the top-level export)
      const topLevelExportNames = routerExports.map(m => m[1]);
      const nestedRouters = nestedMatches.filter(m => {
        const name = m[1];
        if (topLevelExportNames.includes(name)) return false;
        if (GENERIC_NAMES.has(name.toLowerCase())) return false;
        return true;
      });

      if (nestedRouters.length > 0) {
        // Parse each nested router block with its correct prefix
        for (let i = 0; i < nestedRouters.length; i++) {
          const nestedMatch = nestedRouters[i];
          const nestedName = nestedMatch[1]; // e.g. "auth", "analyses", "angebote"
          const startIdx = nestedMatch.index! + nestedMatch[0].length;

          // Find the end of this nested router block (matching braces)
          let braceDepth = 1;
          let endIdx = startIdx;
          for (let j = startIdx; j < content.length && braceDepth > 0; j++) {
            if (content[j] === "{") braceDepth++;
            if (content[j] === "}") braceDepth--;
            endIdx = j;
          }

          const nestedBlock = content.slice(startIdx, endIdx);

          // Extract procedures from this nested block
          const blockProcRegex = /(\w+):\s*(protectedProcedure|publicProcedure|require\w+|\w+Procedure)\s*(?:\.input\s*\(\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\))?\s*\.(query|mutation)/g;
          let blockMatch;
          while ((blockMatch = blockProcRegex.exec(nestedBlock)) !== null) {
            const procName = blockMatch[1];
            const authMiddleware = blockMatch[2];
            const inputBody = blockMatch[3] || "";
            const queryOrMutation = blockMatch[4];

            const isProtected = authMiddleware !== "publicProcedure";
            let httpMethod: ParsedProcedure["method"] = queryOrMutation === "query" ? "GET" : "POST";
            if (queryOrMutation === "mutation") {
              if (procName.startsWith("delete") || procName.startsWith("remove")) httpMethod = "DELETE";
              else if (procName.startsWith("update") || procName.startsWith("patch") || procName.startsWith("edit")) httpMethod = "PATCH";
              else if (procName.startsWith("create") || procName.startsWith("add") || procName.startsWith("bulk")) httpMethod = "POST";
              else httpMethod = "POST";
            }

            const fullName = `${nestedName}.${procName}`;
            const inputFields = parseZodObject(inputBody);
            procedures.push({ name: procName, fullName, method: httpMethod, isProtected, inputFields, authMiddleware });
          }
        }
      } else {
        // No nested routers — use existing flat parsing logic
        const procRegex = /(\w+):\s*(protectedProcedure|publicProcedure|require\w+|\w+Procedure)\s*(?:\.input\s*\(\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\))?\s*\.(query|mutation)/g;
        let match;
        while ((match = procRegex.exec(content)) !== null) {
          const procName = match[1];
          const authMiddleware = match[2];
          const inputBody = match[3] || "";
          const queryOrMutation = match[4];

          const isProtected = authMiddleware !== "publicProcedure";
          let httpMethod: ParsedProcedure["method"] = queryOrMutation === "query" ? "GET" : "POST";
          if (queryOrMutation === "mutation") {
            if (procName.startsWith("delete") || procName.startsWith("remove")) httpMethod = "DELETE";
            else if (procName.startsWith("update") || procName.startsWith("patch") || procName.startsWith("edit")) httpMethod = "PATCH";
            else if (procName.startsWith("create") || procName.startsWith("add") || procName.startsWith("bulk")) httpMethod = "POST";
            else httpMethod = "POST";
          }

          const prefix = routerPrefix || singleBase;
          const fullName = `${prefix}.${procName}`;
          const inputFields = parseZodObject(inputBody);

          procedures.push({
            name: procName,
            fullName,
            method: httpMethod,
            isProtected,
            inputFields,
            authMiddleware,
          });
        }
      }
    }
  }

  return procedures;
}

// ─── Express Route Parser ─────────────────────────────────────────────────────

function httpVerbToAction(verb: string, hasId: boolean): string {
  const map: Record<string, string> = {
    GET: hasId ? "getById" : "list",
    POST: "create",
    PUT: "update",
    PATCH: hasId ? "update" : "updateStatus",
    DELETE: "delete",
  };
  return map[verb] || "call";
}

/**
 * Extract the handler body starting from a given position in the file content.
 * Returns up to 2000 chars of the handler function body.
 */
function extractHandlerBlock(content: string, fromIndex: number): string {
  // Find the opening brace of the handler
  const slice = content.slice(fromIndex, fromIndex + 3000);
  const braceIdx = slice.indexOf("{");
  if (braceIdx === -1) return "";
  let depth = 0;
  let i = braceIdx;
  for (; i < slice.length; i++) {
    if (slice[i] === "{") depth++;
    else if (slice[i] === "}") { depth--; if (depth === 0) break; }
  }
  return slice.slice(braceIdx, i + 1);
}

/**
 * Extract Zod/Joi validation fields from a handler body string.
 */
function extractValidationFields(handlerBody: string): import("./types").EndpointField[] {
  // Try to find z.object({...}) in the handler
  const zodMatch = handlerBody.match(/z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (zodMatch) return parseZodObject(zodMatch[1]);
  // Try req.body destructuring: const { name, email } = req.body
  const bodyMatch = handlerBody.match(/const\s*\{([^}]+)\}\s*=\s*req\.body/);
  if (bodyMatch) {
    return bodyMatch[1].split(",").map(s => s.trim()).filter(Boolean).map(name => ({
      name, type: "string" as const, required: false,
    }));
  }
  return [];
}

/**
 * Derive resource.action name from an Express/REST path.
 * "/api/v1/bookings/:id/status" → "bookings.updateStatus"
 */
function pathToResourceAction(path: string, httpVerb: string): string {
  // Remove /api/ or /api/v1/ prefix
  const stripped = path.replace(/^\/api\/(?:v\d+\/)?/, "");
  const segments = stripped.split("/").filter(s => s && !s.startsWith(":"));
  const resource = segments[0] || "resource";
  const hasId = path.includes(":");
  if (segments.length > 1) {
    const subAction = segments[segments.length - 1];
    return `${resource}.${subAction}`;
  }
  return `${resource}.${httpVerbToAction(httpVerb, hasId)}`;
}

/**
 * Enhanced Express route parser.
 * Handles: router.get/post/put/patch/delete('/path', handler)
 *          app.get/post/put/patch/delete('/path', handler)
 * Extracts: Zod/Joi input fields from handler body, auth middleware detection.
 */
function parseExpressRoutes(files: CodeFile[]): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx") && !file.path.endsWith(".js")) continue;
    const content = file.content;
    if (!content.includes("router.") && !content.includes("app.")) continue;

    // Pattern: router.get/post/put/patch/delete('/path', ...handlers)
    //          app.get/post/put/patch/delete('/path', ...handlers)
    const routeRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const httpVerb = match[1].toUpperCase();
      const path = match[2];

      // Derive resource.action name
      const procName = pathToResourceAction(path, httpVerb);

      // Extract handler body for field/auth detection
      const handlerBlock = extractHandlerBlock(content, match.index);
      const inputFields = extractValidationFields(handlerBlock);

      // Auth detection: check for common middleware names
      const isProtected = handlerBlock.includes("requireAuth") ||
                          handlerBlock.includes("authenticate") ||
                          handlerBlock.includes("passport") ||
                          content.slice(0, match.index).includes("requireAuth") ||
                          content.includes("authMiddleware");

      const authMiddleware = handlerBlock.includes("requireAdmin") ? "requireAdmin" : "requireAuth";

       // Role detection from handler body: user.role === 'admin' / req.user.role === 'doctor'
      const roleMatches = Array.from(handlerBlock.matchAll(/(?:req\.user|user|ctx\.user)\.role\s*[!=]==?\s*['"]([a-zA-Z_]+)['"]/g));
      const detectedRoles: string[] = roleMatches.map(rm => rm[1]);
      // Tenant key detection from handler body:
      //   req.user.orgId / user.orgId / ctx.user.clinicId
      //   req.session.clinicId / session.clinicId
      const tenantKeyMatch =
        handlerBlock.match(/(?:req\.user|user|ctx\.user)\.([a-zA-Z]+(?:Id|_id))/) ||
        handlerBlock.match(/(?:req\.session|session)\.([a-zA-Z]+(?:Id|_id))/);
      const detectedTenantKey = tenantKeyMatch && TENANT_KEY_NAMES.has(tenantKeyMatch[1]) ? tenantKeyMatch[1] : null;

      // PII export detection
      const hasPIIExport = handlerBlock.includes('Content-Disposition') || handlerBlock.includes('text/csv') ||
                           procName.includes('export') || procName.includes('Export');

      // Missing tenant filter: findAll without orgId/tenantId
      const hasMissingTenantFilter = detectedTenantKey !== null &&
        (handlerBlock.includes('findAll') || handlerBlock.includes('findMany')) &&
        !handlerBlock.includes(detectedTenantKey);

      procedures.push({
        name: procName,
        fullName: `${httpVerb} ${path}`,
        method: httpVerb as ParsedProcedure["method"],
        isProtected,
        inputFields,
        authMiddleware,
        detectedTenantKey,
        detectedRoles: detectedRoles.length > 0 ? detectedRoles : undefined,
      });
    }
  }
  return procedures;
}

/**
 * Next.js App Router route parser.
 * Handles: app/api/bookings/route.ts → bookings.list, bookings.create
 *          app/api/bookings/[id]/route.ts → bookings.getById, bookings.update, bookings.delete
 *          app/api/bookings/[id]/status/route.ts → bookings.status
 */
function extractNextAppRoutes(files: CodeFile[]): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];

  // Filter: Next.js App Router route files
  const routeFiles = files.filter(f =>
    f.path.includes("/api/") && f.path.endsWith("route.ts")
  );

  for (const file of routeFiles) {
    // Derive path from file path: "app/api/bookings/[id]/status/route.ts" → "bookings/[id]/status"
    const apiPath = file.path.split("/api/")[1]?.replace("/route.ts", "") || "";
    const segments = apiPath.split("/").filter(s => !s.startsWith("["));
    const resource = segments[0] || "resource";
    const hasId = file.path.includes("[");

    // Check which HTTP methods are exported
    for (const verb of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const hasExport =
        file.content.includes(`export async function ${verb}`) ||
        file.content.includes(`export function ${verb}`) ||
        file.content.includes(`export const ${verb}`);
      if (!hasExport) continue;

      const action = segments.length > 1
        ? segments[segments.length - 1]
        : httpVerbToAction(verb, hasId);

      // Extract Zod validation if present
      const zodMatch = file.content.match(/z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/);
      const inputFields = zodMatch ? parseZodObject(zodMatch[1]) : [];

      const isProtected =
        file.content.includes("getServerSession") ||
        file.content.includes("auth(") ||
        file.content.includes("requireAuth") ||
        file.content.includes("withAuth");

      procedures.push({
        name: `${resource}.${action}`,
        fullName: `${verb} /api/${apiPath}`,
        method: verb,
        isProtected,
        inputFields,
        authMiddleware: "requireAuth",
      });
    }
  }
  return procedures;
}

// ─── IR Builder ───────────────────────────────────────────────────────────────

function buildIRFromCode(
  tables: ParsedTable[],
  procedures: ParsedProcedure[],
  framework: string
): AnalysisIR {
  const behaviors: Behavior[] = [];
  const apiEndpoints: APIEndpoint[] = [];
  const dataModels: DataModel[] = [];

  // Detect global tenant key from tables
  // First: check known TENANT_KEY_NAMES list
  let globalTenantKey = tables.find(t => t.tenantKey)?.tenantKey || null;
  // Second: if not found, use 60%-threshold heuristic for any *Id field
  if (!globalTenantKey && tables.length >= 2) {
    const fieldCounts: Record<string, number> = {};
    for (const table of tables) {
      for (const field of table.fields) {
        const fn = field.name;
        if ((fn.endsWith("Id") || fn.endsWith("id")) && fn !== "id" && !TENANT_KEY_NAMES.has(fn)) {
          fieldCounts[field.name] = (fieldCounts[field.name] || 0) + 1;
        }
      }
    }
    const totalTables = tables.length;
    const detected = Object.entries(fieldCounts)
      .filter(([, count]) => count / totalTables >= 0.6)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (detected) {
      globalTenantKey = detected;
      // Mark the field as tenant key in all tables
      for (const table of tables) {
        const f = table.fields.find(fld => fld.name === detected);
        if (f) { f.isTenantKey = true; table.tenantKey = detected; }
      }
    }
  }

  // Third fallback: if still no globalTenantKey, scan procedure handler bodies
  if (!globalTenantKey && procedures.length > 0) {
    const tenantKeyCounts: Record<string, number> = {};
    for (const proc of procedures) {
      if (proc.detectedTenantKey) {
        tenantKeyCounts[proc.detectedTenantKey] = (tenantKeyCounts[proc.detectedTenantKey] || 0) + 1;
      }
    }
    const mostCommon = Object.entries(tenantKeyCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 1) {
      globalTenantKey = mostCommon[0];
    }
  }
  // Build behaviors from procedures
  let behaviorIdx = 0;
  for (const proc of procedures) {
    behaviorIdx++;
    const id = `B-${String(behaviorIdx).padStart(3, "0")}`;

    // Infer behavior from procedure name and input fields
    const action = inferAction(proc.name, proc.method);
    const subject = inferSubject(proc.fullName);
    const tenantField = proc.inputFields.find(f => f.isTenantKey)?.name || proc.detectedTenantKey || globalTenantKey;

    const preconditions: string[] = [];
    const postconditions: string[] = [];
    const errorCases: string[] = [];
    const riskHints: string[] = [];
    const tags: string[] = [];

    if (proc.isProtected) {
      preconditions.push("User must be authenticated (valid JWT)");
      errorCases.push("Missing or invalid JWT → 401");
    }

    if (tenantField) {
      preconditions.push(`${tenantField} must match authenticated user's tenant`);
      errorCases.push(`${tenantField} mismatch → 403`);
      riskHints.push("IDOR: cross-tenant access possible if tenant isolation not enforced");
      tags.push("tenant_isolation");
    }

    // Boundary constraints from Zod schema
    for (const field of proc.inputFields) {
      if (field.min !== undefined || field.max !== undefined) {
        const constraints: string[] = [];
        if (field.min !== undefined) constraints.push(`min: ${field.min}`);
        if (field.max !== undefined) constraints.push(`max: ${field.max}`);
        preconditions.push(`${field.name} must be within bounds (${constraints.join(", ")})`);
        errorCases.push(`${field.name} out of bounds → 400`);
        riskHints.push(`Boundary: ${field.name} (${constraints.join(", ")})`);
        tags.push("boundary");
      }
      if (field.type === "enum" && field.enumValues) {
        errorCases.push(`Invalid ${field.name} value → 400`);
      }
    }

    // Status transitions
    const statusField = proc.inputFields.find(f => f.name === "status");
    if (statusField?.enumValues) {
      tags.push("status_transition");
      riskHints.push("Status machine: validate allowed transitions");
    }

    // Auth matrix
    if (proc.authMiddleware !== "publicProcedure") {
      tags.push("auth_matrix");
      riskHints.push("Auth: verify role-based access control");
    }

    // CSRF for mutations
    if (proc.method !== "GET") {
      tags.push("csrf");
      riskHints.push("CSRF: state-changing endpoint requires token validation");
    }

    // Concurrency for financial/critical operations
    if (proc.name.toLowerCase().includes("transfer") || proc.name.toLowerCase().includes("payment") ||
        proc.name.toLowerCase().includes("debit") || proc.name.toLowerCase().includes("credit") ||
        proc.name.toLowerCase().includes("balance")) {
      tags.push("concurrency");
      riskHints.push("Concurrency: race condition possible in financial operations");
    }

    // Idempotency
    const hasIdempotencyKey = proc.inputFields.some(f =>
      f.name === "idempotencyKey" || f.name === "requestId" || f.name === "clientId"
    );
    if (hasIdempotencyKey) {
      tags.push("idempotency");
      riskHints.push("Idempotency: duplicate requests must return same result");
    }

    // Rate limiting: login/signin endpoints are brute-force targets
    if (proc.name.toLowerCase().includes("login") || proc.name.toLowerCase().includes("signin") ||
        proc.name.toLowerCase().includes("authenticate") ||
        (proc.name.toLowerCase().includes("token") && !proc.isProtected)) {
      tags.push("rate-limit");
      riskHints.push("brute-force: rate-limit login attempts (5 per 10 min) \u2192 429");
    }

    if (proc.method === "DELETE" || proc.name.startsWith("delete") || proc.name.startsWith("remove")) {
      postconditions.push("Resource is removed or soft-deleted");
      errorCases.push("Resource not found → 404");
    } else if (proc.method === "POST" && (proc.name.startsWith("create") || proc.name.startsWith("add"))) {
      postconditions.push("New resource created and returned with ID");
      errorCases.push("Duplicate resource → 409");
    } else if (proc.method === "GET") {
      postconditions.push("Resource data returned");
      errorCases.push("Resource not found → 404");
    }

    behaviors.push({
      id,
      title: `${action} ${subject}`,
      subject,
      action,
      object: subject,
      preconditions,
      postconditions,
      errorCases,
      tags,
      riskHints,
    });

    // Build APIEndpoint
    const httpMethod = `${proc.method} /api/trpc/${proc.fullName}`;
    apiEndpoints.push({
      name: proc.fullName,
      method: httpMethod,
      auth: proc.authMiddleware,
      relatedBehaviors: [id],
      inputFields: proc.inputFields,
    });
  }

  // Build DataModels from tables
  for (const table of tables) {
    dataModels.push({
      name: table.name,
      fields: table.fields.map(f => ({
        name: f.name,
        type: f.type,
        required: f.required,
        pii: PII_FIELD_NAMES.has(f.name.toLowerCase()),
      })),
      relations: [],
      hasPII: table.hasPII,
    });
  }

  // Build auth model — collect roles from procedure handler bodies (Fix 3)
  const allDetectedRoles = new Set<string>();
  for (const proc of procedures) {
    if (proc.detectedRoles) {
      for (const r of proc.detectedRoles) allDetectedRoles.add(r);
    }
  }
  // Ensure admin and user are always present as fallback
  allDetectedRoles.add("admin");
  allDetectedRoles.add("user");
  const authRoles: AuthRole[] = Array.from(allDetectedRoles).map(roleName => ({
    name: roleName,
    envUserVar: `E2E_${roleName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_USER`,
    envPassVar: `E2E_${roleName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PASS`,
    defaultUser: `${roleName}@test.com`,
    defaultPass: "password",
  }));
  const authModel: AuthModel = {
    loginEndpoint: "/api/auth/login",
    csrfEndpoint: "/api/auth/csrf-token",
    roles: authRoles,
  };

  // Build resources from tables
  const resources = tables.map(t => ({
    name: t.name,
    table: t.tableName,
    tenantKey: t.tenantKey || globalTenantKey || "tenantId",
    operations: ["create", "read", "update", "delete"],
    hasPII: t.hasPII,
  }));

  // Build enums from tables
  const enums: Record<string, string[]> = {};
  for (const table of tables) {
    for (const field of table.fields) {
      if (field.type === "enum" && field.enumValues) {
        enums[`${table.name}.${field.name}`] = field.enumValues;
      }
    }
  }

  // Fix 3B: Back-propagate enum values from Zod input schemas into table fields
  // This handles Prisma scenarios where status fields are String @db.VarChar(20) with @default("draft")
  // but the actual enum values are defined in the Zod .input() schemas of the router
  for (const ep of apiEndpoints) {
    for (const field of ep.inputFields) {
      if (field.type === "enum" && field.enumValues?.length) {
        // Write enum values back into matching table fields
        for (const table of tables) {
          const tableField = table.fields.find(f => f.name === field.name);
          if (tableField && (!tableField.enumValues || tableField.enumValues.length === 0)) {
            tableField.enumValues = field.enumValues;
            tableField.type = "enum";
            // Update statusEnum on table if this is a status field
            if (field.name === "status" && !table.statusEnum) {
              table.statusEnum = field.enumValues;
            }
          }
        }
        // Write into global enums by field name (not table-qualified) for easy lookup
        if (!enums[field.name]) {
          enums[field.name] = field.enumValues;
        }
      }
    }
  }

  // Build status machine from first table with status enum (after back-propagation)
  const statusTable = tables.find(t => t.statusEnum);
  const statusMachine = statusTable?.statusEnum ? {
    states: statusTable.statusEnum,
    transitions: buildStatusTransitions(statusTable.statusEnum),
    forbidden: [] as [string, string][],
    initialState: statusTable.statusEnum[0],
    terminalStates: [statusTable.statusEnum[statusTable.statusEnum.length - 1]],
  } : null;

  // DSGVO behaviors for PII tables
  const piiTables = tables.filter(t => t.hasPII);
  for (const piiTable of piiTables) {
    behaviorIdx++;
    const id = `B-${String(behaviorIdx).padStart(3, "0")}`;
    behaviors.push({
      id,
      title: `GDPR anonymization for ${piiTable.name}`,
      subject: piiTable.name,
      action: "anonymize",
      object: piiTable.name,
      preconditions: ["User requests data deletion"],
      postconditions: ["All PII fields anonymized or deleted"],
      errorCases: ["User not found → 404"],
      tags: ["dsgvo"],
      riskHints: ["DSGVO: PII must be anonymizable on user request"],
    });
  }

  return {
    behaviors,
    invariants: [],
    ambiguities: [],
    contradictions: [],
    tenantModel: globalTenantKey ? {
      // ISSUE 4 FIX: Derive tenantEntity from tenantIdField
      // "shopId" → "shop", "gymId" → "gym", "organizationId" → "organization", "workspaceId" → "workspace"
      tenantEntity: globalTenantKey.replace(/Id$/, "").replace(/([A-Z])/g, (m) => m.toLowerCase()),
      tenantIdField: globalTenantKey,
    } : null,
    resources,
    apiEndpoints,
    authModel,
    enums,
    statusMachine,
    dataModels,
  };
}

function inferAction(procName: string, method: string): string {
  if (procName.startsWith("create") || procName.startsWith("add")) return "Create";
  if (procName.startsWith("update") || procName.startsWith("edit") || procName.startsWith("patch")) return "Update";
  if (procName.startsWith("delete") || procName.startsWith("remove")) return "Delete";
  if (procName.startsWith("list") || procName.startsWith("get") || procName.startsWith("fetch")) return "Get";
  if (procName.startsWith("bulk")) return "Bulk operation on";
  if (method === "GET") return "Get";
  return "Mutate";
}

function inferSubject(fullName: string): string {
  // Use the full procedure name as subject to avoid dedup across endpoints
  // e.g. "admin.login" → "admin login", "angebote.create" → "angebote create"
  return fullName.replace(/\./g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function buildStatusTransitions(states: string[]): [string, string][] {
  // Build a simple linear state machine if we have ordered states
  const transitions: [string, string][] = [];
  for (let i = 0; i < states.length - 1; i++) {
    transitions.push([states[i], states[i + 1]]);
  }
  return transitions;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse code files into AnalysisIR.
 * This is the main entry point for the Code-Scan path.
 */
export function parseCodeToIR(files: CodeFile[]): AnalysisResult & { parseResult: CodeParseResult } {
  // 1. Detect framework
  const framework = detectFramework(files);

  // 2. Parse schemas
  const drizzleTables = parseDrizzleSchemas(files);
  const prismaTables = parsePrismaSchemas(files);
  const allTables = [...drizzleTables, ...prismaTables];

  // 3. Parse routes/procedures
  const trpcProcedures = parseTRPCRouters(files);
  const expressProcedures = parseExpressRoutes(files);
  const nextProcedures = extractNextAppRoutes(files);
  const allProcedures = [...trpcProcedures, ...expressProcedures, ...nextProcedures];

  // 4. Build IR
  const ir = buildIRFromCode(allTables, allProcedures, framework);

  // 5. Collect metadata
  // The buildIRFromCode call above already applied the 60%-threshold heuristic and mutated allTables
  const tenantKey = allTables.find(t => t.tenantKey)?.tenantKey || null;
  const piiFields: string[] = [];
  for (const table of allTables) {
    for (const field of table.fields) {
      if (PII_FIELD_NAMES.has(field.name.toLowerCase())) {
        piiFields.push(`${table.name}.${field.name}`);
      }
    }
  }

  const authRoles: string[] = [];
  for (const proc of allProcedures) {
    if (proc.authMiddleware && proc.authMiddleware !== "publicProcedure" && !authRoles.includes(proc.authMiddleware)) {
      authRoles.push(proc.authMiddleware);
    }
  }

  const parseResult: CodeParseResult = {
    framework,
    endpointCount: allProcedures.length,
    tableCount: allTables.length,
    authRoles,
    tenantKey,
    piiFields,
    ir,
  };

  return {
    ir,
    qualityScore: Math.min(100, Math.round(
      (allProcedures.length > 0 ? 30 : 0) +
      (allTables.length > 0 ? 30 : 0) +
      (tenantKey ? 20 : 0) +
      (piiFields.length > 0 ? 10 : 0) +
      (authRoles.length > 0 ? 10 : 0)
    )),
    specType: `code:${framework}`,
    parseResult,
  };
}
