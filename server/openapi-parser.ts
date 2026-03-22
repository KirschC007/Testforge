/**
 * TestForge OpenAPI Parser
 *
 * Converts OpenAPI 3.x (JSON/YAML) or Swagger 2.x (JSON/YAML) directly to
 * AnalysisIR — no LLM call required.
 *
 * Entry point: parseOpenAPI(text: string): AnalysisResult
 *
 * Supported:
 *   - OpenAPI 3.0.x, 3.1.x
 *   - Swagger 2.0
 *   - JSON and YAML input
 *   - $ref resolution (internal only, no external URLs)
 *   - requestBody + parameters → inputFields
 *   - responses → outputFields
 *   - securitySchemes → authModel
 *   - x-tenant-key vendor extension
 */

import * as yaml from "js-yaml";
import type {
  AnalysisIR,
  AnalysisResult,
  APIEndpoint,
  EndpointField,
  AuthModel,
  AuthRole,
  Behavior,
  Invariant,
} from "./analyzer";

// ─── Raw OpenAPI document types (minimal, just what we need) ─────────────────

interface OASchema {
  type?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: OASchema | { $ref: string };
  properties?: Record<string, OASchema | { $ref: string }>;
  required?: string[];
  allOf?: Array<OASchema | { $ref: string }>;
  oneOf?: Array<OASchema | { $ref: string }>;
  anyOf?: Array<OASchema | { $ref: string }>;
  $ref?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  "x-tenant-key"?: boolean;
  "x-boundary-field"?: boolean;
}

interface OAParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie" | "body"; // body is Swagger 2.x
  required?: boolean;
  schema?: OASchema | { $ref: string };
  type?: string; // Swagger 2.x inline type
  enum?: string[]; // Swagger 2.x inline enum
  minimum?: number;
  maximum?: number;
  description?: string;
  "x-tenant-key"?: boolean;
  "x-boundary-field"?: boolean;
}

interface OARequestBody {
  required?: boolean;
  content?: Record<string, { schema?: OASchema | { $ref: string } }>;
}

interface OAResponse {
  description?: string;
  content?: Record<string, { schema?: OASchema | { $ref: string } }>;
  schema?: OASchema | { $ref: string }; // Swagger 2.x
}

interface OAOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<OAParameter | { $ref: string }>;
  requestBody?: OARequestBody | { $ref: string };
  responses?: Record<string, OAResponse | { $ref: string }>;
  security?: Array<Record<string, string[]>>;
  "x-behaviors"?: string[];
}

interface OAPath {
  get?: OAOperation;
  post?: OAOperation;
  put?: OAOperation;
  patch?: OAOperation;
  delete?: OAOperation;
  parameters?: Array<OAParameter | { $ref: string }>;
}

interface OASecurityScheme {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect";
  scheme?: string; // bearer, basic
  in?: string; // header, query, cookie
  name?: string; // apiKey name
  flows?: Record<string, { tokenUrl?: string; authorizationUrl?: string; scopes?: Record<string, string> }>;
  "x-login-endpoint"?: string;
  "x-csrf-endpoint"?: string;
  "x-roles"?: Array<{ name: string; envUserVar: string; envPassVar: string; defaultUser: string; defaultPass: string }>;
}

interface OAComponents {
  schemas?: Record<string, OASchema>;
  parameters?: Record<string, OAParameter>;
  requestBodies?: Record<string, OARequestBody>;
  responses?: Record<string, OAResponse>;
  securitySchemes?: Record<string, OASecurityScheme>;
}

interface OpenAPI3Doc {
  openapi: string;
  info?: { title?: string; description?: string; version?: string };
  paths?: Record<string, OAPath>;
  components?: OAComponents;
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
}

interface Swagger2Doc {
  swagger: string;
  info?: { title?: string; description?: string; version?: string };
  basePath?: string;
  paths?: Record<string, OAPath>;
  definitions?: Record<string, OASchema>;
  parameters?: Record<string, OAParameter>;
  responses?: Record<string, OAResponse>;
  securityDefinitions?: Record<string, OASecurityScheme>;
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
}

type OADoc = OpenAPI3Doc | Swagger2Doc;

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Detects whether a string is an OpenAPI/Swagger document.
 * Returns true if the parsed object has an `openapi` or `swagger` top-level key.
 */
