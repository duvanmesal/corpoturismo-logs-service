# 🤖 AI Context — `corpoturismo-logs-service`

> Este documento existe para que una IA tenga **contexto completo** del microservicio, su arquitectura, contratos, decisiones técnicas, integración y reglas no negociables.

---

## 1) Qué es este proyecto

**`corpoturismo-logs-service`** es un microservicio Node.js/TypeScript que centraliza en MongoDB:

* **Logs de dominio / auditoría** de múltiples servicios (ej: `gestionguias-api`, `mailing-service`, futuros workers).
* **Tracking de eventos de mailing** (colección preparada, endpoints pendientes).

No depende de Postgres ni Prisma. Su almacenamiento es MongoDB y su API es HTTP (Express).

---

## 2) Problema que resuelve

Sin un servicio central, los logs quedan:

* desestructurados,
* dispersos en consola/archivos,
* sin filtros (actor/target/requestId),
* sin retención automática,
* con riesgo de almacenar secretos (tokens/passwords).

Este microservicio crea una “fuente única” de logs con:

* payload estructurado (`event`)
* sanitización
* retención TTL
* consultas filtradas
* full-text search (`q`)
* métricas (`/logs/stats`)

---

## 3) Reglas NO negociables (invariantes del sistema)

1. **Nunca guardar secretos**
   Antes de persistir, siempre aplicar sanitización profunda:

   * tokens, passwords, authorization, cookies, api keys, secrets.

2. **Separación de llaves**

   * Ingesta: `INGEST_API_KEY`
   * Lectura: `READ_API_KEY`

3. **TTL obligatorio**
   Los documentos deben tener `ts: Date` y un índice TTL por `ts`.

4. **Envelopes consistentes**
   Respuesta siempre:

   * éxito: `{ data, meta, error: null }`
   * error: `{ data: null, meta: null, error: { code, message, details } }`

5. **No usar Mongo como DB transaccional**
   Este servicio es de logs/auditoría, no para operaciones core.

---

## 4) Stack y decisiones de implementación

* Runtime: Node.js
* Framework: Express
* DB: MongoDB (Node driver nativo)
* Validación: Zod
* Logger consola: Pino (solo stdout)
* Calidad: ESLint con `typescript-eslint` type-aware + Prettier

Se usa **Mongo Node Driver** (sin Mongoose) para:

* control total de índices TTL
* queries + agregations
* performance y simplicidad

---

## 5) Configuración de entorno (ENV)

Ejemplo `.env`:

```env
NODE_ENV=development
PORT=4010

MONGO_URL=mongodb://admin:root@localhost:27017/?authSource=admin
MONGO_DB=corpoturismo_db_logs

LOG_RETENTION_DAYS=30
MAIL_RETENTION_DAYS=90

INGEST_API_KEY=<secret>
READ_API_KEY=<secret>

CORS_ORIGIN=*
```

Notas importantes:

* `MONGO_DB` por defecto es `corpoturismo_db_logs`.
* `LOG_RETENTION_DAYS` controla TTL en `logs`.
* `MAIL_RETENTION_DAYS` controla TTL en `mails`.

---

## 6) Base de datos (Mongo)

### DB

* `corpoturismo_db_logs`

### Colecciones

* `logs` (en uso)
* `mails` (preparada)

### Campo clave

* `ts` (Date) = timestamp del evento/log, esencial para TTL y rangos.

### Índices creados al iniciar

`logs`:

* TTL `{ ts: 1 }`
* `{ level: 1, ts: -1 }`
* `{ event: 1, ts: -1 }`
* `{ requestId: 1, ts: -1 }`
* `{ "actor.userId": 1, ts: -1 }`
* `{ "target.entity": 1, "target.id": 1, ts: -1 }`
* text: `{ message: "text", meta: "text" }`

`mails`:

* TTL `{ ts: 1 }`
* `{ status: 1, ts: -1 }`
* `{ provider: 1, ts: -1 }`
* `{ "to.email": 1, ts: -1 }`

---

## 7) Estructura de carpetas (y responsabilidades)

