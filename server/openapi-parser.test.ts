/**
 * Vitest tests for server/openapi-parser.ts
 *
 * Covers:
 *  - isOpenAPIDocument: JSON, YAML, Swagger 2.x, negative cases
 *  - parseOpenAPI: endpoints, behaviors, inputFields, outputFields, auth model,
 *    tenant model, enums, status machine, quality score
 *  - $ref resolution
 *  - Swagger 2.x compatibility
 */

import { describe, it, expect } from "vitest";
import { isOpenAPIDocument, parseOpenAPI } from "./openapi-parser";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PETSTORE_JSON = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Petstore", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        summary: "List all pets",
        tags: ["pets"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "A list of pets",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Pet",
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createPet",
        summary: "Create a pet",
        tags: ["pets"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePetInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Pet created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
          },
          "400": { description: "Invalid input" },
          "422": { description: "Validation error" },
        },
      },
    },
    "/pets/{petId}": {
      get: {
        operationId: "getPet",
        summary: "Get a pet by ID",
        tags: ["pets"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "A pet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
          },
          "404": { description: "Pet not found" },
        },
      },
      delete: {
        operationId: "deletePet",
        summary: "Delete a pet",
        tags: ["pets"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "204": { description: "Pet deleted" },
          "404": { description: "Pet not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          status: { type: "string", enum: ["available", "pending", "sold"] },
          ownerId: { type: "string" },
        },
        required: ["id", "name"],
      },
      CreatePetInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          status: { type: "string", enum: ["available", "pending", "sold"] },
          ownerId: { type: "string", "x-tenant-key": true },
          price: { type: "number", minimum: 0.01, maximum: 9999.99 },
        },
        required: ["name", "ownerId"],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        "x-login-endpoint": "/api/auth/login",
        "x-roles": [
          {
            name: "admin",
            envUserVar: "E2E_ADMIN_USER",
            envPassVar: "E2E_ADMIN_PASS",
            defaultUser: "admin@test.com",
            defaultPass: "Admin123!",
          },
          {
            name: "user",
            envUserVar: "E2E_USER_EMAIL",
            envPassVar: "E2E_USER_PASS",
            defaultUser: "user@test.com",
            defaultPass: "User123!",
          },
        ],
      },
    },
  },
});

const PETSTORE_YAML = `
openapi: "3.0.3"
info:
  title: Petstore YAML
  version: "1.0.0"
paths:
  /animals:
    post:
      operationId: createAnimal
      summary: Create an animal
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, orgId]
              properties:
                name:
                  type: string
                  minLength: 1
                  maxLength: 50
                orgId:
                  type: string
                  x-tenant-key: true
                age:
                  type: integer
                  minimum: 0
                  maximum: 100
      responses:
        "201":
          description: Animal created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  name: { type: string }
                  orgId: { type: string }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
`;

const SWAGGER2_JSON = JSON.stringify({
  swagger: "2.0",
  info: { title: "Swagger 2 API", version: "1.0.0" },
  basePath: "/api",
  paths: {
    "/orders": {
      post: {
        operationId: "createOrder",
        summary: "Create an order",
        security: [{ apiKey: [] }],
        parameters: [
          {
            in: "body",
            name: "body",
            required: true,
            schema: {
              type: "object",
              required: ["customerId", "amount"],
              properties: {
                customerId: { type: "string" },
                amount: { type: "number", minimum: 0.01, maximum: 100000 },
                currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
              },
            },
          },
        ],
        responses: {
          "201": {
            description: "Order created",
            schema: {
              type: "object",
              properties: {
                orderId: { type: "string" },
                status: { type: "string" },
                amount: { type: "number" },
              },
            },
          },
          "400": { description: "Bad request" },
        },
      },
    },
  },
  securityDefinitions: {
    apiKey: {
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
    },
  },
});

