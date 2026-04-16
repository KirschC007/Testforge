# TestForge Self-Hosted Dockerfile
# Single-stage build to avoid vite devDependency issues at runtime

FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files AND patches (required by pnpm for patched deps)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install ALL deps (including devDeps - vite is needed at runtime for static serving)
RUN pnpm install --frozen-lockfile

# Copy all source
COPY . .

# Build: vite → dist/public, esbuild → dist/index.js
RUN pnpm build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENV NODE_ENV=production

# Run drizzle migrations before starting the server.
# Migrations are idempotent — already-applied ones are skipped.
# If migrations fail, the container will fail to start (correct behavior).
CMD ["sh", "-c", "pnpm drizzle-kit migrate && node dist/index.js"]
