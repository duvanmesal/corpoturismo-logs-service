# 📦 Microservicio Global de Logs y Mailing — `corpoturismo-logs-service`

## 0. Resumen ejecutivo

Este microservicio centraliza en MongoDB:

* **Logs operativos/auditables** de cualquier servicio del ecosistema.
* **Tracking/auditoría de eventos de mailing** (colección preparada).

Objetivo principal: permitir trazabilidad y soporte con:

* Ingesta segura (API Key)
* Consulta segura (API Key distinta)
* Retención automática (TTL)
* Sanitización (redacción de secretos)
* Consultas filtradas + métricas (`/logs/stats`)

---

## 1. Motivación y problema que resuelve

En sistemas multi-módulo (API principal, mailing, workers, mobile sync, etc.) los logs se dispersan:

* consola local
* archivos
* DB transaccional (mala idea)
* logs sin estructura (difícil filtrar)

Este microservicio introduce un **“Event Log” centralizado** con:

* payload estructurado (campo `event`)
* filtros (actor, entidad afectada, requestId, rango fechas)
* full-text search (`q`)
* dashboards básicos (`stats`)
* retención automática sin cron jobs

---

## 2. Alcance actual (MVP)

### ✅ Implementado (módulo logs)

* Health global del servicio: `GET /health`
* Logs:

  * `POST /logs`
  * `POST /logs/batch`
  * `GET /logs`
  * `GET /logs/:id`
  * `GET /logs/stats`

### 🟡 Preparado pero NO implementado aún (módulo mails)

* Colección `mails` creada automáticamente
* Índices base creados automáticamente (TTL + campos relevantes)
* Endpoints del módulo `mails`: pendientes

---

## 3. Stack técnico

* **Node.js** (dev con `ts-node`)
* **TypeScript**
* **Express**
* **MongoDB Node Driver** (sin Mongoose, control total)
* **Zod** (validación de env + payloads)
* **Pino** (logger interno a consola, no persiste)
* **ESLint (typescript-eslint type-aware)**
* **Prettier**

---

## 4. Estructura de carpetas y responsabilidad

```
src/
  main.ts                     # Bootstrap: conecta Mongo, asegura índices, levanta server
  app.ts                      # Config express: middlewares + rutas
  config/
    env.ts                    # Validación de variables de entorno (Zod)
  db/
    mongo.client.ts           # Conexión Mongo (MongoClient singleton)
    mongo.indexes.ts          # Creación automática de índices (logs + mails)
    mongo.health.ts           # Ping + info de colecciones
  middlewares/
    requestContext.ts         # Genera/propaga x-request-id
    authApiKey.ts             # Protege endpoints de ingesta (INGEST_API_KEY)
    readApiKey.ts             # Protege endpoints de lectura (READ_API_KEY)
    errorHandler.ts           # Normaliza errores + ZodError -> 400
  libs/
    logger/
      logger.ts               # Pino internal logger (stdout)
      sanitize.ts             # Sanitiza payload antes de guardar
      redaction.rules.ts      # Lista keys sensibles a redacción
  shared/
    asyncHandler.ts           # Wrapper para handlers async (catch -> next)
  modules/
    logs/
      logs.routes.ts          # Define endpoints /logs
      logs.controller.ts      # Valida y responde
      logs.service.ts         # Lógica: ingest/query/stats
      logs.repository.ts      # Interface + tipos query/stats
      logs.repository.mongo.ts# Implementación Mongo
      logs.schema.ts          # Zod schemas para ingesta
      logs.query.schema.ts    # Zod schema query /logs
      logs.stats.schema.ts    # Zod schema query /logs/stats
      logs.types.ts           # Tipos TS
```

---

## 5. Configuración (ENV)

### 5.1 `.env.example` (plantilla)

```env
NODE_ENV=development
PORT=4010

MONGO_URL=mongodb://admin:root@localhost:27017/?authSource=admin
MONGO_DB=corpoturismo_db_logs

LOG_RETENTION_DAYS=30
MAIL_RETENTION_DAYS=90

INGEST_API_KEY=change_me_ingest
READ_API_KEY=change_me_read

CORS_ORIGIN=*
```

