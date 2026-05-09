const baseUrl = (process.env.DEPLOY_URL || process.env.APP_BASE_URL || "").replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Missing DEPLOY_URL or APP_BASE_URL");
  process.exit(1);
}

async function check(path: string) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const body = await response.text();
  return { url, response, body };
}

async function waitForOk(path: string, label: string) {
  const deadline = Date.now() + Number(process.env.SMOKE_TIMEOUT_MS || 120_000);
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const result = await check(path);
      if (result.response.ok) return result;
      lastError = `${label} check failed (${result.response.status}) at ${result.url}: ${result.body.slice(0, 300)}`;
    } catch (error) {
      lastError = `${label} check failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(lastError || `${label} check did not become healthy before timeout`);
}

async function main() {
  const health = await waitForOk("/api/health", "Health");
  const ready = await waitForOk("/api/ready", "Readiness");
  const meta = await waitForOk("/api/meta", "Meta");

  console.log(JSON.stringify({
    ok: true,
    deployUrl: baseUrl,
    health: JSON.parse(health.body),
    ready: JSON.parse(ready.body),
    meta: JSON.parse(meta.body),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