export function isOpenAPIDocument(text: string): boolean {
  try {
    const parsed = parseRawDocument(text);
    return (
      typeof (parsed as any)?.openapi === "string" ||
      typeof (parsed as any)?.swagger === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Parses an OpenAPI 3.x or Swagger 2.x document (JSON or YAML) and returns
 * an AnalysisResult with a fully populated AnalysisIR — no LLM required.
 */
export function parseOpenAPI(text: string): AnalysisResult {
  const doc = parseRawDocument(text) as OADoc;
  const isSwagger2 = typeof (doc as Swagger2Doc).swagger === "string";

  // Build $ref resolver from components/definitions
  const components: OAComponents = isSwagger2
    ? {
        schemas: (doc as Swagger2Doc).definitions,
        parameters: (doc as Swagger2Doc).parameters,
        responses: (doc as Swagger2Doc).responses,
        securitySchemes: (doc as Swagger2Doc).securityDefinitions,
      }
    : (doc as OpenAPI3Doc).components || {};

  const resolver = buildRefResolver(components);

  // Parse all paths → APIEndpoints + Behaviors
  const paths = doc.paths || {};
  const endpoints: APIEndpoint[] = [];
  const behaviors: Behavior[] = [];
  const behaviorIdSet = new Set<string>();

  // Collect all status values seen across enum fields for state machine detection
  const allStatusValues: string[] = [];
  const allEnums: Record<string, string[]> = {};

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    const httpMethods: Array<[string, OAOperation]> = [];
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const op = pathItem[method];
      if (op) httpMethods.push([method.toUpperCase(), op]);
    }

    // Path-level parameters (shared across all methods)
    const pathParams: OAParameter[] = (pathItem.parameters || [])
      .map(p => resolveRef<OAParameter>(p, resolver))
      .filter((p): p is OAParameter => p !== null);

    for (const [method, op] of httpMethods) {
      const endpointName = deriveEndpointName(pathStr, method, op);
      const auth = deriveAuth(op, doc);

      // Merge path-level + operation-level parameters
      const opParams: OAParameter[] = (op.parameters || [])
        .map(p => resolveRef<OAParameter>(p, resolver))
        .filter((p): p is OAParameter => p !== null);
      const allParams = mergeParameters(pathParams, opParams);

      // Build inputFields from parameters + requestBody
      const inputFields = buildInputFields(allParams, op.requestBody, resolver, allEnums);

      // Track status enum values for state machine detection
      for (const f of inputFields) {
        if (f.name.toLowerCase() === "status" && f.enumValues?.length) {
          allStatusValues.push(...f.enumValues);
        }
      }

      // Build outputFields from 200/201 response
      const outputFields = buildOutputFields(op.responses, resolver);

      // Detect tenant key from x-tenant-key extension or naming convention
      const tenantField = detectTenantField(inputFields, pathStr);

      // Mark tenant key in inputFields
      if (tenantField) {
        for (const f of inputFields) {
          if (f.name === tenantField) f.isTenantKey = true;
        }
      }

      // Related behaviors: from x-behaviors extension or auto-generated
      const relatedBehaviors = (op["x-behaviors"] || []) as string[];

      endpoints.push({
        name: endpointName,
        method,
        auth,
        relatedBehaviors,
        inputFields,
        outputFields,
      });

      // Generate behaviors from operation
      const opBehaviors = generateBehaviorsFromOperation(
        pathStr,
        method,
        op,
        endpointName,
        inputFields,
        outputFields,
        behaviorIdSet
      );
      for (const b of opBehaviors) {
        behaviors.push(b);
        // Link behavior to endpoint
        if (!endpoints[endpoints.length - 1].relatedBehaviors.includes(b.id)) {
          endpoints[endpoints.length - 1].relatedBehaviors.push(b.id);
        }
      }
    }
  }

  // Deduplicate status values
  const uniqueStatuses = Array.from(new Set(allStatusValues));

  // Build auth model from security schemes
  const authModel = buildAuthModel(doc, isSwagger2);

  // Build tenant model from most common tenant key
  const tenantModel = buildTenantModel(endpoints);

  // Build resources from endpoints
  const resources = buildResources(endpoints, tenantModel);

  // Build invariants from behaviors
  const invariants = buildInvariants(behaviors);

  // Build status machine if status enum values found
  const statusMachine = uniqueStatuses.length >= 2
    ? buildStatusMachine(uniqueStatuses, behaviors)
    : null;

  // Determine spec type from info title or tags
  const specType = deriveSpecType(doc, behaviors);

  // Quality score: based on how much data we extracted
  const qualityScore = calcQualityScore(behaviors, endpoints, authModel, tenantModel);

  const ir: AnalysisIR = {
    behaviors,
    invariants,
    ambiguities: [],
    contradictions: [],
    tenantModel,
    resources,
    apiEndpoints: endpoints,
    authModel,
    enums: allEnums,
    statusMachine,
    services: [],
    userFlows: [],
    dataModels: [],
  };

  return {
    ir,
    qualityScore,
    specType,
  };
}

// ─── Document parsing ─────────────────────────────────────────────────────────

function parseRawDocument(text: string): unknown {
  const trimmed = text.trim();
  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  // Try YAML
  return yaml.load(trimmed);
}

// ─── $ref resolver ────────────────────────────────────────────────────────────

type RefResolver = (ref: string) => unknown;

function buildRefResolver(components: OAComponents): RefResolver {
  return function resolve(ref: string): unknown {
    if (!ref.startsWith("#/")) return null;
    const parts = ref.slice(2).split("/");
    // Navigate the components object
    let current: unknown = components;
    for (const part of parts) {
      // Handle URL-encoded parts
      const decoded = part.replace(/~1/g, "/").replace(/~0/g, "~");
      if (current == null || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[decoded];
    }
    return current ?? null;
  };
}

function resolveRef<T>(obj: T | { $ref: string }, resolver: RefResolver): T | null {
  if (obj == null) return null;
  if (typeof obj === "object" && "$ref" in (obj as object)) {
    const resolved = resolver((obj as { $ref: string }).$ref);
    return (resolved as T) ?? null;
  }
  return obj as T;
}

function resolveSchema(schema: OASchema | { $ref: string } | undefined, resolver: RefResolver): OASchema | null {
  if (!schema) return null;
  const resolved = resolveRef<OASchema>(schema, resolver);
  if (!resolved) return null;
  // Merge allOf into a single schema
  if (resolved.allOf?.length) {
    const merged: OASchema = { properties: {}, required: [] };
    for (const part of resolved.allOf) {
      const s = resolveRef<OASchema>(part, resolver);
      if (!s) continue;
      if (s.properties) Object.assign(merged.properties!, s.properties);
      if (s.required) merged.required!.push(...s.required);
      if (s.type && !merged.type) merged.type = s.type;
    }
    return merged;
  }
  return resolved;
}

// ─── Endpoint name derivation ─────────────────────────────────────────────────

/**
 * Derives a dot-notation endpoint name from path + method + operationId.
 * Examples:
 *   POST /accounts → accounts.create
 *   GET  /accounts/{id} → accounts.get
 *   GET  /accounts → accounts.list
 *   PUT  /accounts/{id} → accounts.update
 *   DELETE /accounts/{id} → accounts.delete
 *   PATCH /accounts/{id} → accounts.patch
 */
function deriveEndpointName(path: string, method: string, op: OAOperation): string {
  if (op.operationId) {
    // Convert camelCase/PascalCase operationId to dot-notation
    // e.g. createAccount → accounts.create, getAccountById → accounts.get
    const id = op.operationId;
    const dotted = camelToDot(id);
    if (dotted) return dotted;
    return id.replace(/[^a-zA-Z0-9]/g, ".").toLowerCase();
  }

  // Derive from path segments
  const segments = path.split("/").filter(s => s && !s.startsWith("{"));
  const resource = segments[segments.length - 1] || "resource";
  const hasIdParam = path.includes("{");

  const actionMap: Record<string, string> = {
    GET: hasIdParam ? "get" : "list",
    POST: "create",
    PUT: "update",
    PATCH: "patch",
    DELETE: "delete",
  };
  const action = actionMap[method] || method.toLowerCase();
  return `${resource}.${action}`;
}

function camelToDot(id: string): string {
  // Common prefixes: create, get, list, update, delete, patch, fetch, find, remove
  const prefixes = ["create", "get", "list", "update", "delete", "patch", "fetch", "find", "remove", "add", "set"];
  const lower = id.charAt(0).toLowerCase() + id.slice(1);
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      const rest = lower.slice(prefix.length);
      if (rest.length === 0) return "";
      // Convert rest to snake_case resource name
      const resource = rest.charAt(0).toLowerCase() + rest.slice(1);
      // Pluralize for list operations
      const resourceName = prefix === "list" ? pluralize(resource) : resource;
      return `${resourceName}.${prefix}`;
    }
  }
  return "";
}