### 5.2 Variables y significado

| Variable              | Descripción                                |
| --------------------- | ------------------------------------------ |
| `NODE_ENV`            | `development` / `test` / `production`      |
| `PORT`                | puerto del servicio                        |
| `MONGO_URL`           | string de conexión Mongo                   |
| `MONGO_DB`            | nombre DB (default `corpoturismo_db_logs`) |
| `LOG_RETENTION_DAYS`  | TTL logs en días                           |
| `MAIL_RETENTION_DAYS` | TTL mails en días                          |
| `INGEST_API_KEY`      | key para POST /logs y /logs/batch          |
| `READ_API_KEY`        | key para GET /logs, /logs/:id, /logs/stats |
| `CORS_ORIGIN`         | CORS permitido                             |

---

## 6. Base de datos: MongoDB

### 6.1 DB y colecciones

* DB: `corpoturismo_db_logs`
* Colecciones:

  * `logs`
  * `mails`

### 6.2 Campo de tiempo obligatorio

**`ts` (Date)** se usa para:

* TTL index
* Orden por fecha
* Rango `from/to`
* Stats por día

Si el cliente no manda `ts`, el server lo asigna con `new Date()`.

### 6.3 Índices creados automáticamente

#### `logs`

* TTL:

  * `{ ts: 1 }` con `expireAfterSeconds = LOG_RETENTION_DAYS * 86400`
* query performance:

  * `{ level: 1, ts: -1 }`
  * `{ event: 1, ts: -1 }`
  * `{ requestId: 1, ts: -1 }`
  * `{ "actor.userId": 1, ts: -1 }`
  * `{ "target.entity": 1, "target.id": 1, ts: -1 }`
* full-text:

  * `{ message: "text", meta: "text" }`

#### `mails`

* TTL:

  * `{ ts: 1 }` con `expireAfterSeconds = MAIL_RETENTION_DAYS * 86400`
* query performance:

  * `{ status: 1, ts: -1 }`
  * `{ provider: 1, ts: -1 }`
  * `{ "to.email": 1, ts: -1 }`

---

## 7. Seguridad

### 7.1 Modelo actual: API Keys separadas

* **Ingesta (write)**: `INGEST_API_KEY`
* **Lectura (read)**: `READ_API_KEY`

### 7.2 Headers válidos

El microservicio acepta la key por:

* `x-api-key: <key>`
* `Authorization: Bearer <key>`

### 7.3 Por qué separar keys

* Minimiza riesgo: un servicio que solo envía logs no debería poder leerlos.
* Permite dar acceso a soporte/UI sin habilitar escritura.

---

## 8. Sanitización y privacidad (CRÍTICO)

Antes de guardar un documento, se aplica `sanitizeLogPayload` (profundo).

### 8.1 Claves sensibles redactadas (parcial)

* password/tempPassword/newPassword/oldPassword
* token/accessToken/refreshToken
* authorization
* cookie/cookies/set-cookie
* apiKey/x-api-key/secret/clientSecret

### 8.2 Valor de redacción

`[REDACTED]`

### 8.3 Resultado esperado

Si el cliente manda:

```json
"meta": { "authorization": "Bearer XXX", "refreshToken": "YYY" }
```

Se guarda:

```json
"meta": { "authorization": "[REDACTED]", "refreshToken": "[REDACTED]" }
```

---

## 9. Envelope de respuestas (contrato)

### 9.1 Respuesta éxito

```json
{ "data": ..., "meta": ..., "error": null }
```