const MULTI_STATUS_SPEC = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Task API", version: "1.0.0" },
  paths: {
    "/tasks": {
      post: {
        operationId: "createTask",
        summary: "Create a task",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "title"],
                properties: {
                  workspaceId: { type: "string", "x-tenant-key": true },
                  title: { type: "string", minLength: 1, maxLength: 200 },
                  status: {
                    type: "string",
                    enum: ["todo", "in_progress", "review", "done"],
                  },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Task created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    status: { type: "string" },
                    workspaceId: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/tasks/{taskId}": {
      put: {
        operationId: "updateTask",
        summary: "Update task status",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "taskId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "status"],
                properties: {
                  workspaceId: { type: "string", "x-tenant-key": true },
                  status: {
                    type: "string",
                    enum: ["todo", "in_progress", "review", "done"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Task updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    status: { type: "string" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
});

// ─── isOpenAPIDocument ────────────────────────────────────────────────────────

describe("isOpenAPIDocument", () => {
  it("returns true for OpenAPI 3.x JSON", () => {
    expect(isOpenAPIDocument(PETSTORE_JSON)).toBe(true);
  });

  it("returns true for OpenAPI 3.x YAML", () => {
    expect(isOpenAPIDocument(PETSTORE_YAML)).toBe(true);
  });

  it("returns true for Swagger 2.0 JSON", () => {
    expect(isOpenAPIDocument(SWAGGER2_JSON)).toBe(true);
  });

  it("returns false for plain text spec", () => {
    expect(isOpenAPIDocument("POST /api/users creates a user. Returns 200 with id and email.")).toBe(false);
  });

  it("returns false for Markdown spec", () => {
    const md = `# API Spec\n\n## Endpoints\n\n### POST /users\nCreates a user.\n\n**Input:** name, email\n**Output:** id, name, email`;
    expect(isOpenAPIDocument(md)).toBe(false);
  });

  it("returns false for random JSON without openapi/swagger key", () => {
    expect(isOpenAPIDocument(JSON.stringify({ foo: "bar", baz: 42 }))).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isOpenAPIDocument("")).toBe(false);
  });

  it("returns false for invalid JSON/YAML", () => {
    expect(isOpenAPIDocument("{ invalid json :::")).toBe(false);
  });
});

// ─── parseOpenAPI — endpoints ─────────────────────────────────────────────────

describe("parseOpenAPI — endpoints", () => {
  it("extracts all endpoints from Petstore JSON", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const names = result.ir.apiEndpoints.map(e => e.name);
    expect(names).toContain("pets.list");
    expect(names).toContain("pets.create");
    expect(names).toContain("pets.get");
    expect(names).toContain("pets.delete");
  });

  it("extracts endpoint from YAML spec", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    const names = result.ir.apiEndpoints.map(e => e.name);
    expect(names).toContain("animals.create");
  });

  it("extracts endpoint from Swagger 2.x JSON", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const names = result.ir.apiEndpoints.map(e => e.name);
    expect(names).toContain("orders.create");
  });

  it("sets auth=bearer for bearer security scheme", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    expect(createPet?.auth).toBe("bearer");
  });

  it("sets auth=none for endpoints without security", () => {
    const noAuthSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Public API", version: "1.0.0" },
      paths: {
        "/public": {
          get: {
            operationId: "getPublic",
            summary: "Public endpoint",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });
    const result = parseOpenAPI(noAuthSpec);
    // getPublic → publics.get (pluralized by camelToDot)
    const ep = result.ir.apiEndpoints.find(e => e.name === "publics.get" || e.name === "public.get");
    expect(ep).toBeDefined();
    expect(ep?.auth).toBe("none");
  });
});

// ─── parseOpenAPI — inputFields ───────────────────────────────────────────────

describe("parseOpenAPI — inputFields", () => {
  it("extracts inputFields from requestBody $ref", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    expect(createPet?.inputFields).toBeDefined();
    const fieldNames = createPet!.inputFields.map(f => f.name);
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("ownerId");
  });

  it("marks x-tenant-key field as isTenantKey", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    const ownerField = createPet?.inputFields.find(f => f.name === "ownerId");
    expect(ownerField?.isTenantKey).toBe(true);
  });

  it("extracts min/max constraints from schema", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    const nameField = createPet?.inputFields.find(f => f.name === "name");
    expect(nameField?.min).toBe(1);
    expect(nameField?.max).toBe(100);
    const priceField = createPet?.inputFields.find(f => f.name === "price");
    expect(priceField?.min).toBe(0.01);
    expect(priceField?.max).toBe(9999.99);
  });

  it("extracts enum values from schema", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    const statusField = createPet?.inputFields.find(f => f.name === "status");
    expect(statusField?.type).toBe("enum");
    expect(statusField?.enumValues).toEqual(["available", "pending", "sold"]);
  });

  it("marks required fields correctly", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    const nameField = createPet?.inputFields.find(f => f.name === "name");
    const statusField = createPet?.inputFields.find(f => f.name === "status");
    expect(nameField?.required).toBe(true);
    expect(statusField?.required).toBe(false);
  });

  it("extracts path parameters as inputFields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const getPet = result.ir.apiEndpoints.find(e => e.name === "pets.get");
    const petIdField = getPet?.inputFields.find(f => f.name === "petId");
    expect(petIdField).toBeDefined();
    expect(petIdField?.required).toBe(true);
  });

  it("extracts YAML inputFields with constraints", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    const createAnimal = result.ir.apiEndpoints.find(e => e.name === "animals.create");
    const nameField = createAnimal?.inputFields.find(f => f.name === "name");
    expect(nameField?.min).toBe(1);
    expect(nameField?.max).toBe(50);
    const ageField = createAnimal?.inputFields.find(f => f.name === "age");
    expect(ageField?.min).toBe(0);
    expect(ageField?.max).toBe(100);
  });

  it("marks x-tenant-key in YAML as isTenantKey", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    const createAnimal = result.ir.apiEndpoints.find(e => e.name === "animals.create");
    const orgField = createAnimal?.inputFields.find(f => f.name === "orgId");
    expect(orgField?.isTenantKey).toBe(true);
  });

  it("extracts Swagger 2.x body parameters as inputFields", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const createOrder = result.ir.apiEndpoints.find(e => e.name === "orders.create");
    const fieldNames = createOrder?.inputFields.map(f => f.name) || [];
    expect(fieldNames).toContain("customerId");
    expect(fieldNames).toContain("amount");
    expect(fieldNames).toContain("currency");
  });
});