function pluralize(word: string): string {
  if (word.endsWith("s")) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  return word + "s";
}

// ─── Auth derivation ──────────────────────────────────────────────────────────

function deriveAuth(op: OAOperation, doc: OADoc): string {
  // Operation-level security overrides document-level
  const security = op.security ?? doc.security;
  if (!security || security.length === 0) return "none";
  const schemes = Object.keys(security[0] || {});
  if (schemes.length === 0) return "none";
  const scheme = schemes[0].toLowerCase();
  if (scheme.includes("bearer") || scheme.includes("jwt")) return "bearer";
  if (scheme.includes("basic")) return "basic";
  if (scheme.includes("api") || scheme.includes("key")) return "apiKey";
  if (scheme.includes("oauth")) return "oauth2";
  return "bearer"; // Default assumption for authenticated endpoints
}

// ─── Parameter merging ────────────────────────────────────────────────────────

function mergeParameters(pathParams: OAParameter[], opParams: OAParameter[]): OAParameter[] {
  const merged = [...pathParams];
  for (const op of opParams) {
    const existing = merged.findIndex(p => p.name === op.name && p.in === op.in);
    if (existing >= 0) {
      merged[existing] = op; // Operation-level overrides path-level
    } else {
      merged.push(op);
    }
  }
  return merged;
}

