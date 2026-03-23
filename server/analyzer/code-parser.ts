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
  "restaurantId", "shopId", "storeId", "accountId", "teamId", "projectId",
  "customerId", "clientId",
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

      const fieldLines = body.split("\n").filter(l => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("@"));
      for (const line of fieldLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const [fname, ftype] = parts;
        if (fname.startsWith("@") || fname.startsWith("//")) continue;

        const isOptional = ftype.endsWith("?");
        const baseType = ftype.replace("?", "").replace("[]", "");
        const isArray = ftype.includes("[]");

        let fieldType: EndpointField["type"] = "string";
        if (baseType === "Int" || baseType === "Float" || baseType === "Decimal") fieldType = "number";
        else if (baseType === "Boolean") fieldType = "boolean";
        else if (baseType === "DateTime") fieldType = "date";
        else if (isArray) fieldType = "array";

        const lowerName = fname.toLowerCase();
        if (PII_FIELD_NAMES.has(lowerName)) hasPII = true;
        if (TENANT_KEY_NAMES.has(fname)) tenantKey = fname;

        fields.push({ name: fname, type: fieldType, required: !isOptional });
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

    // Detect router name from file path
    const fileBase = file.path.split("/").pop()?.replace(/\.(ts|tsx)$/, "") || "api";

    // Match procedure definitions: name: (protectedProcedure|publicProcedure|requireXxx).input(...).query/mutation
    const procRegex = /(\w+):\s*(protectedProcedure|publicProcedure|requireWorkspaceAuth|requireRestaurantAuth|requireAuth|\w+Procedure)\s*(?:\.input\s*\(\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\))?\s*\.(query|mutation)/g;
    let match;
    while ((match = procRegex.exec(content)) !== null) {
      const procName = match[1];
      const authMiddleware = match[2];
      const inputBody = match[3] || "";
      const queryOrMutation = match[4];

      const isProtected = authMiddleware !== "publicProcedure";
      const method: "GET" | "POST" = queryOrMutation === "query" ? "GET" : "POST";

      // Determine HTTP method more precisely for mutations
      let httpMethod: ParsedProcedure["method"] = method;
      if (queryOrMutation === "mutation") {
        if (procName.startsWith("delete") || procName.startsWith("remove")) httpMethod = "DELETE";
        else if (procName.startsWith("update") || procName.startsWith("patch") || procName.startsWith("edit")) httpMethod = "PATCH";
        else if (procName.startsWith("create") || procName.startsWith("add") || procName.startsWith("bulk")) httpMethod = "POST";
        else httpMethod = "POST";
      }

      const prefix = routerPrefix || fileBase;
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

  return procedures;
}

// ─── Express Route Parser ─────────────────────────────────────────────────────

function parseExpressRoutes(files: CodeFile[]): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx") && !file.path.endsWith(".js")) continue;
    const content = file.content;

    // Match: router.get/post/put/patch/delete('/path', middleware?, handler)
    const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const httpVerb = match[1].toUpperCase() as ParsedProcedure["method"];
      const path = match[2];
      const procName = path.replace(/[/:]/g, "_").replace(/^_/, "").replace(/_+$/, "") || "handler";

      procedures.push({
        name: procName,
        fullName: path,
        method: httpVerb,
        isProtected: content.slice(0, match.index).includes("authenticate") ||
                     content.includes("requireAuth") || content.includes("authMiddleware"),
        inputFields: [],
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
  const globalTenantKey = tables.find(t => t.tenantKey)?.tenantKey || null;

  // Build behaviors from procedures
  let behaviorIdx = 0;
  for (const proc of procedures) {
    behaviorIdx++;
    const id = `B-${String(behaviorIdx).padStart(3, "0")}`;

    // Infer behavior from procedure name and input fields
    const action = inferAction(proc.name, proc.method);
    const subject = inferSubject(proc.fullName);
    const tenantField = proc.inputFields.find(f => f.isTenantKey)?.name || globalTenantKey;

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

  // Build auth model
  const authRoles: AuthRole[] = [
    { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "admin@test.com", defaultPass: "password" },
    { name: "user", envUserVar: "E2E_USER_USER", envPassVar: "E2E_USER_PASS", defaultUser: "user@test.com", defaultPass: "password" },
  ];

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

  // Build status machine from first table with status enum
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
    tenantModel: globalTenantKey ? { tenantEntity: "workspace", tenantIdField: globalTenantKey } : null,
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
  const parts = fullName.split(".");
  return parts[0] || fullName;
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
  const allProcedures = [...trpcProcedures, ...expressProcedures];

  // 4. Build IR
  const ir = buildIRFromCode(allTables, allProcedures, framework);

  // 5. Collect metadata
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