### 9.2 Respuesta error

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR|UNAUTHORIZED|NOT_FOUND|INTERNAL_ERROR",
    "message": "string",
    "details": any
  }
}
```

### 9.3 Validación (Zod)

Cuando Zod falla, el error handler devuelve:

* `400`
* `code: VALIDATION_ERROR`
* `details: issues[]`

---

# ✅ Endpoints (Logs)

## 10. Health

### GET `/`

**Respuesta**

```json
{ "service": "corpoturismo-logs-service", "ok": true }
```

### GET `/health`

**Descripción**

* Mongo ping
* lista colecciones

**Respuesta**

```json
{
  "service": "corpoturismo-logs-service",
  "ok": true,
  "ping": { "ok": 1 },
  "db": "corpoturismo_db_logs",
  "collections": ["mails", "logs"]
}
```

---

## 11. Ingesta de logs (write)

### 11.1 POST `/logs`

**Auth:** `INGEST_API_KEY`

**Body schema**

```json
{
  "level": "info|warn|error",
  "event": "string (2..120)",
  "message": "string (<=2000)",
  "service": "string (<=120)",
  "requestId": "string",
  "actor": { "userId": "string", "email": "email", "role": "string" },
  "target": { "entity": "string", "id": "string", "email": "email" },
  "http": {
    "method": "string",
    "path": "string",
    "status": 100..599,
    "ip": "string",
    "userAgent": "string",
    "durationMs": 0..60000
  },
  "meta": { "any": "json" },
  "ts": "ISO datetime"
}
```

**Reglas**

* `event` mínimo 2 caracteres.
* `ts` opcional: si no viene, se usa `now`.
* `requestId` opcional: si no viene, se usa el `x-request-id` del microservicio.

**Respuesta 201**

```json
{ "data": { "id": "ObjectId" }, "meta": null, "error": null }
```

---

### 11.2 POST `/logs/batch`

**Auth:** `INGEST_API_KEY`

**Body**

```json
{ "items": [ <CreateLogSchema> ] }
```

**Reglas**

* `items` min 1, max 500
* sanitización item por item

**Respuesta 201**

```json
{ "data": { "insertedCount": 2 }, "meta": null, "error": null }
```

---

## 12. Lectura de logs (read)

### 12.1 GET `/logs`

**Auth:** `READ_API_KEY`

**Query params**

| Param         | Tipo            | Default | Descripción                        |
| ------------- | --------------- | ------: | ---------------------------------- |
| `from`        | ISO datetime    |       - | rango inicio (`ts >= from`)        |
| `to`          | ISO datetime    |       - | rango fin (`ts <= to`)             |
| `level`       | info/warn/error |       - | nivel                              |
| `event`       | string          |       - | evento                             |
| `service`     | string          |       - | servicio                           |
| `actorUserId` | string          |       - | `actor.userId`                     |
| `requestId`   | string          |       - | correlación                        |
| `entity`      | string          |       - | `target.entity`                    |
| `entityId`    | string          |       - | `target.id`                        |
| `q`           | string          |       - | full-text sobre `message` y `meta` |
| `page`        | number          |       1 | paginación                         |
| `pageSize`    | number          |      25 | max 200                            |
| `sort`        | ts              |      ts | campo sort                         |
| `order`       | asc/desc        |    desc | orden                              |

**Respuesta 200**

```json
{
  "data": [ { "...logDoc": "..." } ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 },
  "error": null
}
```

---

### 12.2 GET `/logs/:id`

**Auth:** `READ_API_KEY`

**Respuesta 200**

```json
{ "data": { "...logDoc": "..." }, "meta": null, "error": null }
```

**Errores**

* `404` si no existe o si `id` no es ObjectId válido.

---

## 13. Stats (dashboard)

### GET `/logs/stats`

**Auth:** `READ_API_KEY`

**Query params**

| Param            | Tipo   | Default | Uso                   |
| ---------------- | ------ | ------: | --------------------- |
| `from`           | ISO    |       - | rango                 |
| `to`             | ISO    |       - | rango                 |
| `level`          | enum   |       - | filtro                |
| `event`          | string |       - | filtro                |
| `service`        | string |       - | filtro                |
| `actorUserId`    | string |       - | filtro                |
| `requestId`      | string |       - | filtro                |
| `entity`         | string |       - | filtro                |
| `entityId`       | string |       - | filtro                |
| `q`              | string |       - | full-text             |
| `topEventsLimit` | number |      10 | top eventos           |
| `tz`             | string |     UTC | timezone para buckets |

**Respuesta 200**

```json
{
  "data": {
    "byLevel": [{ "level": "info", "count": 10 }],
    "topEvents": [{ "event": "INVITATION_CREATED", "count": 5 }],
    "errorsByDay": [{ "day": "2026-03-02", "count": 2 }]
  },
  "meta": null,
  "error": null
}
```

**Notas de implementación**

* `errorsByDay` siempre filtra `level = "error"` internamente
* `day` se calcula con `$dateToString` usando `tz`

---

# 14. Integración desde otros servicios (cómo “hablar” con este microservicio)

## 14.1 Recomendación: wrapper HTTP “logger client”

Los servicios emisores deberían tener un pequeño cliente:

* agrega `service` fijo
* agrega `requestId` del contexto (si existe)
* agrega `actor` si hay usuario autenticado
* llama `POST /logs` con `INGEST_API_KEY`

### 14.2 Payload mínimo recomendado

```json
{
  "level": "info",
  "event": "INVITATION_CREATED",
  "message": "Invitation created by admin",
  "service": "gestionguias-api",
  "requestId": "uuid",
  "actor": { "userId": "uuid", "email": "x", "role": "SUPER_ADMIN" },
  "target": { "entity": "Invitation", "id": "uuid", "email": "y" },
  "http": { "method": "POST", "path": "/invitations", "status": 201 },
  "meta": { "any": "json" }
}
```

---

# 15. Ejemplos (curl)

### POST /logs

```bash
curl -X POST http://localhost:4010/logs ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: <INGEST_API_KEY>" ^
  -d "{\"level\":\"info\",\"event\":\"INVITATION_CREATED\",\"message\":\"Invitation created\",\"service\":\"gestionguias-api\",\"meta\":{\"authorization\":\"Bearer ABC\",\"refreshToken\":\"XYZ\"}}"