// ─── Input fields ─────────────────────────────────────────────────────────────

function buildInputFields(
  params: OAParameter[],
  requestBody: OARequestBody | { $ref: string } | undefined,
  resolver: RefResolver,
  allEnums: Record<string, string[]>
): EndpointField[] {
  const fields: EndpointField[] = [];

  // From parameters (path, query — skip header/cookie for test purposes)
  for (const param of params) {
    if (param.in === "header" || param.in === "cookie") continue;
    const schema = param.schema ? resolveSchema(param.schema, resolver) : null;
    const field = schemaToEndpointField(
      param.name,
      schema || {
        type: param.type || "string",
        enum: param.enum,
        minimum: param.minimum,
        maximum: param.maximum,
      },
      param.required ?? param.in === "path",
      resolver,
      allEnums
    );
    if (param["x-tenant-key"]) field.isTenantKey = true;
    if (param["x-boundary-field"]) field.isBoundaryField = true;
    fields.push(field);
  }

  // From requestBody
  if (requestBody) {
    const resolvedBody = resolveRef<OARequestBody>(requestBody, resolver);
    if (resolvedBody?.content) {
      // Prefer application/json, fall back to first content type
      const contentType =
        resolvedBody.content["application/json"] ||
        Object.values(resolvedBody.content)[0];
      if (contentType?.schema) {
        const schema = resolveSchema(contentType.schema, resolver);
        if (schema) {
          const bodyFields = extractFieldsFromSchema(schema, resolver, allEnums, schema.required || []);
          fields.push(...bodyFields);
        }
      }
    }
  }

  return fields;
}

function extractFieldsFromSchema(
  schema: OASchema,
  resolver: RefResolver,
  allEnums: Record<string, string[]>,
  requiredFields: string[]
): EndpointField[] {
  const fields: EndpointField[] = [];
  if (!schema.properties) return fields;

  for (const [name, propRaw] of Object.entries(schema.properties)) {
    const prop = resolveSchema(propRaw, resolver);
    if (!prop) continue;
    const required = requiredFields.includes(name);
    const field = schemaToEndpointField(name, prop, required, resolver, allEnums);
    if ((propRaw as OASchema)["x-tenant-key"] || prop["x-tenant-key"]) field.isTenantKey = true;
    if ((propRaw as OASchema)["x-boundary-field"] || prop["x-boundary-field"]) field.isBoundaryField = true;
    fields.push(field);
  }
  return fields;
}

function schemaToEndpointField(
  name: string,
  schema: OASchema,
  required: boolean,
  resolver: RefResolver,
  allEnums: Record<string, string[]>
): EndpointField {
  const type = mapOAType(schema);

  // Track enum values globally
  if (schema.enum?.length) {
    const enumKey = name.toLowerCase().includes("status") ? "status" : name;
    if (!allEnums[enumKey]) allEnums[enumKey] = [];
    for (const v of schema.enum) {
      if (!allEnums[enumKey].includes(String(v))) allEnums[enumKey].push(String(v));
    }
  }

  // Array item type
  let arrayItemType: "number" | "object" | undefined;
  let arrayItemFields: EndpointField[] | undefined;
  if (type === "array" && schema.items) {
    const items = resolveSchema(schema.items as OASchema, resolver);
    if (items) {
      if (items.type === "object" || items.properties) {
        arrayItemType = "object";
        arrayItemFields = items.properties
          ? extractFieldsFromSchema(items, resolver, allEnums, items.required || [])
          : undefined;
      } else {
        arrayItemType = items.type === "number" || items.type === "integer" ? "number" : undefined;
      }
    }
  }

  // Determine min/max from schema
  let min: number | undefined;
  let max: number | undefined;
  if (type === "number") {
    min = schema.minimum;
    max = schema.maximum;
  } else if (type === "string") {
    min = schema.minLength;
    max = schema.maxLength;
  } else if (type === "array") {
    min = schema.minItems;
    max = schema.maxItems;
  }

  // Determine validDefault from example or default
  let validDefault: string | undefined;
  if (schema.example !== undefined) {
    validDefault = JSON.stringify(schema.example);
  } else if (schema.default !== undefined) {
    validDefault = JSON.stringify(schema.default);
  }

  // Detect tenant key by naming convention
  const nameLower = name.toLowerCase();
  const isTenantKey =
    nameLower.endsWith("id") &&
    (nameLower.includes("tenant") || nameLower.includes("org") || nameLower.includes("workspace") || nameLower.includes("company") || nameLower.includes("account") || nameLower.includes("bank"));

  // Detect boundary field
  const isBoundaryField =
    min !== undefined || max !== undefined ||
    nameLower.includes("amount") || nameLower.includes("limit") || nameLower.includes("count") || nameLower.includes("size");

  return {
    name,
    type,
    required,
    min,
    max,
    enumValues: schema.enum?.map(String),
    arrayItemType,
    arrayItemFields,
    isTenantKey,
    isBoundaryField,
    validDefault,
  };
}

