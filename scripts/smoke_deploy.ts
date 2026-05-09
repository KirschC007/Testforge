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

async function main() {
  const health = await check("/api/health");
  if (!health.response.ok) {
    throw new Error(`Health check failed (${health.response.status}) at ${health.url}: ${health.body.slice(0, 300)}`);
  }

  const ready = await check("/api/ready");
  if (!ready.response.ok) {
    throw new Error(`Readiness check failed (${ready.response.status}) at ${ready.url}: ${ready.body.slice(0, 300)}`);
  }

  const meta = await check("/api/meta");
  if (!meta.response.ok) {
    throw new Error(`Meta check failed (${meta.response.status}) at ${meta.url}: ${meta.body.slice(0, 300)}`);
  }

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
