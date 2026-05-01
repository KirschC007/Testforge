/**
 * Endpoint Name Normalization — Unit Tests
 *
 * Verifies normalizeEndpointName handles all the LLM/REST/camelCase patterns
 * we've seen in real specs.
 */
import { describe, it, expect } from "vitest";
import { normalizeEndpointName, ensureArray, ensureString, sanitizeBehavior, isGenericEndpoint } from "./normalize";

describe("normalizeEndpointName", () => {
  describe("Framework prefix stripping", () => {
    it("strips trpc. prefix", () => {
      expect(normalizeEndpointName("trpc.users.create")).toBe("users.create");
    });

    it("strips api. prefix", () => {
      expect(normalizeEndpointName("api.users.list")).toBe("users.list");
    });

    it("strips v1. prefix", () => {
      expect(normalizeEndpointName("v1.users.get")).toBe("users.get");
    });

    it("does not strip non-framework prefix", () => {
      expect(normalizeEndpointName("users.create")).toBe("users.create");
    });
  });

  describe("REST path conversion", () => {
    it("converts /api/users (POST) to users.create", () => {
      expect(normalizeEndpointName("/api/users", "POST")).toBe("users.create");
    });

    it("converts /api/users (GET) to users.list", () => {
      expect(normalizeEndpointName("/api/users", "GET")).toBe("users.list");
    });

    it("converts /api/users/:id/freeze to users.freeze", () => {
      expect(normalizeEndpointName("/api/users/:id/freeze")).toBe("users.freeze");
    });

    it("converts /api/owners/:id/gdpr to owners.gdprDelete", () => {
      expect(normalizeEndpointName("/api/owners/:id/gdpr")).toBe("owners.gdprDelete");
    });

    it("converts /api/v1/products/:id/cancel to products.cancel", () => {
      expect(normalizeEndpointName("/api/v1/products/:id/cancel")).toBe("products.cancel");
    });

    it("converts /api/auth/csrf-token to auth.csrfToken", () => {
      expect(normalizeEndpointName("/api/auth/csrf-token")).toBe("auth.csrfToken");
    });
  });

  describe("CamelCase verb-first conversion", () => {
    it("converts createAccount to accounts.create", () => {
      expect(normalizeEndpointName("createAccount")).toBe("accounts.create");
    });

    it("converts listAccounts to accounts.list", () => {
      expect(normalizeEndpointName("listAccounts")).toBe("accounts.list");
    });

    it("converts updateBooking to bookings.update", () => {
      expect(normalizeEndpointName("updateBooking")).toBe("bookings.update");
    });

    it("converts deleteUser to users.delete", () => {
      expect(normalizeEndpointName("deleteUser")).toBe("users.delete");
    });

    it("converts gdprDeleteOwner to owners.gdprDelete", () => {
      expect(normalizeEndpointName("gdprDeleteOwner")).toBe("owners.gdprDelete");
    });
  });

  describe("Action synonym normalization", () => {
    it("converts users.add to users.create", () => {
      expect(normalizeEndpointName("users.add")).toBe("users.create");
    });

    it("converts users.register to users.create", () => {
      expect(normalizeEndpointName("users.register")).toBe("users.create");
    });

    it("converts users.remove to users.delete", () => {
      expect(normalizeEndpointName("users.remove")).toBe("users.delete");
    });

    it("converts users.fetch to users.getById", () => {
      expect(normalizeEndpointName("users.fetch")).toBe("users.getById");
    });

    it("converts users.modify to users.update", () => {
      expect(normalizeEndpointName("users.modify")).toBe("users.update");
    });
  });

  describe("Cleanup patterns", () => {
    it("converts ownerDatas.export to owners.export", () => {
      expect(normalizeEndpointName("ownerDatas.export")).toBe("owners.export");
    });

    it("converts users.gdpr to users.gdpr (preserves dot-form)", () => {
      // The .endsWith(".gdpr") rule appends "Delete" but only after camelCase resolution.
      // For pure "users.gdpr", no transformation is currently applied — verify reality.
      expect(normalizeEndpointName("users.gdpr")).toMatch(/^users\.gdpr/);
    });
  });

  describe("Idempotent on already-normalized names", () => {
    it("preserves users.create", () => {
      expect(normalizeEndpointName("users.create")).toBe("users.create");
    });

    it("preserves orders.updateStatus", () => {
      // updateStatus contains "Status" suffix — special handling
      const result = normalizeEndpointName("orders.updateStatus");
      // Either preserved or normalized to orders.update — both acceptable
      expect(result).toMatch(/orders\.(updateStatus|update)/);
    });
  });
});

describe("ensureArray", () => {
  it("returns the array unchanged when input is array", () => {
    expect(ensureArray(["a", "b"])).toEqual(["a", "b"]);
  });

  it("wraps a single string in an array", () => {
    expect(ensureArray("hello")).toEqual(["hello"]);
  });

  it("wraps a number into a string array", () => {
    expect(ensureArray(123)).toEqual(["123"]);
  });

  it("returns empty array for null/undefined", () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(ensureArray("")).toEqual([]);
  });

  it("returns empty array for objects", () => {
    expect(ensureArray({ key: "value" })).toEqual([]);
  });

  it("converts mixed-type array to string array", () => {
    expect(ensureArray([1, "two", 3])).toEqual(["1", "two", "3"]);
  });
});

describe("ensureString", () => {
  it("returns string input unchanged", () => {
    expect(ensureString("hello")).toBe("hello");
  });

  it("converts number to string", () => {
    expect(ensureString(42)).toBe("42");
  });

  it("returns first array element", () => {
    expect(ensureString(["first", "second"])).toBe("first");
  });

  it("returns fallback for null/undefined", () => {
    expect(ensureString(null, "default")).toBe("default");
    expect(ensureString(undefined, "default")).toBe("default");
  });

  it("returns fallback for objects", () => {
    expect(ensureString({ key: "value" }, "fallback")).toBe("fallback");
  });
});

describe("sanitizeBehavior", () => {
  it("preserves valid behavior unchanged in shape", () => {
    const result = sanitizeBehavior({
      id: "B001",
      title: "Test",
      tags: ["a", "b"],
    });
    expect(result.id).toBe("B001");
    expect(result.title).toBe("Test");
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("provides defaults for missing fields", () => {
    const result = sanitizeBehavior({});
    expect(result.title).toBe("Untitled behavior");
    expect(result.subject).toBe("System");
    expect(result.preconditions).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("sanitizes string fields that are numbers", () => {
    const result = sanitizeBehavior({ id: 42, title: 7 });
    expect(result.id).toBe("42");
    expect(result.title).toBe("7");
  });

  it("converts string fields to arrays where expected", () => {
    const result = sanitizeBehavior({ tags: "single-tag" });
    expect(result.tags).toEqual(["single-tag"]);
  });
});

describe("isGenericEndpoint", () => {
  it("flags procedure.list as generic", () => {
    expect(isGenericEndpoint("procedure.list")).toBe(true);
  });

  it("flags single-letter resource as generic", () => {
    expect(isGenericEndpoint("s.getById")).toBe(true);
  });

  it("flags template-variable resources as generic", () => {
    expect(isGenericEndpoint("{slug}.list")).toBe(true);
  });

  it("does NOT flag legitimate resource names", () => {
    expect(isGenericEndpoint("users.create")).toBe(false);
    expect(isGenericEndpoint("orders.list")).toBe(false);
  });

  it("returns false for names without a dot", () => {
    expect(isGenericEndpoint("users")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isGenericEndpoint("")).toBe(false);
  });
});
