# Qualitrack — MVP

Sistema de **gestión y análisis de evidencias** para la acreditación institucional chilena (CNA).
El MVP se acota a **una sede, hasta 3 carreras y exclusivamente el Criterio 9 de la CNA**
("Gestión y resultados del aseguramiento interno de la calidad"), con un único usuario administrador
(Encargado de Aseguramiento de Calidad).

El criterio se evalúa en **tres niveles acumulativos**, tal como los define la matriz de la CNA:

| Nivel | Alcance | Subcriterios |
|-------|---------|--------------|
| **1 — Cumplimiento obligatorio** | Piso mínimo para acreditar | 9.1.1 Institucionalidad de la calidad · 9.1.2 Monitoreo del desempeño · 9.1.3 Transparencia y acceso a la información |
| **2 — Acreditación avanzada** | Requiere todo el Nivel 1 | 9.2.1 Formalización de mecanismos e indicadores · 9.2.2 Instalación de una cultura de calidad transversal |
| **3 — Excelencia** | Requiere los niveles 1 y 2 | 9.3.1 Autorregulación autónoma y madurez del sistema · 9.3.2 Compromiso y coherencia estamental total |

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
(admin + Criterio 9 con sus tres niveles + estructura del informe) y levanta la API.

> **Actualización de la matriz de criterios.** Si la base ya existía con la matriz anterior
> (subcriterios `9.1`–`9.5`), tras `db push` + `db:seed` conviven con los nuevos. El seed
> elimina automáticamente los obsoletos **sin asociaciones**; los que aún tienen evidencias
> asociadas se conservan y se avisa por consola. Para eliminarlos junto con sus asociaciones
> e historial:
>
> ```bash
> PRUNE_OBSOLETE_SUBCRITERIA=true npm run db:seed
> ```

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
