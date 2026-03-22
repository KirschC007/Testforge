# TestForge Self-Hosted Dockerfile (S4-4)
# Multi-stage build: build frontend + server, then minimal runtime image

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend
RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

RUN npm install -g pnpm

# Copy package files and install production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "--loader", "tsx", "server/index.ts"]
