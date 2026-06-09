# Qualitrack — MVP

Sistema de **gestión y análisis de evidencias** para la acreditación institucional chilena (CNA).
El MVP se acota a **una sede, hasta 3 carreras y exclusivamente el Criterio 9 de la CNA**
("Aseguramiento de la calidad de los programas formativos"), con un único usuario administrador
(Encargado de Aseguramiento de Calidad).

## Historias de usuario incluidas

| HU | Categoría | Descripción |
|----|-----------|-------------|
| **HU03** | Esencial | Cargar / ver la estructura oficial del informe CNA y versionarla (marca secciones agregadas / eliminadas / renombradas). |
| **HU07** | Esencial | Cargar evidencias (PDF/DOCX/XLSX ≤ 10 MB) con validación de formato/tamaño y manejo de duplicados. |
| **HU09** | Importante | Conectar **Google Drive** (OAuth real) para navegar e importar archivos. |
| **HU01** | Importante | Asociación de evidencia al Criterio 9 con propuesta automática, justificación, validar/descartar e historial de auditoría. |
| **HU02** | Importante | Cálculo del estado de cumplimiento por subcriterio (Suficiente / Parcial / Insuficiente). |

## Stack

- **Frontend:** React + Vite · Tailwind CSS · TanStack Query · React Router
- **Backend:** Node.js + Express · Prisma ORM · Multer · JWT
- **DB:** PostgreSQL 16
- **Infra:** Docker Compose · volumen local para archivos

## Puesta en marcha (Docker)

Requisito: **Docker Desktop**.

```bash
cp .env.example .env          # en Windows PowerShell: Copy-Item .env.example .env
docker compose up --build
```

Al iniciar, el backend sincroniza el esquema (`prisma db push`), ejecuta el *seed*
(admin + Criterio 9 + estructura del informe) y levanta la API.

- Frontend: http://localhost:5173
- API: http://localhost:4000/api
- Credenciales por defecto: **admin@qualitrack.cl / admin123**

## Decisiones del MVP

- **Clasificador IA (HU01):** *mock* determinístico por palabras clave (sin llamadas externas).
  La lógica está aislada en `backend/src/services/classifier.service.js` para enchufar
  Claude/OpenAI más adelante sin tocar el resto.
- **Nube (HU09):** Google Drive real. Sin credenciales, la app funciona igual y la pantalla
  muestra instrucciones de configuración.
- **Almacenamiento:** volumen local (`backend/src/services/storage.service.js` aísla un futuro
  cambio a S3/GCS).
- **Reglas de cumplimiento (HU02):** Suficiente = ≥2 docs validados < 3 años; Parcial = ≥1
  validado pero > 3 años, o solo 1 vigente; Insuficiente = sin validados. Cubiertas por tests.

## Configurar Google Drive (HU09, opcional)

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) cree un
   **ID de cliente de OAuth** tipo *Aplicación web*.
2. Agregue el **redirect URI**: `http://localhost:4000/api/cloud/google/callback`.
3. Habilite la **Google Drive API** en el proyecto.
4. Copie *Client ID* y *Client Secret* a `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) y
   reinicie: `docker compose up --build`.

## Tests

```bash
cd backend
npm install
npm test          # Vitest — reglas de cumplimiento (HU02)
```

## Desarrollo local sin Docker

```bash
# Requiere PostgreSQL local y DATABASE_URL apuntando a él.
cd backend  && npm install && npm run db:push && npm run db:seed && npm run dev
cd frontend && npm install && npm run dev
```

## Estructura

```
backend/   API Express + Prisma (controllers, services, routes, middleware)
frontend/  SPA React (pages, components, hooks, context)
docker-compose.yml   db + backend + frontend
```

## Notas de seguridad

- Avisos de `npm audit` en `xlsx` (SheetJS, sin parche en npm) y en `uuid` (transitivo de
  `googleapis`). En este MVP los archivos provienen solo del administrador autenticado, por lo
  que el riesgo es acotado; se recomienda fijar versiones parchadas antes de producción.
- Cambie `JWT_SECRET` y las credenciales del admin antes de cualquier despliegue real.
