import crypto from "node:crypto";
import { safeUploadFilename } from "./upload-security";

export function normalizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);

  if (
    segments.length === 0 ||
    normalized.includes("\0") ||
    normalized.includes("//") ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid storage key");
  }

  return segments.join("/");
}

export function buildUserSpecKey(userId: number, filename: string): string {
  const safeName = safeUploadFilename(filename);
  return `users/${userId}/specs/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

export function assertUserSpecKey(userId: number, key: string): string {
  const normalized = normalizeStorageKey(key);
  const prefix = `users/${userId}/specs/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error("Spec key does not belong to the authenticated user");
  }
  return normalized;
}
