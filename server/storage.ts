/**
 * TestForge Storage Helpers
 * Dual-mode: MinIO/S3 (self-hosted) or Manus Storage Proxy (cloud)
 *
 * Self-hosted: Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 * Cloud (Manus): Set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY
 */
import { ENV } from './_core/env';

function isS3Mode(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

// ─── S3/MinIO helpers ─────────────────────────────────────────────────────────

async function hmacSha256(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function s3Put(relKey: string, data: Buffer | Uint8Array | string, contentType: string): Promise<{ key: string; url: string }> {
  const endpoint = process.env.S3_ENDPOINT!;
  const accessKey = process.env.S3_ACCESS_KEY!;
  const secretKey = process.env.S3_SECRET_KEY!;
  const bucket = process.env.S3_BUCKET || "testforge";
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data as Uint8Array);

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
  const datetimeStr = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const region = "us-east-1";
  const payloadHash = await sha256Hex(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer);
  const host = new URL(endpoint).host;

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${datetimeStr}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", `/${bucket}/${key}`, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStr}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", datetimeStr, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmacSha256(`AWS4${secretKey}`, dateStr);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const uploadUrl = `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": datetimeStr, "Authorization": authorization },
    body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`S3 upload failed (${response.status}): ${message}`);
  }
  return { key, url: uploadUrl };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const endpoint = process.env.S3_ENDPOINT!;
  const accessKey = process.env.S3_ACCESS_KEY!;
  const secretKey = process.env.S3_SECRET_KEY!;
  const bucket = process.env.S3_BUCKET || "testforge";
  const key = normalizeKey(relKey);

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
  const datetimeStr = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const region = "us-east-1";
  const expiresSeconds = 3600;
  const host = new URL(endpoint).host;
  const credentialScope = `${dateStr}/${region}/s3/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;

  const queryParams = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${datetimeStr}&X-Amz-Expires=${expiresSeconds}&X-Amz-SignedHeaders=host`;
  const canonicalRequest = ["GET", `/${bucket}/${key}`, queryParams, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", datetimeStr, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmacSha256(`AWS4${secretKey}`, dateStr);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const url = `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}?${queryParams}&X-Amz-Signature=${signature}`;
  return { key, url };
}

// ─── Manus Proxy helpers ──────────────────────────────────────────────────────

async function manusProxyPut(relKey: string, data: Buffer | Uint8Array | string, contentType: string): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) throw new Error("Storage credentials missing: set S3_ENDPOINT or BUILT_IN_FORGE_API_URL");
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as unknown as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status}): ${await response.text().catch(() => response.statusText)}`);
  return { key, url: (await response.json()).url };
}

async function manusProxyGet(relKey: string): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) throw new Error("Storage credentials missing");
  const key = normalizeKey(relKey);
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } });
  return { key, url: (await response.json()).url };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  return isS3Mode() ? s3Put(relKey, data, contentType) : manusProxyPut(relKey, data, contentType);
}

export async function storageGet(
  relKey: string,
  _expiresIn?: number
): Promise<{ key: string; url: string }> {
  return isS3Mode() ? s3Get(relKey) : manusProxyGet(relKey);
}
