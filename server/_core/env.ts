export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? process.env.VITE_PUBLIC_APP_URL ?? "https://testforge.dev",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  authMode: process.env.AUTH_MODE ?? "oauth",
};

const PLACEHOLDER_PATTERNS = [/changeme/i, /your_/i, /example/i, /replace/i, /\.{3,}/];

function isPlaceholder(value: string) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function requireSecret(name: string, value: string, minLength = 32) {
  if (!value || value.length < minLength || isPlaceholder(value)) {
    throw new Error(`${name} must be set to a non-placeholder secret with at least ${minLength} characters`);
  }
}

function requireHttpsUrl(name: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use https:// in production`);
  }
}

function hasCompleteS3Config() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_BUCKET);
}

export function assertProductionEnv(env = ENV) {
  if (!env.isProduction) return;

  const missing: string[] = [];
  if (env.authMode !== "local" && !env.appId) missing.push("VITE_APP_ID");
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (env.authMode !== "local" && !env.oAuthServerUrl) missing.push("OAUTH_SERVER_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  requireSecret("JWT_SECRET", env.cookieSecret);
  requireHttpsUrl("APP_BASE_URL", env.appBaseUrl);
  requireSecret("BUILT_IN_FORGE_API_KEY", env.forgeApiKey, 8);
  if (env.authMode !== "local") {
    requireHttpsUrl("OAUTH_SERVER_URL", env.oAuthServerUrl);
  }

  if (!hasCompleteS3Config() && (!env.forgeApiUrl || !env.forgeApiKey)) {
    throw new Error("Production storage must be configured with S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET or a storage-capable BUILT_IN_FORGE_API_URL");
  }
}