```

### GET /logs

```bash
curl "http://localhost:4010/logs?page=1&pageSize=10&order=desc" ^
  -H "x-api-key: <READ_API_KEY>"
```

### GET /logs/stats

```bash
curl "http://localhost:4010/logs/stats?tz=America/Bogota&topEventsLimit=5" ^
  -H "x-api-key: <READ_API_KEY>"
```

---

# 16. Cómo correr el microservicio

## 16.1 Dev

```bash
npm i
copy .env.example .env
npm run dev
```

## 16.2 Build/Prod

```bash
npm run build
npm start
```

## 16.3 Docker (opcional)

```bash
docker compose up -d
```

---

# 17. Errores comunes y diagnóstico

## 17.1 `UNAUTHORIZED` en `GET /logs`

Causa: usaste `INGEST_API_KEY` para leer.
Solución: usar `READ_API_KEY`.

## 17.2 `MongoDB not connected`

Causa: se intentó usar `db` antes de `connectMongo`.
Solución: inyección de `db` en routers o construir app después de conectar (ya corregido).

## 17.3 ZodError tumba el proceso

Causa: throws en async no capturados.
Solución: `asyncHandler` + `errorHandler` con `ZodError` (ya corregido).

---

# 18. Decisiones clave (por qué este diseño)

* **Mongo Driver nativo**: control, menos magia, menos dependencias.
* **TTL index**: retención automática sin cron.
* **Sanitize first**: privacidad antes que “feature”.
* **Write/Read keys separadas**: principio de mínimo privilegio.
* **Text index**: soporte real (busquedas rápidas en incidentes).
* **Stats**: dashboard mínimo sin ELK/OpenSearch.

---

# 19. Roadmap (siguiente fase)

## 19.1 Mails module (colección `mails`)

Implementar:

* `POST /mails`, `POST /mails/batch`
* `GET /mails`, `GET /mails/:id`, `GET /mails/stats`
* campos sugeridos:

  * `provider`, `status`, `to`, `subject`, `templateId`, `error`, `latencyMs`, `attempt`, `messageId`

## 19.2 Seguridad futura (opcional)

* Reemplazar API keys por JWT + RBAC (`SUPER_ADMIN`, `SUPERVISOR`, etc.)
* Allowlist por servicio (cada servicio con su key propia)

---

# 20. Contratos finales (copy/paste rápido)

## 20.1 Headers

* Ingest:

  * `x-api-key: INGEST_API_KEY`
* Read:

  * `x-api-key: READ_API_KEY`

## 20.2 Colecciones

* `logs`: eventos operativos centralizados
* `mails`: auditoría mailing (fase siguiente)

---
