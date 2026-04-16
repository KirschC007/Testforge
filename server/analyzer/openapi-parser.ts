// openapi-parser.ts — v11: Deterministic OpenAPI 3.x / Swagger 2.0 Parser
// No LLM, no hallucinations — pure structural extraction from JSON/YAML spec
// Supports: OpenAPI 3.0, 3.1, Swagger 2.0

import type { AnalysisResult, AnalysisIR, APIEndpoint, EndpointField, AuthRole } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  $ref?: string;
}

interface OpenAPIParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie" | "body" | "formData";
  required?: boolean;
  schema?: OpenAPISchema;
  type?: string; // Swagger 2.0
  description?: string;
}

interface OpenAPIRequestBody {
  required?: boolean;
  content?: Record<string, { schema?: OpenAPISchema }>;
}

interface OpenAPIResponse {
  description?: string;
  content?: Record<string, { schema?: OpenAPISchema }>;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: Record<string, string[]>[];
  "x-roles"?: string[];
  "x-auth"?: string[];
}

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, { type: string; scheme?: string; name?: string; in?: string }>;
  };
  definitions?: Record<string, OpenAPISchema>; // Swagger 2.0
  securityDefinitions?: Record<string, unknown>; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  host?: string; // Swagger 2.0
  servers?: { url: string }[];
}

// ─── YAML Parser (minimal, no dependencies) ───────────────────────────────────

function parseYAML(yaml: string): unknown {
  // Try JSON first (OpenAPI can be JSON)
  try { return JSON.parse(yaml); } catch { /* not JSON */ }

  // Minimal YAML → JSON conversion for OpenAPI specs
  // This handles the most common patterns in OpenAPI YAML files
  const lines = yaml.split("\n");
  const stack: Array<{ indent: number; obj: Record<string, unknown> | unknown[] }> = [];
  const root: Record<string, unknown> = {};
  stack.push({ indent: -1, obj: root });

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\s*#.*$/, ""); // Remove comments
    if (!line.trim()) { i++; continue; }

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack to correct indent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (trimmed.startsWith("- ")) {
      // Array item
      const value = trimmed.slice(2).trim();
      if (Array.isArray(parent)) {
        if (value.includes(": ")) {
          const child: Record<string, unknown> = {};
          const [k, ...rest] = value.split(": ");
          child[k.trim()] = parseYAMLValue(rest.join(": ").trim());
          parent.push(child);
          stack.push({ indent, obj: child });
        } else if (value) {
          parent.push(parseYAMLValue(value));
        } else {
          const child: Record<string, unknown> = {};
          parent.push(child);
          stack.push({ indent, obj: child });
        }
      }
    } else if (trimmed.includes(": ")) {
      const colonIdx = trimmed.indexOf(": ");
      const key = trimmed.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, "");
      const val = trimmed.slice(colonIdx + 2).trim();

      if (Array.isArray(parent)) {
        // Shouldn't happen in well-formed YAML but handle gracefully
      } else {
        const obj = parent as Record<string, unknown>;
        if (!val || val === "|" || val === ">") {
          // Multi-line or nested object
          const child: Record<string, unknown> = {};
          obj[key] = child;
          stack.push({ indent, obj: child });
        } else {
          obj[key] = parseYAMLValue(val);
        }
      }
    } else if (trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1).trim().replace(/^['"]|['"]$/g, "");
      if (!Array.isArray(parent)) {
        const obj = parent as Record<string, unknown>;
        // Check next line to determine if array or object
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim().startsWith("- ")) {
          const arr: unknown[] = [];
          obj[key] = arr;
          stack.push({ indent, obj: arr });
        } else {
          const child: Record<string, unknown> = {};
          obj[key] = child;
          stack.push({ indent, obj: child });
        }
      }
    }
    i++;
  }

  return root;
}

function parseYAMLValue(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null" || val === "~") return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  // Remove quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ─── Schema Resolver ──────────────────────────────────────────────────────────

function resolveRef(ref: string, spec: OpenAPISpec): OpenAPISchema | null {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let current: unknown = spec;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current as OpenAPISchema | null;
}

function extractFieldsFromSchema(
  schema: OpenAPISchema | undefined,
  spec: OpenAPISpec,
  depth = 0
): EndpointField[] {
  if (!schema || depth > 3) return [];

  // Resolve $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    if (resolved) return extractFieldsFromSchema(resolved, spec, depth);
    return [];
  }

  const fields: EndpointField[] = [];
  const required = new Set(schema.required || []);

  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const resolvedProp = propSchema.$ref ? resolveRef(propSchema.$ref, spec) || propSchema : propSchema;
      const isPIIField = /email|phone|name|address|ssn|dob|birthdate|passport/i.test(name);
      const field: EndpointField = {
        name,
        type: (resolvedProp.type as EndpointField["type"]) || "string",
        required: required.has(name),
        isTenantKey: /tenantId|organizationId|shopId|workspaceId|companyId|clinicId|fleetId/i.test(name),
        isBoundaryField: resolvedProp.minimum !== undefined || resolvedProp.maximum !== undefined || resolvedProp.minLength !== undefined || resolvedProp.maxLength !== undefined,
      };
      if (resolvedProp.minimum !== undefined) field.min = resolvedProp.minimum;
      if (resolvedProp.maximum !== undefined) field.max = resolvedProp.maximum;
      if (resolvedProp.enum) field.enumValues = resolvedProp.enum.map(String);
      fields.push(field);
    }
  }

  return fields;
}