// ─── parseOpenAPI — outputFields ─────────────────────────────────────────────

describe("parseOpenAPI — outputFields", () => {
  it("extracts outputFields from 201 response schema $ref", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    expect(createPet?.outputFields).toContain("id");
    expect(createPet?.outputFields).toContain("name");
  });

  it("extracts outputFields from 200 response array items", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const listPets = result.ir.apiEndpoints.find(e => e.name === "pets.list");
    // Array response: items properties
    expect(listPets?.outputFields).toContain("id");
    expect(listPets?.outputFields).toContain("name");
  });

  it("extracts outputFields from Swagger 2.x schema", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const createOrder = result.ir.apiEndpoints.find(e => e.name === "orders.create");
    expect(createOrder?.outputFields).toContain("orderId");
    expect(createOrder?.outputFields).toContain("status");
  });
});

// ─── parseOpenAPI — behaviors ─────────────────────────────────────────────────

describe("parseOpenAPI — behaviors", () => {
  it("generates at least one behavior per endpoint", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    // 4 endpoints → at least 4 behaviors
    expect(result.ir.behaviors.length).toBeGreaterThanOrEqual(4);
  });

  it("generates validation behavior for POST with constrained fields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const validationBehaviors = result.ir.behaviors.filter(b =>
      b.action === "validates" && b.tags.includes("validation")
    );
    expect(validationBehaviors.length).toBeGreaterThanOrEqual(1);
  });

  it("generates IDOR behavior for authenticated endpoints with tenant key", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const idorBehaviors = result.ir.behaviors.filter(b =>
      b.tags.includes("idor")
    );
    expect(idorBehaviors.length).toBeGreaterThanOrEqual(1);
  });

  it("behavior IDs are unique", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const ids = result.ir.behaviors.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("behaviors have required fields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    for (const b of result.ir.behaviors) {
      expect(typeof b.id).toBe("string");
      expect(b.id.length).toBeGreaterThan(0);
      expect(typeof b.title).toBe("string");
      expect(Array.isArray(b.tags)).toBe(true);
      expect(Array.isArray(b.riskHints)).toBe(true);
      expect(Array.isArray(b.preconditions)).toBe(true);
      expect(Array.isArray(b.postconditions)).toBe(true);
    }
  });

  it("DELETE behavior has irreversible risk hint", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const deleteBehaviors = result.ir.behaviors.filter(b =>
      b.riskHints.some(h => h.includes("irreversible"))
    );
    expect(deleteBehaviors.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── parseOpenAPI — auth model ────────────────────────────────────────────────

describe("parseOpenAPI — auth model", () => {
  it("extracts auth model from securitySchemes", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    expect(result.ir.authModel).not.toBeNull();
    expect(result.ir.authModel?.loginEndpoint).toBe("/api/auth/login");
  });

  it("extracts roles from x-roles extension", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const roles = result.ir.authModel?.roles || [];
    expect(roles.length).toBe(2);
    expect(roles.find(r => r.name === "admin")).toBeDefined();
    expect(roles.find(r => r.name === "user")).toBeDefined();
  });

  it("provides default role when no x-roles defined", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    const roles = result.ir.authModel?.roles || [];
    expect(roles.length).toBeGreaterThanOrEqual(1);
    expect(roles[0].envUserVar).toBeDefined();
    expect(roles[0].envPassVar).toBeDefined();
  });

  it("returns null authModel when no security schemes defined", () => {
    const noAuthSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "No Auth", version: "1.0.0" },
      paths: {
        "/public": {
          get: {
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });
    const result = parseOpenAPI(noAuthSpec);
    expect(result.ir.authModel).toBeNull();
  });
});

