FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Servidor de desarrollo de Vite (MVP). El proxy /api -> backend se
# configura en vite.config.js usando VITE_API_PROXY_TARGET.
CMD ["npm", "run", "dev"]
