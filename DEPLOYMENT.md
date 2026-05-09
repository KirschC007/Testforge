# TestForge Deployment

## Required secrets

- `HETZNER_HOST` — public server hostname or IP
- `HETZNER_USER` — SSH user
- `HETZNER_SSH_KEY` — private key for the deploy host
- `DEPLOY_PATH` — absolute path on the server, for example `/opt/testforge`
- `APP_BASE_URL` — public product URL, for example `https://testforge.hilf-mir.app`

## DNS

Create these records at your DNS provider before running the GitHub deploy:

- `A testforge.hilf-mir.app -> <Hetzner IPv4>`
- `AAAA testforge.hilf-mir.app -> <Hetzner IPv6>` when the server has IPv6 enabled

If Cloudflare is used, start with DNS-only mode until Caddy has issued the first certificate. After that, use Full (strict) TLS mode.

The deploy workflow runs `node --import tsx scripts/verify_dns_ready.ts` before touching the server. It fails early when `APP_BASE_URL` does not resolve to `HETZNER_HOST`.

## Required runtime environment

Set these in the server-side `.env` file used by `docker-compose.hetzner.yml`:

- `SERVER_NAME` — public hostname only, for example `testforge.hilf-mir.app`
- `ACME_EMAIL` — email address used for Let's Encrypt notices
- `APP_BASE_URL`
- `TRUSTED_HOSTS` — comma-separated public hostnames that may send requests, for example `testforge.hilf-mir.app`
- `AUTH_MODE` — use `local` for self-hosted password login, or `oauth` when OAuth is configured
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `JWT_SECRET` — at least 32 random characters, no placeholders
- `LLM_API_KEY`
- `MINIO_ROOT_PASSWORD`

Production startup now fails closed when critical values are missing, use HTTP instead of HTTPS, or still contain placeholders.
Public registration is closed after the first bootstrap admin unless `ALLOW_PUBLIC_REGISTRATION=1` is explicitly set.

## Health endpoints

- `/api/health` — liveness
- `/api/ready` — readiness including database connectivity
- `/api/meta` — deployment metadata and resolved public app URL

## Smoke test

After deploy, run:

```bash
DEPLOY_URL=https://your-public-url node --import tsx scripts/smoke_deploy.ts
```

This verifies:

- app process responds
- database is reachable
- public URL resolution is correct

## Production stack

The Hetzner stack exposes only Caddy on ports `80`, `443/tcp`, and `443/udp`. The app, database, and object storage stay internal to the Docker network. Caddy terminates TLS automatically through Let's Encrypt and forwards traffic to the app container.

Deploy manually on the server with:

```bash
cd /opt/testforge
cp docker/env-template.txt .env
# Fill every placeholder in .env, especially SERVER_NAME, ACME_EMAIL, APP_BASE_URL, TRUSTED_HOSTS and secrets.
docker compose -f docker-compose.hetzner.yml config
docker compose -f docker-compose.hetzner.yml up -d --build --remove-orphans
```

On a server that already has a public reverse proxy on ports `80/443`, use:

```bash
cd /opt/testforge
docker compose -f docker-compose.shared-proxy.yml up -d --build --remove-orphans
```

Then add this route to the existing Caddyfile and reload Caddy:

```caddyfile
testforge.hilf-mir.app {
  encode gzip
  reverse_proxy testforge_app:3000
}
```

## Server hardening checklist

- Point DNS at the Hetzner server before deploying so Caddy can issue the certificate.
- Terminate TLS at Caddy or a managed load balancer and forward `X-Forwarded-Proto: https`.
- Do not publish the app container port directly; route public traffic through Caddy only.
- Keep MinIO console bound to `127.0.0.1` or behind VPN/tunnel.
- Run `npm run quality:gate` before deploy and `DEPLOY_URL=https://your-public-url npm run smoke:deploy` after deploy.
- Replace all legal-page `TODO` placeholders before public launch.