function mapOAType(schema: OASchema): EndpointField["type"] {
  if (schema.enum?.length) return "enum";
  switch (schema.type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    case "string":
      if (schema.format === "date" || schema.format === "date-time") return "date";
      return "string";
    default:
      if (schema.properties) return "object";
      return "string";
  }
}

// ─── Output fields ────────────────────────────────────────────────────────────

function buildOutputFields(
  responses: Record<string, OAResponse | { $ref: string }> | undefined,
  resolver: RefResolver
): string[] {
  if (!responses) return [];

  // Try 200, then 201, then first 2xx
  const statusCodes = ["200", "201", ...Object.keys(responses).filter(k => k.startsWith("2"))];
  for (const code of statusCodes) {
    const raw = responses[code];
    if (!raw) continue;
    const response = resolveRef<OAResponse>(raw, resolver);
    if (!response) continue;

    // OpenAPI 3.x: content
    if (response.content) {
      const contentType =
        response.content["application/json"] ||
        Object.values(response.content)[0];
      if (contentType?.schema) {
        const schema = resolveSchema(contentType.schema, resolver);
        if (schema?.properties) {
          return Object.keys(schema.properties);
        }
        // Array response: items properties
        if (schema?.type === "array" && schema.items) {
          const items = resolveSchema(schema.items as OASchema, resolver);
          if (items?.properties) return Object.keys(items.properties);
        }
      }
    }

    // Swagger 2.x: schema directly on response
    if (response.schema) {
      const schema = resolveSchema(response.schema, resolver);
      if (schema?.properties) return Object.keys(schema.properties);
      if (schema?.type === "array" && schema.items) {
        const items = resolveSchema(schema.items as OASchema, resolver);
        if (items?.properties) return Object.keys(items.properties);
      }
    }
  }
  return [];
}

// ─── Tenant field detection ───────────────────────────────────────────────────

function detectTenantField(fields: EndpointField[], path: string): string | null {
  // Explicit x-tenant-key already set
  const explicit = fields.find(f => f.isTenantKey);
  if (explicit) return explicit.name;

  // Path parameter that looks like a tenant identifier
  const pathSegments = path.split("/").filter(s => s.startsWith("{")).map(s => s.slice(1, -1));
  for (const seg of pathSegments) {
    const lower = seg.toLowerCase();
    if (lower.includes("tenant") || lower.includes("org") || lower.includes("workspace") || lower.includes("bank") || lower.includes("company")) {
      return seg;
    }
  }

  // Field naming convention
  const tenantKeywords = ["tenantid", "orgid", "organizationid", "workspaceid", "bankid", "companyid", "accountid"];
  for (const f of fields) {
    if (tenantKeywords.includes(f.name.toLowerCase())) return f.name;
  }

  return null;
}

// ─── Behavior generation ──────────────────────────────────────────────────────

let behaviorCounter = 0;

