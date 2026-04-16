# TestForge Self-Hosted Dockerfile
# Multi-stage build: build frontend + server, then minimal runtime image

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files AND patches (required by pnpm for patched deps)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

RUN npm install -g pnpm

# Copy package files AND patches before install
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