```
src/main.ts
  - conecta mongo
  - asegura índices
  - construye app con db inyectado
  - levanta server
  - shutdown SIGINT/SIGTERM

src/app.ts
  - configura express + middlewares
  - monta rutas (/health, /logs)
  - 404 + error handler

src/config/env.ts
  - valida env con Zod
  - expone env tipado

src/db/mongo.client.ts
  - connectMongo()
  - disconnectMongo()
  - (puede existir getMongoDb, pero patrón recomendado es inyectar db)

src/db/mongo.indexes.ts
  - ensureMongoIndexes(db) crea TTL + indexes

src/db/mongo.health.ts
  - mongoHealth(db) ping + listCollections

src/middlewares
  - requestContext: genera x-request-id
  - authApiKey: protege write con INGEST_API_KEY
  - readApiKey: protege read con READ_API_KEY
  - errorHandler: captura ZodError y otros

src/libs/logger
  - sanitize: redacta payload antes de guardar
  - redaction.rules: lista de keys sensibles
  - logger: pino interno stdout

src/shared/asyncHandler.ts
  - wrapper para async routes, evitando crashes

src/modules/logs/*
  - módulo principal: ingest/query/stats
```

---

## 8) Seguridad: cómo autentica este servicio

### Headers soportados

* `x-api-key: <key>`
* o `Authorization: Bearer <key>`

### Ingesta (write)

Endpoints protegidos por `INGEST_API_KEY`:

* `POST /logs`
* `POST /logs/batch`

### Lectura (read)

Endpoints protegidos por `READ_API_KEY`:

* `GET /logs`
* `GET /logs/:id`
* `GET /logs/stats`

---

## 9) Contrato de Logs (modelo)

### Log document (conceptual)

```json
{
  "level": "info|warn|error",
  "event": "SOME_EVENT_NAME",
  "message": "string",
  "service": "gestionguias-api|mailing-service|worker-x",
  "requestId": "uuid",
  "actor": { "userId": "uuid", "email": "x", "role": "SUPER_ADMIN" },
  "target": { "entity": "Invitation", "id": "uuid", "email": "y" },
  "http": { "method": "POST", "path": "/invitations", "status": 201, "ip": "...", "durationMs": 123 },
  "meta": { "any": "json" },
  "ts": "Date"
}
```

Reglas:

* `event` mínimo 2 caracteres.
* `ts` si no viene, se asigna `now`.

---

## 10) Sanitización (cómo funciona)

Se redactan keys sensibles si aparecen:

* en `meta`
* en nested objects
* en `headers` o cualquier campo

Ejemplo:

* `authorization` -> `[REDACTED]`
* `refreshToken` -> `[REDACTED]`

Esto aplica SIEMPRE antes de persistir en Mongo.

---

## 11) Endpoints actuales (logs)

### Health

* `GET /` -> ok simple
* `GET /health` -> ping mongo + colecciones

### Ingesta (write)

* `POST /logs`
* `POST /logs/batch` (`items[]` min1 max500)

### Lectura (read)

* `GET /logs`

  * filtros: `from`, `to`, `level`, `event`, `service`, `actorUserId`, `requestId`, `entity`, `entityId`, `q`
  * paginación: `page`, `pageSize`
  * sort: `ts` + `order`
* `GET /logs/:id`

### Stats

* `GET /logs/stats`

  * retorna:

    * `byLevel` (group by level)
    * `topEvents` (limit configurable)
    * `errorsByDay` (bucket por día, tz configurable)

---

## 12) Uso de `/logs` (query y paginación)

