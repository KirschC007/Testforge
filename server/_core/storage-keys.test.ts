import { describe, expect, it } from "vitest";
import { assertUserSpecKey, buildUserSpecKey, normalizeStorageKey } from "./storage-keys";

describe("storage keys", () => {
  it("builds unguessable user-scoped spec keys", () => {
    const key = buildUserSpecKey(42, "../invoice spec.md");

    expect(key).toMatch(/^users\/42\/specs\/\d+-[a-f0-9-]+-invoice_spec\.md$/);
    expect(assertUserSpecKey(42, key)).toBe(key);
  });

  it("rejects cross-tenant spec keys", () => {
    const key = buildUserSpecKey(7, "spec.md");

    expect(() => assertUserSpecKey(8, key)).toThrow(/authenticated user/);
  });

  it("rejects traversal and malformed storage keys", () => {
    expect(() => normalizeStorageKey("../secret")).toThrow(/Invalid storage key/);
    expect(() => normalizeStorageKey("users/1//specs/a.md")).toThrow(/Invalid storage key/);
    expect(() => normalizeStorageKey("users/1/specs/../a.md")).toThrow(/Invalid storage key/);
  });
});
