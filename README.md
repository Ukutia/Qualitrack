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
| **Redacción** | Esencial | Redactar el borrador del informe dentro de la plataforma, con formato (título, negrita, cursiva, lista), autoguardado y recuperación íntegra del contenido. |

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
- Cuentas por defecto (una por rol, ver `backend/src/config/roles.js`):
  - Administrador de calidad — **admin@qualitrack.cl / admin123** (acceso total)
  - Equipo de aseguramiento — **usuario@qualitrack.cl / usuario123** (carga, nube y revisión de *sus* documentos)
  - Ingestor de datos — **ingestor@qualitrack.cl / ingestor123** (solo carga de documentos)

## Decisiones del MVP

- **Landing pública:** `/` es la página de presentación (`frontend/src/pages/Landing.jsx`), abierta
  sin sesión. La aplicación autenticada vive bajo `/app` (tablero) y el resto de rutas protegidas
  no cambian.

- **Clasificador IA (HU01):** *mock* determinístico por palabras clave (sin llamadas externas).
  La lógica está aislada en `backend/src/services/classifier.service.js` para enchufar
  Claude/OpenAI más adelante sin tocar el resto.
- **Nube (HU09):** Google Drive real. Sin credenciales, la app funciona igual y la pantalla
  muestra instrucciones de configuración.
- **Almacenamiento:** volumen local (`backend/src/services/storage.service.js` aísla un futuro
  cambio a S3/GCS).
- **Editor del borrador (Redacción):** `contentEditable` nativo + `execCommand`, sin
  dependencias de terceros. Mantiene la selección de texto del navegador, base de la revisión
  de incoherencias y de la inserción de frases del almacén. El HTML se sanea en el servidor
  (`backend/src/services/draftSanitizer.service.js`) contra una lista blanca de etiquetas y
  sin atributos. Autoguardado a los 2 s de la última modificación (el criterio exige ≤ 5 s),
  con reintento cada 5 s si falla la red y volcado al salir de la sección.
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

### Correos de solicitudes de documentos

Al crear o reanudar una solicitud se registra un correo para la versión vigente
del token. Cada rotación registra un único recordatorio mediante la restricción
`(requestId, tokenVersion)`. Los fallos SMTP se conservan y reintentan; pausar,
cancelar, recibir o eliminar una solicitud cancela entregas pendientes. Los
registros de correo nunca almacenan el token.

En desarrollo, Docker Compose levanta Mailpit y su bandeja se abre en
`http://localhost:8025`. Para Railway con Brevo configure:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=usuario-smtp
SMTP_PASSWORD=clave-smtp
SMTP_USE_TLS=true
MAIL_FROM=remitente-verificado@dominio.cl
FRONTEND_URL=https://frontend-publico.example
REQUEST_EMAIL_RETRY_SECONDS=60
```

Railway no necesita exponer el puerto 587: es una conexión saliente desde el
backend hacia Brevo. Aplique las migraciones antes de iniciar la nueva versión.

### Red visual de evidencias (local)

Disponible en **Búsqueda temática → Red visual** (`/search?view=network`) para
administrador exclusivamente. Los usuarios normales y los ingestores no tienen acceso. El selector **Lista / Red visual** comparte
el formulario de creación y las mismas temáticas guardadas. `/network` redirige
a esta vista por compatibilidad.
Requiere la API, PostgreSQL con pgvector y el servicio local de embeddings del
Docker Compose. No necesita migraciones ni nuevas dependencias.

La creación de temáticas comprueba documentos activos del repositorio, aunque
su vectorización todavía esté procesándose o haya fallado. No depende de que
existan chunks ni de quién cargó el documento. La aparición de conexiones sí
requiere vectorización correcta. Para diagnosticar errores locales:
`docker compose logs --tail=100 backend embedding-service`.

Compose espera a que `/health` del servicio de embeddings responda antes de
arrancar el backend. Esto incluye la carga del modelo y su warm-up, no solo la
descarga de pesos. Después de un fallo previo por conexión rechazada, ejecutar
`docker compose exec backend npm run db:retry-vectorizations` para reprocesar
documentos activos con estado `FAILED`, conservando archivos y asociaciones.
Este comando necesita que el servicio esté listo; los documentos se procesan
secuencialmente. Al finalizar, actualizar la red visual.

- Muestra las temáticas del usuario y documentos activos del repositorio, con
  una conexión por pareja temática/documento si su similitud coseno es **≥ 0,60**.
  Usa el fragmento de mayor similitud del documento, como la búsqueda semántica,
  sin el límite de 50 resultados. Solo incluye documentos vectorizados (`READY`)
  y embeddings del modelo vigente.
- Las temáticas sin coincidencias permanecen visibles para identificar vacíos.
- El tamaño del nodo representa sus conexiones. Permite zoom, desplazamiento,
  selección con ratón o teclado y selección alternativa desde listas.
- El subcriterio predominante se cuenta por documentos, tomando la última
  asociación por documento/subcriterio y excluyendo las rechazadas. Incluye
  propuestas y validadas; muestra todos los subcriterios empatados.
- El lector muestra el texto extraído completo (sin el recorte de 1500 caracteres)
  y permite cambiar a cualquier documento de la red. La ficha enlazada permite
  consultar el archivo original con su formato.
- **Actualizar red** recalcula las conexiones después de cargar, clasificar,
  eliminar o restaurar documentos. El umbral se aplica en el servidor antes
  de enviar el mapa; no es un filtro cosmético del navegador.

Comprobación manual: crear temáticas con documentos vectorizados, abrir la red,
seleccionar un nodo y comparar su lista con el total de conexiones; abrir un
documento y cambiar a otro desde el lector; comprobar una temática sin resultados.
Los tests `backend/test/network.test.js` cubren el límite 60%, duplicados,
documentos compartidos, empates, permisos y contenido completo.

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