// ─── parseOpenAPI — tenant model ─────────────────────────────────────────────

describe("parseOpenAPI — tenant model", () => {
  it("extracts tenant model from x-tenant-key fields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    expect(result.ir.tenantModel).not.toBeNull();
    expect(result.ir.tenantModel?.tenantIdField).toBe("ownerId");
  });

  it("derives tenant entity name from field name", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    // ownerId → owner
    expect(result.ir.tenantModel?.tenantEntity).toBe("owner");
  });

  it("extracts tenant model from YAML x-tenant-key", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    expect(result.ir.tenantModel?.tenantIdField).toBe("orgId");
    expect(result.ir.tenantModel?.tenantEntity).toBe("org");
  });

  it("returns null tenantModel when no tenant key found", () => {
    const noTenantSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "No Tenant", version: "1.0.0" },
      paths: {
        "/items": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" } },
          },
        },
      },
    });
    const result = parseOpenAPI(noTenantSpec);
    expect(result.ir.tenantModel).toBeNull();
  });
});

// ─── parseOpenAPI — enums ─────────────────────────────────────────────────────

describe("parseOpenAPI — enums", () => {
  it("collects enum values from inputFields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    expect(result.ir.enums).toBeDefined();
    // status enum should be collected
    const statusEnum = result.ir.enums?.["status"] || result.ir.enums?.["status"];
    expect(statusEnum).toBeDefined();
  });

  it("collects all status enum values from multi-status spec", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    const statusEnum = result.ir.enums?.["status"];
    expect(statusEnum).toBeDefined();
    expect(statusEnum).toContain("todo");
    expect(statusEnum).toContain("in_progress");
    expect(statusEnum).toContain("review");
    expect(statusEnum).toContain("done");
  });

  it("collects priority enum from spec", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    const priorityEnum = result.ir.enums?.["priority"];
    expect(priorityEnum).toBeDefined();
    expect(priorityEnum).toContain("low");
    expect(priorityEnum).toContain("high");
  });
});

// ─── parseOpenAPI — status machine ───────────────────────────────────────────

describe("parseOpenAPI — status machine", () => {
  it("builds status machine when status enum has 2+ values", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    expect(result.ir.statusMachine).not.toBeNull();
    expect(result.ir.statusMachine?.states.length).toBeGreaterThanOrEqual(2);
  });

  it("status machine states include all enum values", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    const states = result.ir.statusMachine?.states || [];
    expect(states).toContain("todo");
    expect(states).toContain("in_progress");
    expect(states).toContain("done");
  });

  it("status machine has transitions", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    expect(result.ir.statusMachine?.transitions.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null statusMachine when no status enum found", () => {
    const result = parseOpenAPI(PETSTORE_YAML);
    // YAML spec has no status enum
    expect(result.ir.statusMachine).toBeNull();
  });
});

// ─── parseOpenAPI — quality score ────────────────────────────────────────────

describe("parseOpenAPI — quality score", () => {
  it("returns quality score between 0 and 100", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
  });

  it("returns higher quality score for richer spec", () => {
    const richResult = parseOpenAPI(PETSTORE_JSON);
    const minimalSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "Minimal", version: "1.0.0" },
      paths: {
        "/x": {
          get: {
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });
    const minimalResult = parseOpenAPI(minimalSpec);
    expect(richResult.qualityScore).toBeGreaterThan(minimalResult.qualityScore);
  });

  it("specType is openapi for OpenAPI specs", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    // Petstore title doesn't match any domain keyword → "openapi"
    expect(result.specType).toBe("openapi");
  });

  it("specType is productivity for task-related spec", () => {
    const result = parseOpenAPI(MULTI_STATUS_SPEC);
    // "Task API" → "productivity"
    expect(result.specType).toBe("productivity");
  });
});