function generateBehaviorsFromOperation(
  path: string,
  method: string,
  op: OAOperation,
  endpointName: string,
  inputFields: EndpointField[],
  outputFields: string[],
  behaviorIdSet: Set<string>
): Behavior[] {
  const behaviors: Behavior[] = [];
  const resource = endpointName.split(".")[0];
  const action = endpointName.split(".")[1] || method.toLowerCase();
  const summary = op.summary || op.description || `${method} ${path}`;

  // Generate a unique behavior ID
  const makeId = (suffix: string): string => {
    behaviorCounter++;
    const id = `B${String(behaviorCounter).padStart(3, "0")}-OA`;
    behaviorIdSet.add(id);
    return id;
  };

  // 1. Happy path behavior
  const happyId = makeId("happy");
  const tags = deriveTags(method, inputFields, outputFields, op);
  const riskHints = deriveRiskHints(method, inputFields, outputFields, op);
  const preconditions = derivePreconditions(method, op, inputFields);
  const postconditions = derivePostconditions(method, outputFields, resource);
  const errorCases = deriveErrorCases(op.responses, method, inputFields);

  behaviors.push({
    id: happyId,
    title: summary,
    subject: deriveSubject(op),
    action: mapMethodToAction(method, action),
    object: resource,
    preconditions,
    postconditions,
    errorCases,
    tags,
    riskHints,
    chapter: op.tags?.[0],
    specAnchor: op.operationId,
  });

  // 2. Validation behavior (if there are required fields with constraints)
  const constrainedFields = inputFields.filter(f => f.required && (f.min !== undefined || f.max !== undefined || f.enumValues?.length));
  if (constrainedFields.length > 0 && (method === "POST" || method === "PUT" || method === "PATCH")) {
    const validId = makeId("validation");
    behaviors.push({
      id: validId,
      title: `${resource}.${action} validates required fields and constraints`,
      subject: deriveSubject(op),
      action: "validates",
      object: resource,
      preconditions: ["Request body provided"],
      postconditions: ["Returns 400/422 for invalid input"],
      errorCases: constrainedFields.map(f => {
        const parts: string[] = [];
        if (f.min !== undefined) parts.push(`${f.name} below minimum ${f.min}`);
        if (f.max !== undefined) parts.push(`${f.name} above maximum ${f.max}`);
        if (f.enumValues?.length) parts.push(`${f.name} not in [${f.enumValues.join(", ")}]`);
        return parts.join("; ");
      }),
      tags: ["validation", "boundary"],
      riskHints: constrainedFields.map(f => `${f.name} must be within valid range`),
      chapter: op.tags?.[0],
      specAnchor: op.operationId,
    });
  }

  // 3. Auth/IDOR behavior (if endpoint requires auth and has tenant key)
  const tenantField = inputFields.find(f => f.isTenantKey);
  if (tenantField && op.security !== undefined && op.security.length > 0) {
    const idorId = makeId("idor");
    behaviors.push({
      id: idorId,
      title: `${resource}.${action} enforces tenant isolation — users cannot access other tenants' ${resource}`,
      subject: "Authenticated user",
      action: "accesses",
      object: `${resource} belonging to another tenant`,
      preconditions: ["User authenticated", `${tenantField.name} belongs to another tenant`],
      postconditions: ["Returns 403 or 404"],
      errorCases: [`User accesses ${resource} of tenant they don't belong to`],
      tags: ["idor", "multi-tenant", "security"],
      riskHints: ["cross-tenant data access", "IDOR vulnerability"],
      chapter: op.tags?.[0],
      specAnchor: op.operationId,
    });
  }

  return behaviors;
}

function deriveTags(method: string, inputFields: EndpointField[], outputFields: string[], op: OAOperation): string[] {
  const tags: string[] = [];
  if (method === "POST" || method === "PUT" || method === "PATCH") tags.push("state-change");
  if (method === "DELETE") tags.push("state-change");
  if (method === "GET") tags.push("read");
  const hasAuth = op.security && op.security.length > 0;
  if (hasAuth) tags.push("auth");
  const hasTenant = inputFields.some(f => f.isTenantKey);
  if (hasTenant) tags.push("multi-tenant");
  const hasBoundary = inputFields.some(f => f.isBoundaryField || f.min !== undefined || f.max !== undefined);
  if (hasBoundary) tags.push("boundary");
  if (outputFields.length > 0) tags.push("api-response");
  return tags;
}

function deriveRiskHints(method: string, inputFields: EndpointField[], outputFields: string[], op: OAOperation): string[] {
  const hints: string[] = [];
  if (method === "DELETE") hints.push("irreversible operation");
  if (method === "POST" && inputFields.some(f => f.name.toLowerCase().includes("amount") || f.name.toLowerCase().includes("price"))) {
    hints.push("financial transaction");
  }
  const piiFields = outputFields.filter(f => ["email", "phone", "name", "address", "ssn", "dob"].some(k => f.toLowerCase().includes(k)));
  if (piiFields.length > 0) hints.push(`returns PII: ${piiFields.join(", ")}`);
  return hints;
}

function derivePreconditions(method: string, op: OAOperation, inputFields: EndpointField[]): string[] {
  const pre: string[] = [];
  if (op.security && op.security.length > 0) pre.push("User is authenticated");
  const tenantField = inputFields.find(f => f.isTenantKey);
  if (tenantField) pre.push(`${tenantField.name} belongs to the authenticated user's tenant`);
  if (method === "PUT" || method === "PATCH" || method === "DELETE") pre.push("Resource exists");
  return pre.length > 0 ? pre : ["Valid request"];
}

