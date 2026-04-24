# ── Stage 1: install & build native modules ──────────────
FROM node:20-alpine AS deps

# better-sqlite3 needs python3 + make + g++ to compile
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
# Install all deps (including native compilation)
RUN npm install --omit=dev

# ── Stage 2: runtime image ────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy node_modules with compiled native binaries
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY package.json ./

# Copy private PDFs (seed para migrateEbooksToDB.js — tras migrar viven en DB)
COPY private ./private

# SQLite data directory (mount a volume here in EasyPanel)
RUN mkdir -p data

EXPOSE 4000

CMD ["node", "src/server.js"]