// ─── parseOpenAPI — resources ─────────────────────────────────────────────────

describe("parseOpenAPI — resources", () => {
  it("builds resources from endpoints", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    expect(result.ir.resources.length).toBeGreaterThanOrEqual(1);
    const petResource = result.ir.resources.find(r => r.name === "pets");
    expect(petResource).toBeDefined();
  });

  it("resource operations include create and list", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const petResource = result.ir.resources.find(r => r.name === "pets");
    expect(petResource?.operations).toContain("create");
    expect(petResource?.operations).toContain("list");
  });

  it("resource hasPII is true when PII fields present", () => {
    const piiSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "User API", version: "1.0.0" },
      paths: {
        "/users": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      name: { type: "string" },
                      phone: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" } },
          },
        },
      },
    });
    const result = parseOpenAPI(piiSpec);
    const userResource = result.ir.resources.find(r => r.name === "users");
    expect(userResource?.hasPII).toBe(true);
  });
});

// ─── parseOpenAPI — $ref resolution ──────────────────────────────────────────

describe("parseOpenAPI — $ref resolution", () => {
  it("resolves $ref in requestBody schema", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    // CreatePetInput has 4 fields — all should be resolved
    expect(createPet?.inputFields.length).toBeGreaterThanOrEqual(3);
  });

  it("resolves $ref in response schema for outputFields", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const createPet = result.ir.apiEndpoints.find(e => e.name === "pets.create");
    // Pet schema has id, name, status, ownerId
    expect(createPet?.outputFields.length).toBeGreaterThanOrEqual(3);
  });

  it("resolves nested $ref in array items", () => {
    const result = parseOpenAPI(PETSTORE_JSON);
    const listPets = result.ir.apiEndpoints.find(e => e.name === "pets.list");
    // Array of Pet → items resolved → id, name, status, ownerId
    expect(listPets?.outputFields.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── parseOpenAPI — Swagger 2.x ───────────────────────────────────────────────

describe("parseOpenAPI — Swagger 2.x", () => {
  it("parses Swagger 2.x body parameters", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const createOrder = result.ir.apiEndpoints.find(e => e.name === "orders.create");
    const amountField = createOrder?.inputFields.find(f => f.name === "amount");
    expect(amountField?.min).toBe(0.01);
    expect(amountField?.max).toBe(100000);
  });

  it("parses Swagger 2.x enum values", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const createOrder = result.ir.apiEndpoints.find(e => e.name === "orders.create");
    const currencyField = createOrder?.inputFields.find(f => f.name === "currency");
    expect(currencyField?.type).toBe("enum");
    expect(currencyField?.enumValues).toContain("USD");
    expect(currencyField?.enumValues).toContain("EUR");
  });

  it("parses Swagger 2.x response schema for outputFields", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    const createOrder = result.ir.apiEndpoints.find(e => e.name === "orders.create");
    expect(createOrder?.outputFields).toContain("orderId");
    expect(createOrder?.outputFields).toContain("amount");
  });

  it("generates behaviors from Swagger 2.x spec", () => {
    const result = parseOpenAPI(SWAGGER2_JSON);
    expect(result.ir.behaviors.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── parseOpenAPI — allOf $ref merging ────────────────────────────────────────

describe("parseOpenAPI — allOf schema merging", () => {
  it("merges allOf schemas into a single field list", () => {
    const allOfSpec = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "AllOf Test", version: "1.0.0" },
      paths: {
        "/items": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/Base" },
                      { $ref: "#/components/schemas/Extra" },
                    ],
                  },
                },
              },
            },
            responses: { "201": { description: "Created" } },
          },
        },
      },
      components: {
        schemas: {
          Base: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
            },
          },
          Extra: {
            type: "object",
            properties: {
              description: { type: "string" },
              count: { type: "integer", minimum: 0, maximum: 1000 },
            },
          },
        },
      },
    });
    const result = parseOpenAPI(allOfSpec);
    const ep = result.ir.apiEndpoints.find(e => e.name === "items.create");
    const fieldNames = ep?.inputFields.map(f => f.name) || [];
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("description");
    expect(fieldNames).toContain("count");
  });
});
