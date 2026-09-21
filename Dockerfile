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
RUN apt-get update -y && apt-get install -y openssl ca-certificates curl     && rm -rf /var/lib/apt/lists/*

# Tailscale: el backend necesita alcanzar al worker de analisis, que corre en
# una maquina domestica sin IP publica. Se usan los binarios estaticos porque
# el repositorio apt de Tailscale trae systemd, que aqui no existe.
ARG TAILSCALE_VERSION=1.90.2
RUN ARCH=$(dpkg --print-architecture)     && case "$ARCH" in amd64) TS_ARCH=amd64 ;; arm64) TS_ARCH=arm64 ;; *) echo "arquitectura no soportada: $ARCH" && exit 1 ;; esac     && curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_${TS_ARCH}.tgz" -o /tmp/ts.tgz     && tar -xzf /tmp/ts.tgz -C /tmp     && mv "/tmp/tailscale_${TAILSCALE_VERSION}_${TS_ARCH}/tailscale" /usr/local/bin/     && mv "/tmp/tailscale_${TAILSCALE_VERSION}_${TS_ARCH}/tailscaled" /usr/local/bin/     && rm -rf /tmp/ts.tgz "/tmp/tailscale_${TAILSCALE_VERSION}_${TS_ARCH}"     && mkdir -p /var/run/tailscale /var/lib/tailscale

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

# Al iniciar: conecta la tailnet (si hay TS_AUTHKEY), migra, seedea y arranca.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
CMD ["/usr/local/bin/docker-entrypoint.sh"]