`GET /logs` retorna:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "pageSize": 25, "total": 100, "totalPages": 4 },
  "error": null
}
```

`q` usa `$text` con índice text sobre `message` y `meta`.

---

## 13) Cómo integrar desde otros servicios (recomendación)

### 13.1 Principio: log client reusable

Cada servicio emisor debería tener un “log client” que:

* setea `service` fijo (ej: `gestionguias-api`)
* propaga `requestId` (si existe)
* agrega `actor` y `target` cuando sea posible
* manda `POST /logs` con `INGEST_API_KEY`

### 13.2 RequestId recomendado

* Cada request en servicios emisores debería generar o reutilizar un `x-request-id`.
* Debe propagarse hasta este microservicio para correlación.

---

## 14) Convención de nombres de eventos (`event`)

Objetivo: que sea filtrable y consistente.

### Reglas

* UPPER_SNAKE_CASE
* Describe acción de dominio o evento técnico
* Sin espacios

### Ejemplos recomendados (gestionguias-api)

Auth:

* `AUTH_LOGIN_SUCCESS`
* `AUTH_LOGIN_FAILED`
* `AUTH_REFRESH_SUCCESS`
* `AUTH_REFRESH_FAILED`
* `AUTH_LOGOUT`

Invitaciones:

* `INVITATION_CREATED`
* `INVITATION_RESENT`
* `INVITATION_ACCEPTED`
* `INVITATION_CANCELED`

Usuarios:

* `USER_CREATED`
* `USER_UPDATED`
* `USER_DISABLED`
* `ROLE_CHANGED`

Recaladas:

* `RECALADA_CREATED`
* `RECALADA_UPDATED`
* `RECALADA_CANCELED`

Atenciones:

* `ATENCION_CREATED`
* `ATENCION_UPDATED`
* `ATENCION_CANCELED`
* `ATENCION_CLOSED`

Turnos:

* `TURNO_CLAIMED`
* `TURNO_ASSIGNED`
* `TURNO_UNASSIGNED`
* `TURNO_CHECKIN`
* `TURNO_CHECKOUT`
* `TURNO_NO_SHOW`

Errores:

* `HTTP_4XX`
* `HTTP_5XX`
* `DB_ERROR`
* `UNHANDLED_EXCEPTION`

Mailing:

* `MAIL_QUEUED`
* `MAIL_SENT`
* `MAIL_FAILED`
* `MAIL_BOUNCED`

---

## 15) Recomendación de payload por tipo de evento

### 15.1 Evento de negocio típico

```json
{
  "level": "info",
  "event": "INVITATION_CREATED",
  "service": "gestionguias-api",
  "message": "Invitation created by admin",
  "requestId": "uuid",
  "actor": { "userId": "uuid", "email": "admin@x.com", "role": "SUPER_ADMIN" },
  "target": { "entity": "Invitation", "id": "uuid", "email": "guest@y.com" },
  "http": { "method": "POST", "path": "/invitations", "status": 201 },
  "meta": { "invitationType": "EMAIL", "expiresInHours": 48 }
}
```

### 15.2 Error técnico

```json
{
  "level": "error",
  "event": "DB_ERROR",
  "service": "gestionguias-api",
  "message": "Prisma query failed",
  "requestId": "uuid",
  "meta": {
    "operation": "create",
    "model": "Invitation",
    "errorCode": "P2002"
  }
}
```

### 15.3 Mobile batch (offline logs)

```json
{
  "items": [
    { "level": "info", "event": "MOBILE_SYNC_START", "service": "mobile-app", "ts": "..." },
    { "level": "error", "event": "MOBILE_SYNC_FAILED", "service": "mobile-app", "meta": { "reason": "timeout" }, "ts": "..." }
  ]
}
```

---

## 16) Observabilidad del microservicio

* `GET /health` es el “health check” principal.
* Pino escribe logs internos de arranque y errores.

No hay métricas Prometheus aún (futuro).

---

## 17) Errores típicos y solución

### 17.1 `UNAUTHORIZED` al consultar logs

Causa: se usó `INGEST_API_KEY` en endpoints read.
Solución: usar `READ_API_KEY`.

### 17.2 `VALIDATION_ERROR` en batch

Causa: algún `event` no cumple `min(2)` u otros constraints.
Solución: ajustar payload.

### 17.3 `Mongo authSource`

Si Mongo tiene usuario admin:
usar `?authSource=admin` en URI.

---

## 18) Cómo correr el servicio

Dev:

```bash
npm i
copy .env.example .env
npm run dev
```

Endpoints:

* `http://localhost:4010/`
* `http://localhost:4010/health`

---

## 19) Roadmap esperado (próximo)

### Módulo `mails` (pendiente)

Implementar:

* `POST /mails` + batch
* `GET /mails` + filters
* `GET /mails/:id`
* `GET /mails/stats`

Campos esperados en mails (orientativo):

* `provider` (sendgrid/mailgun/ses)
* `status` (queued/sent/failed/bounced)
* `to` `{ email, name? }`
* `subject`, `templateId`
* `messageId`
* `latencyMs`, `attempt`, `error`
* `meta`
* `ts`

---

## 20) Guía para IA: qué NO asumir

* No asumir que existe RBAC por JWT. Actualmente es API-key.
* No asumir que `mails` endpoints existen. Solo está la colección e índices.
* No asumir Docker obligatorio. Puede correr con Mongo local.
* No asumir que `meta` tiene shape fijo: es `Record<string, unknown>`.

---

## 21) “Definition of Done” de cambios futuros (criterios)

Para cualquier endpoint nuevo:

* Validación Zod (body/query/params)
* `asyncHandler` para no crashear
* Sanitización si se guarda payload de terceros
* Documentación en `docs/`
* Índices Mongo si se agrega un patrón de query nuevo
* Mantener envelope `{ data, meta, error }`

---
