import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type Address = {
  address: string;
  family: 4 | 6;
};

const warnOnly = process.env.DNS_PREFLIGHT_WARN_ONLY === "1";

function fail(message: string): never {
  if (warnOnly) {
    console.warn(`[dns-preflight] ${message}`);
    process.exit(0);
  }

  throw new Error(message);
}

function getPublicHost() {
  const rawUrl = (process.env.DEPLOY_URL || process.env.APP_BASE_URL || "").trim();
  if (!rawUrl) {
    fail("Missing DEPLOY_URL or APP_BASE_URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail(`Invalid deployment URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`Deployment URL must use HTTPS, got ${parsed.protocol}`);
  }

  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    fail("Deployment URL must use a public DNS hostname, not localhost.");
  }

  return parsed.hostname;
}

async function resolveHost(host: string): Promise<Address[]> {
  if (isIP(host)) {
    return [{ address: host, family: isIP(host) as 4 | 6 }];
  }

  try {
    return await lookup(host, { all: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Could not resolve DNS for ${host}: ${detail}`);
  }
}

function addressesOverlap(left: Address[], right: Address[]) {
  const rightSet = new Set(right.map((entry) => entry.address));
  return left.some((entry) => rightSet.has(entry.address));
}

async function main() {
  const publicHost = getPublicHost();
  const targetHost = (process.env.EXPECTED_DNS_TARGET || process.env.HETZNER_HOST || "").trim();
  const publicAddresses = await resolveHost(publicHost);
  let targetAddresses: Address[] = [];

  if (targetHost) {
    targetAddresses = await resolveHost(targetHost);
    if (!addressesOverlap(publicAddresses, targetAddresses)) {
      fail(
        `DNS for ${publicHost} resolves to ${publicAddresses
          .map((entry) => entry.address)
          .join(", ")}, but target ${targetHost} resolves to ${targetAddresses.map((entry) => entry.address).join(", ")}.`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        publicHost,
        publicAddresses,
        targetHost: targetHost || null,
        targetAddresses,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