// ─── HTTP Method → tRPC-style name ────────────────────────────────────────────

function httpMethodToAction(method: string, path: string): string {
  const m = method.toUpperCase();
  const pathLower = path.toLowerCase();
  if (m === "GET") {
    if (pathLower.includes("{") || /\/\d+$/.test(path)) return "getById";
    return "list";
  }
  if (m === "POST") return "create";
  if (m === "PUT" || m === "PATCH") return "update";
  if (m === "DELETE") return "delete";
  return m.toLowerCase();
}

function pathToResourceName(path: string): string {
  // Extract resource name from path: /api/v1/users/{id} → users
  const segments = path.split("/").filter(s => s && !s.startsWith("{") && !/^v\d+$/.test(s) && s !== "api");
  const last = segments[segments.length - 1];
  if (!last) return "resource";
  // Remove trailing s for singular (users → user)
  return last.replace(/s$/, "");
}

function buildEndpointName(method: string, path: string, operationId?: string): string {
  if (operationId) {
    // Clean up operationId: createUser → users.create, getUserById → users.getById
    return operationId.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  }
  const resource = pathToResourceName(path);
  const action = httpMethodToAction(method, path);
  return `${resource}.${action}`;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseOpenAPISpec(content: string): AnalysisResult {
  let spec: OpenAPISpec;
  try {
    spec = parseYAML(content) as OpenAPISpec;
  } catch (e) {
    throw new Error(`Failed to parse OpenAPI spec: ${e}`);
  }

  if (!spec.paths) {
    throw new Error("Invalid OpenAPI spec: no paths found");
  }

  const isSwagger2 = Boolean(spec.swagger?.startsWith("2"));
  const title = spec.info?.title || "Unknown API";

  // Collect all endpoints
  const endpoints: APIEndpoint[] = [];
  const allRoles = new Set<string>();
  let loginEndpoint = "";
  let csrfEndpoint = "";
  const statusMachineStates = new Map<string, Set<string>>();
  const enums: Record<string, string[]> = {};
  const piiFields: string[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) continue;
      const op = operation as OpenAPIOperation;

      const name = buildEndpointName(method, path, op.operationId);
      const httpMethod = `${method.toUpperCase()} ${path}`;

      // Extract input fields from parameters
      const inputFields: EndpointField[] = [];
      for (const param of op.parameters || []) {
        if (param.in === "path" || param.in === "query" || param.in === "body" || param.in === "formData") {
          const schema = param.schema || (param.type ? { type: param.type } : undefined);
          if (param.in === "body" && schema) {
            inputFields.push(...extractFieldsFromSchema(schema, spec));
          } else {
            inputFields.push({
              name: param.name,
              type: (schema?.type as EndpointField["type"]) || "string",
              required: param.required || false,
              isTenantKey: /tenantId|organizationId|shopId|workspaceId|companyId/i.test(param.name),
            });
          }
        }
      }

      // Extract from requestBody (OpenAPI 3.x)
      if (op.requestBody?.content) {
        const jsonContent = op.requestBody.content["application/json"] || Object.values(op.requestBody.content)[0];
        if (jsonContent?.schema) {
          inputFields.push(...extractFieldsFromSchema(jsonContent.schema, spec));
        }
      }

      // Detect auth requirements
      const hasSecurity = (op.security && op.security.length > 0) || false;
      const roles = op["x-roles"] || op["x-auth"] || [];
      for (const role of roles) allRoles.add(role);

      // Detect login endpoint
      if (!loginEndpoint && (
        path.toLowerCase().includes("/login") ||
        path.toLowerCase().includes("/auth") ||
        path.toLowerCase().includes("/signin") ||
        (op.operationId || "").toLowerCase().includes("login")
      ) && method === "post") {
        loginEndpoint = `${method.toUpperCase()} ${path}`;
      }

      // Detect CSRF endpoint
      if (!csrfEndpoint && (
        path.toLowerCase().includes("/csrf") ||
        (op.operationId || "").toLowerCase().includes("csrf")
      )) {
        csrfEndpoint = path;
      }

      // Extract enum values from response schemas (status fields)
      for (const [, response] of Object.entries(op.responses || {})) {
        const resp = response as OpenAPIResponse;
        if (resp.content) {
          const schema = resp.content["application/json"]?.schema;
          if (schema) {
            const fields = extractFieldsFromSchema(schema, spec);
            for (const field of fields) {
              if (field.name === "status" || field.name === "state") {
                const enumValues = field.enumValues;
                if (enumValues && enumValues.length > 0) {
                  const states = enumValues.map(s => s.trim().toUpperCase());
                  if (!statusMachineStates.has(pathToResourceName(path))) {
                    statusMachineStates.set(pathToResourceName(path), new Set());
                  }
                  for (const s of states) statusMachineStates.get(pathToResourceName(path))!.add(s);
                }
              }
            }
          }
        }
      }

      // Detect PII fields
      for (const field of inputFields) {
        if (/email|phone|name|address|ssn|dob|birthdate|passport/i.test(field.name)) piiFields.push(`${pathToResourceName(path)}.${field.name}`);
      }

      endpoints.push({
        name,
        method: httpMethod,
        auth: hasSecurity ? "authenticated" : "public",
        relatedBehaviors: [],
        inputFields,
        outputFields: [],
      });
    }
  }

  // Extract enum schemas from components/definitions
  const schemas = spec.components?.schemas || spec.definitions || {};
  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.enum) {
      enums[schemaName] = schema.enum.map(String);
    }
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.enum) {
          enums[`${schemaName}.${propName}`] = propSchema.enum.map(String);
        }
      }
    }
  }

  // Build auth model
  const authSchemes = spec.components?.securitySchemes || spec.securityDefinitions || {};
  const hasJWT = Object.values(authSchemes).some((s) => {
    const scheme = s as { type?: string; scheme?: string };
    return scheme.type === "http" && scheme.scheme === "bearer";
  });
  const hasCookie = Object.values(authSchemes).some((s) => {
    const scheme = s as { type?: string; in?: string };
    return scheme.type === "apiKey" && scheme.in === "cookie";
  });

  const defaultRoles: AuthRole[] = allRoles.size > 0
    ? Array.from(allRoles).map(r => ({
        name: r,
        envUserVar: `E2E_${r.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_USER`,
        envPassVar: `E2E_${r.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PASS`,
        defaultUser: `test-${r.toLowerCase()}`,
        defaultPass: "TestPass2026x",
      }))
    : [
        { name: "admin", envUserVar: "E2E_ADMIN_USER", envPassVar: "E2E_ADMIN_PASS", defaultUser: "test-admin", defaultPass: "TestPass2026x" },
        { name: "user", envUserVar: "E2E_USER_USER", envPassVar: "E2E_USER_PASS", defaultUser: "test-user", defaultPass: "TestPass2026x" },
      ];

  // Build status machines
  const statusMachines = Array.from(statusMachineStates.entries()).map(([resource, states]) => ({
    resource,
    states: Array.from(states),
    transitions: [] as [string, string][],
    forbidden: [] as [string, string][],
  }));

  // Detect tenant model
  const tenantField = endpoints
    .flatMap(e => e.inputFields || [])
    .find(f => f.isTenantKey);

  // Build behaviors from endpoints
  const behaviors = endpoints.map((ep, idx) => {
    const parts = ep.method?.split(" ") || [];
    const httpVerb = parts[0] || "POST";
    const path = parts[1] || ep.name;
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(httpVerb);
    const resource = pathToResourceName(path);

    return {
      id: `OPEN-${String(idx + 1).padStart(3, "0")}`,
      title: `${httpVerb} ${path}`,
      subject: ep.auth === "authenticated" ? "authenticated user" : "user",
      action: httpMethodToAction(httpVerb, path),
      object: resource,
      preconditions: ep.auth === "authenticated" ? ["user is authenticated"] : [],
      postconditions: isWrite ? [`${resource} is modified`] : [],
      errorCases: ep.auth === "authenticated" ? ["401 Unauthorized", "403 Forbidden"] : [],
      tags: [],
      riskHints: isWrite ? ["data mutation"] : [],
    };
  });

  const ir: AnalysisIR = {
    behaviors,
    invariants: [],
    contradictions: [],
    ambiguities: [],
    apiEndpoints: endpoints,
    resources: [],
    tenantModel: tenantField ? {
      tenantIdField: tenantField.name,
      tenantEntity: tenantField.name.replace(/Id$/i, ""),
    } : null,
    authModel: {
      loginEndpoint: loginEndpoint || (isSwagger2 ? `POST ${spec.basePath || ""}/auth/login` : "POST /api/auth/login"),
      csrfEndpoint,
      csrfPattern: hasCookie ? "cookie" : hasJWT ? "bearer" : "none",
      roles: defaultRoles,
    },
    statusMachine: statusMachines[0] || null,
    statusMachines: statusMachines.length > 0 ? statusMachines : undefined,
    enums,
  };

  return {
    ir,
    qualityScore: Math.min(100, Math.round(
      (endpoints.length > 0 ? 40 : 0) +
      (tenantField ? 20 : 0) +
      (piiFields.length > 0 ? 10 : 0) +
      (statusMachines.length > 0 ? 15 : 0) +
      (allRoles.size > 0 ? 15 : 0)
    )),
    specType: "openapi",
  };
}

// ─── File Detection ────────────────────────────────────────────────────────────

export function isOpenAPISpec(content: string): boolean {
  const trimmed = content.trim();
  // JSON format
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return Boolean(parsed.openapi || parsed.swagger);
    } catch { return false; }
  }
  // YAML format
  return /^openapi:\s*["']?3\.|^swagger:\s*["']?2\./m.test(trimmed);
}