function derivePostconditions(method: string, outputFields: string[], resource: string): string[] {
  switch (method) {
    case "POST": return [`${resource} created`, outputFields.length > 0 ? `Returns ${outputFields.slice(0, 3).join(", ")}` : "Returns created resource"];
    case "PUT":
    case "PATCH": return [`${resource} updated`, "Returns updated resource"];
    case "DELETE": return [`${resource} deleted`, "Returns 204 or success confirmation"];
    case "GET": return [`Returns ${resource} data`, outputFields.length > 0 ? `Response includes ${outputFields.slice(0, 3).join(", ")}` : "Response matches spec schema"];
    default: return ["Operation completed successfully"];
  }
}

function deriveErrorCases(
  responses: Record<string, OAResponse | { $ref: string }> | undefined,
  method: string,
  inputFields: EndpointField[]
): string[] {
  const errors: string[] = [];
  if (!responses) return errors;

  const errorCodes = Object.keys(responses).filter(k => k.startsWith("4") || k.startsWith("5"));
  for (const code of errorCodes) {
    const resp = responses[code];
    if (resp && "description" in resp) {
      errors.push(`${code}: ${(resp as OAResponse).description || "Error"}`);
    }
  }

  // Add standard validation errors for POST/PUT/PATCH
  if ((method === "POST" || method === "PUT" || method === "PATCH") && !errors.some(e => e.startsWith("400") || e.startsWith("422"))) {
    const requiredFields = inputFields.filter(f => f.required);
    if (requiredFields.length > 0) {
      errors.push(`400/422: Missing required fields: ${requiredFields.slice(0, 3).map(f => f.name).join(", ")}`);
    }
  }

  return errors;
}

function deriveSubject(op: OAOperation): string {
  if (op.security && op.security.length > 0) return "Authenticated user";
  return "API client";
}

function mapMethodToAction(method: string, action: string): string {
  const map: Record<string, string> = {
    POST: "creates",
    GET: action === "list" ? "lists" : "retrieves",
    PUT: "updates",
    PATCH: "partially updates",
    DELETE: "deletes",
  };
  return map[method] || method.toLowerCase();
}

// ─── Auth model ───────────────────────────────────────────────────────────────

function buildAuthModel(doc: OADoc, isSwagger2: boolean): AuthModel | null {
  const securitySchemes: Record<string, OASecurityScheme> = isSwagger2
    ? (doc as Swagger2Doc).securityDefinitions || {}
    : (doc as OpenAPI3Doc).components?.securitySchemes || {};

  if (Object.keys(securitySchemes).length === 0) return null;

  // Find the primary auth scheme
  let loginEndpoint = "/api/auth/login";
  let csrfEndpoint: string | undefined;
  let csrfPattern: string | undefined;
  const roles: AuthRole[] = [];

  for (const [name, scheme] of Object.entries(securitySchemes)) {
    if (scheme["x-login-endpoint"]) loginEndpoint = scheme["x-login-endpoint"];
    if (scheme["x-csrf-endpoint"]) csrfEndpoint = scheme["x-csrf-endpoint"];
    if (scheme["x-roles"]) {
      roles.push(...scheme["x-roles"]);
    }
  }

  // Default roles if none specified
  if (roles.length === 0) {
    roles.push({
      name: "user",
      envUserVar: "TEST_USER_EMAIL",
      envPassVar: "TEST_USER_PASSWORD",
      defaultUser: "test@example.com",
      defaultPass: "testpassword123",
    });
  }

  return { loginEndpoint, csrfEndpoint, csrfPattern, roles };
}

// ─── Tenant model ─────────────────────────────────────────────────────────────

function buildTenantModel(endpoints: APIEndpoint[]): AnalysisIR["tenantModel"] {
  // Count tenant key field names across all endpoints
  const tenantFieldCounts: Record<string, number> = {};
  for (const ep of endpoints) {
    for (const f of ep.inputFields) {
      if (f.isTenantKey) {
        tenantFieldCounts[f.name] = (tenantFieldCounts[f.name] || 0) + 1;
      }
    }
  }

  if (Object.keys(tenantFieldCounts).length === 0) return null;

  // Most common tenant field
  const tenantIdField = Object.entries(tenantFieldCounts).sort((a, b) => b[1] - a[1])[0][0];
  // Derive entity name: bankId → bank, organizationId → organization
  const tenantEntity = tenantIdField.replace(/[Ii]d$/, "").toLowerCase() || "tenant";

  return { tenantEntity, tenantIdField };
}

// ─── Resources ────────────────────────────────────────────────────────────────

