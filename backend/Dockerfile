FROM node:20-slim

# Prisma necesita openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias (capa cacheada)
COPY package.json package-lock.json* ./
RUN npm install

# Copiar el resto del código y generar el cliente Prisma
COPY . .
RUN npx prisma generate

# Carpeta para los archivos subidos (volumen montado en runtime)
RUN mkdir -p /app/data

EXPOSE 4000

# Al iniciar: regenerar el cliente (por si el volumen de node_modules quedó
# desactualizado respecto al schema.prisma montado desde el host), sincronizar
# el esquema (db push), seedear y levantar el servidor.
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && node prisma/seed.js && node --watch src/server.js"]
