# ── Stage 1: base ─────────────────────────────────────────────────────────────
# Node 22 slim — coincide con la versión usada en CI y Railway
FROM node:22-slim AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

# ── Stage 2: deps ──────────────────────────────────────────────────────────────
# Instala TODAS las dependencias (dev incluidas) para poder compilar
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/domain/package.json ./packages/domain/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# ── Stage 3: build ─────────────────────────────────────────────────────────────
FROM deps AS builder

# tsconfig base requerido por Prisma generate
COPY tsconfig.base.json ./

# Fuente completa de los paquetes workspace
COPY packages/domain ./packages/domain
COPY packages/database ./packages/database
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Prisma necesita DATABASE_URL definida para `generate`, pero NO se conecta aquí.
# El valor es un placeholder: el cliente generado no contiene credenciales.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}

# Genera el cliente Prisma (necesario antes del build de NestJS)
RUN pnpm db:generate

# Compila NestJS → apps/api/dist/
RUN pnpm --filter @motek/api build

# ── Stage 4: runner ────────────────────────────────────────────────────────────
# Imagen final: solo runtime, sin devDependencies ni fuentes TypeScript
FROM node:22-slim AS runner
RUN npm install -g pnpm@9.0.0
WORKDIR /app

ENV NODE_ENV=production

# Copia solo lo necesario para runtime
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/domain/package.json ./packages/domain/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/

# Solo dependencias de producción (sin devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Copia el build compilado y el cliente Prisma generado
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/src/generated ./packages/database/src/generated
COPY --from=builder /app/packages/domain/src ./packages/domain/src
COPY --from=builder /app/packages/types/src ./packages/types/src

# Cloud Run inyecta PORT automáticamente (NestJS ya lo lee en main.ts:120)
EXPOSE 3001

# Binarios nativos de Sentry requieren libstdc++ — disponible en node:slim
# Si hay errores de profiling, agregar: apt-get install -y --no-install-recommends libstdc++6

CMD ["node", "apps/api/dist/main.js"]