function buildResources(
  endpoints: APIEndpoint[],
  tenantModel: AnalysisIR["tenantModel"]
): AnalysisIR["resources"] {
  const resourceMap: Record<string, {
    operations: Set<string>;
    tenantKey: string;
    hasPII: boolean;
  }> = {};

  const piiKeywords = ["email", "phone", "name", "address", "ssn", "dob", "birth", "personal"];

  for (const ep of endpoints) {
    const parts = ep.name.split(".");
    const resource = parts[0];
    const operation = parts[1] || "unknown";

    if (!resourceMap[resource]) {
      resourceMap[resource] = {
        operations: new Set(),
        tenantKey: tenantModel?.tenantIdField || "tenantId",
        hasPII: false,
      };
    }
    resourceMap[resource].operations.add(operation);

    // Check for PII fields
    for (const f of ep.inputFields) {
      if (piiKeywords.some(k => f.name.toLowerCase().includes(k))) {
        resourceMap[resource].hasPII = true;
      }
    }
    for (const f of ep.outputFields || []) {
      if (piiKeywords.some(k => f.toLowerCase().includes(k))) {
        resourceMap[resource].hasPII = true;
      }
    }
  }

  return Object.entries(resourceMap).map(([name, data]) => ({
    name,
    table: `${name}s`, // Conventional table name
    tenantKey: data.tenantKey,
    operations: Array.from(data.operations),
    hasPII: data.hasPII,
  }));
}

// ─── Invariants ───────────────────────────────────────────────────────────────

function buildInvariants(behaviors: Behavior[]): Invariant[] {
  const invariants: Invariant[] = [];
  let invCounter = 0;

  // Extract invariants from riskHints that describe constraints
  const constraintPatterns = [
    /cannot go below (\d+)/i,
    /must be (positive|non-negative|greater than \d+)/i,
    /cannot exceed (\d+)/i,
    /must not be (null|empty|blank)/i,
  ];

  for (const b of behaviors) {
    for (const hint of b.riskHints) {
      for (const pattern of constraintPatterns) {
        if (pattern.test(hint)) {
          invCounter++;
          invariants.push({
            id: `INV${String(invCounter).padStart(3, "0")}`,
            description: hint,
            alwaysTrue: hint,
            violationConsequence: `${b.object} in invalid state`,
          });
          break;
        }
      }
    }
  }

  return invariants;
}

// ─── Status machine ───────────────────────────────────────────────────────────

function buildStatusMachine(
  statusValues: string[],
  behaviors: Behavior[]
): AnalysisIR["statusMachine"] {
  const states = Array.from(new Set(statusValues));

  // Try to extract transitions from behavior titles (e.g. "pending → active")
  const transitions: [string, string][] = [];
  const forbidden: [string, string][] = [];

  for (const b of behaviors) {
    const arrowMatch = b.title.match(/(\w+)\s*[→\->]+\s*(\w+)/);
    if (arrowMatch) {
      const from = arrowMatch[1].toLowerCase();
      const to = arrowMatch[2].toLowerCase();
      if (states.includes(from) && states.includes(to)) {
        transitions.push([from, to]);
      }
    }
  }

  // If no explicit transitions found, build a linear chain
  if (transitions.length === 0 && states.length >= 2) {
    for (let i = 0; i < states.length - 1; i++) {
      transitions.push([states[i], states[i + 1]]);
    }
  }

  return {
    states,
    transitions,
    forbidden,
    initialState: states[0],
    terminalStates: states.length > 0 ? [states[states.length - 1]] : undefined,
  };
}

// ─── Spec type and quality ────────────────────────────────────────────────────

function deriveSpecType(doc: OADoc, behaviors: Behavior[]): string {
  const title = (doc.info?.title || "").toLowerCase();
  const keywords: Record<string, string> = {
    bank: "fintech",
    payment: "fintech",
    finance: "fintech",
    shop: "ecommerce",
    order: "ecommerce",
    product: "ecommerce",
    health: "healthcare",
    patient: "healthcare",
    task: "productivity",
    project: "productivity",
    user: "saas",
    auth: "saas",
  };
  for (const [kw, type] of Object.entries(keywords)) {
    if (title.includes(kw)) return type;
  }
  return "openapi";
}

function calcQualityScore(
  behaviors: Behavior[],
  endpoints: APIEndpoint[],
  authModel: AuthModel | null,
  tenantModel: AnalysisIR["tenantModel"]
): number {
  let score = 0;
  // Behaviors extracted
  if (behaviors.length >= 5) score += 20;
  else if (behaviors.length >= 2) score += 10;
  // Endpoints extracted
  if (endpoints.length >= 3) score += 20;
  else if (endpoints.length >= 1) score += 10;
  // Auth model present
  if (authModel) score += 20;
  // Tenant model present
  if (tenantModel) score += 20;
  // Input fields extracted
  const totalFields = endpoints.reduce((sum, ep) => sum + ep.inputFields.length, 0);
  if (totalFields >= 10) score += 20;
  else if (totalFields >= 3) score += 10;
  return Math.min(score, 100);
}
