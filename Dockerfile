# ─────────────────────────────────────────────────────────────────────
# Dockerfile de PRODUCCIÓN (single-service) para Railway u otro PaaS.
# Compila el frontend y lo sirve desde el backend Express en el mismo
# dominio (sin CORS). Para desarrollo local sigue usándose docker-compose.
# ─────────────────────────────────────────────────────────────────────

# ---- Stage 1: build del frontend (Vite) ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
# Mismo origen que la API -> el cliente llama a /api (sin CORS).
ENV VITE_API_URL=/api
RUN npm run build

# ---- Stage 2: backend + estáticos ----
FROM node:20-slim
# Prisma necesita openssl.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dependencias del backend (incluye la CLI de prisma para db push / generate).
COPY backend/package.json backend/package-lock.json* ./
RUN npm install

# Código del backend + cliente Prisma.
COPY backend/ ./
RUN npx prisma generate

# Frontend compilado servido por Express.
COPY --from=frontend /fe/dist ./public

# Carpeta para archivos subidos (montar un Volume de Railway aquí para
# que persistan entre despliegues).
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV STORAGE_DIR=/app/data
ENV FRONTEND_DIST=/app/public

# Railway inyecta PORT; el servidor lo respeta (config.port).
EXPOSE 4000

# Al iniciar: sincroniza el esquema, seedea (idempotente) y arranca.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js && node src/server.js"]