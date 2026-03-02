# 🧾 Microservicio Global de Logs y Mailing — `corpoturismo-logs-service`

## 1. Objetivo

Centralizar en **un solo microservicio** los eventos operativos/auditables de todo el ecosistema (por ejemplo: `gestionguias-api`, `mailing-service`, futuros workers, jobs), garantizando:

* **Ingesta estructurada** de logs y eventos de mailing.
* **Consulta segura** (solo personal autorizado / soporte).
* **Retención automática** mediante TTL (limpieza sin tareas manuales).
* **Privacidad y seguridad**: redacción de campos sensibles antes de persistir.
* **Observabilidad básica**: health del servicio y conexión Mongo.

---

## 2. Alcance actual (MVP implementado)

### ✅ Implementado (colección `logs`)

* `POST /logs` (ingesta 1 evento)
* `POST /logs/batch` (ingesta masiva)
* `GET /logs` (consulta con filtros + paginación + full-text)
* `GET /logs/:id` (detalle)
* `GET /logs/stats` (métricas: por nivel, top eventos, errores por día)
* `GET /health` (Mongo ping + colecciones)

### 🟡 Preparado (colección `mails`)

* Se creó la colección + índices base (TTL y algunos campos).
* Endpoints del módulo `mails` **aún no expuestos** (fase siguiente).

---

## 3. Arquitectura general

### 3.1 Diseño por capas (clean + modular)

```
src/
  app.ts                     (express + middlewares + rutas)
  main.ts                    (bootstrap: connect mongo + indexes + listen)
  config/env.ts              (env + validación Zod)

  db/
    mongo.client.ts           (MongoClient singleton)
    mongo.indexes.ts          (índices globales: logs + mails)
    mongo.health.ts           (ping + info de colecciones)

  middlewares/
    requestContext.ts         (requestId)
    authApiKey.ts             (INGEST_API_KEY)
    readApiKey.ts             (READ_API_KEY)
    errorHandler.ts           (ZodError -> 400 + errores normalizados)

  libs/logger/
    logger.ts                 (pino consola)
    sanitize.ts               (redacción de payload)
    redaction.rules.ts        (claves sensibles)

  shared/
    asyncHandler.ts           (captura throws async -> errorHandler)

  modules/
    logs/
      logs.routes.ts
      logs.controller.ts
      logs.service.ts
      logs.repository.ts
      logs.repository.mongo.ts
      logs.schema.ts
      logs.query.schema.ts
      logs.stats.schema.ts
      logs.types.ts
```

---

## 4. Base de datos (MongoDB)

### 4.1 Base y colecciones

* **DB:** `corpoturismo_db_logs`
* **Colecciones:**

  * `logs`  ✅ (en uso)
  * `mails` 🟡 (preparada)

### 4.2 Índices obligatorios (logs)

Se crean automáticamente al iniciar (`ensureMongoIndexes`):

* TTL por `ts`
* `ts` (rango y orden)
* `level + ts`
* `event + ts`
* `requestId + ts`
* `actor.userId + ts`
* `target.entity + target.id + ts`
* text index: `message` y `meta`

### 4.3 Retención (TTL)

* `LOG_RETENTION_DAYS` (ej. 30 días)
* `MAIL_RETENTION_DAYS` (ej. 90 días)

Mongo elimina automáticamente documentos cuyo `ts` supera el TTL.

---

## 5. Variables de entorno

Ejemplo `.env`:

```env
# App
NODE_ENV=development
PORT=4010

# Mongo
MONGO_URL=mongodb://admin:root@localhost:27017/?authSource=admin
MONGO_DB=corpoturismo_db_logs

# Retención (TTL) - días
LOG_RETENTION_DAYS=30
MAIL_RETENTION_DAYS=90

# Seguridad
INGEST_API_KEY=<hex o token largo>
READ_API_KEY=<hex o token largo>

# CORS
CORS_ORIGIN=*
```

---

## 6. Seguridad (modelo actual)

### 6.1 API Keys separadas

* **INGEST_API_KEY**

  * Permite: `POST /logs`, `POST /logs/batch`
  * Pensada para servicios internos que envían eventos.

* **READ_API_KEY**

  * Permite: `GET /logs`, `GET /logs/:id`, `GET /logs/stats`
  * Pensada para UI admin/soporte o consultas autorizadas.

### 6.2 Headers soportados para API Key

Se acepta cualquiera de:

* `x-api-key: <key>`
* `Authorization: Bearer <key>`

---

## 7. Envelope estándar de respuestas

El microservicio usa un envelope consistente:

### 7.1 Éxito

```json
{
  "data": { },
  "meta": null,
  "error": null
}
```

### 7.2 Error

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR|UNAUTHORIZED|NOT_FOUND|INTERNAL_ERROR",
    "message": "string",
    "details": null
  }
}
```

### 7.3 Validación (Zod) → `400`

En validación se devuelve:

* `code = VALIDATION_ERROR`
* `details = issues[]` con paths exactos (`items[0].event`, etc.)

---

## 8. Privacidad y redacción de datos sensibles (CRUCIAL)

Antes de persistir un log, el servicio aplica sanitización profunda:

### 8.1 Campos redactados (ejemplos)

* `password`, `tempPassword`, `newPassword`, `oldPassword`
* `token`, `accessToken`, `refreshToken`
* `authorization`
* `cookie`, `set-cookie`
* `apiKey`, `x-api-key`, `secret`, `clientSecret`

### 8.2 Resultado

```json
"meta": {
  "authorization": "[REDACTED]",
  "refreshToken": "[REDACTED]"
}
```

Esto evita almacenar secretos accidentalmente (puntos más críticos del sistema).

---

# 🧩 Endpoints implementados (Logs)

## 9. Health del microservicio

### GET `/health`

Verifica:

* Conexión a Mongo
* DB activa
* Colecciones existentes

**Respuesta 200**

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

## 10. Ingesta de logs (escritura)

### 10.1 POST `/logs`

Registra un evento estructurado (1 log).

**Auth requerida:** ✅ `INGEST_API_KEY`

**Headers**

| Header         | Valor              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |
| `x-api-key`    | `INGEST_API_KEY`   |

**Body (contrato)**

```json
{
  "level": "info|warn|error",
  "event": "INVITATION_CREATED",
  "message": "Invitation created",
  "service": "gestionguias-api",
  "requestId": "uuid (opcional)",
  "actor": { "userId": "uuid", "email": "x", "role": "SUPER_ADMIN" },
  "target": { "entity": "Invitation", "id": "uuid", "email": "y" },
  "http": { "method": "POST", "path": "/invitations", "status": 201, "ip": "..." },
  "meta": { "any": "json" },
  "ts": "2026-01-24T00:00:00.000Z"
}
```

**Notas**

* `ts` es opcional, si no llega el servicio lo define `now()`.
* `requestId` se completa automáticamente con el `x-request-id` generado por el microservicio si no viene.

**Respuesta 201**

```json
{
  "data": { "id": "ObjectId" },
  "meta": null,
  "error": null
}
```

---

### 10.2 POST `/logs/batch`

Ingesta masiva para evitar spam de requests.

**Auth requerida:** ✅ `INGEST_API_KEY`

**Body**

```json
{
  "items": [
    { "level": "info", "event": "OK", "message": "m1" },
    { "level": "error", "event": "FAIL", "meta": { "password": "123" } }
  ]
}
```

**Reglas**

* `items` min 1, max 500
* Sanitización aplica a cada item.

**Respuesta 201**

```json
{
  "data": { "insertedCount": 2 },
  "meta": null,
  "error": null
}
```

---

## 11. Consulta de logs (lectura)

### 11.1 GET `/logs`

Lista logs con filtros + paginación.

**Auth requerida:** ✅ `READ_API_KEY`

**Query params (mínimos y cruciales)**

| Param         | Tipo            | Descripción                        |
| ------------- | --------------- | ---------------------------------- |
| `from`        | ISO datetime    | inicio rango (por `ts`)            |
| `to`          | ISO datetime    | fin rango                          |
| `level`       | info/warn/error | nivel                              |
| `event`       | string          | evento                             |
| `service`     | string          | nombre servicio                    |
| `actorUserId` | string          | `actor.userId`                     |
| `requestId`   | string          | correlación                        |
| `entity`      | string          | `target.entity`                    |
| `entityId`    | string          | `target.id`                        |
| `q`           | string          | full-text sobre `message` y `meta` |
| `page`        | number          | default 1                          |
| `pageSize`    | number          | default 25 (max 200)               |
| `sort`        | ts              | default ts                         |
| `order`       | asc/desc        | default desc                       |

**Respuesta 200**

```json
{
  "data": [ { "...doc" : "..." } ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 42,
    "totalPages": 5
  },
  "error": null
}
```

---

### 11.2 GET `/logs/:id`

Devuelve un documento completo por ObjectId.

**Auth requerida:** ✅ `READ_API_KEY`

**Respuesta 200**

```json
{ "data": { "...log": "..." }, "meta": null, "error": null }
```

**Errores**

* `404 NOT_FOUND` si no existe o el id no es válido.

---

## 12. Métricas de logs

### GET `/logs/stats`

Devuelve estadísticas agregadas para dashboard.

**Auth requerida:** ✅ `READ_API_KEY`

**Query params**

| Param            |         Tipo | Default | Descripción               |
| ---------------- | -----------: | ------: | ------------------------- |
| `from`           | ISO datetime |       - | rango inicio              |
| `to`             | ISO datetime |       - | rango fin                 |
| `service`        |       string |       - | filtro                    |
| `event`          |       string |       - | filtro                    |
| `actorUserId`    |       string |       - | filtro                    |
| `entity`         |       string |       - | filtro                    |
| `entityId`       |       string |       - | filtro                    |
| `q`              |       string |       - | full-text                 |
| `topEventsLimit` |       number |      10 | límite top eventos        |
| `tz`             |       string |     UTC | timezone para buckets día |

**Respuesta 200**

```json
{
  "data": {
    "byLevel": [
      { "level": "info", "count": 120 },
      { "level": "error", "count": 5 }
    ],
    "topEvents": [
      { "event": "INVITATION_CREATED", "count": 30 }
    ],
    "errorsByDay": [
      { "day": "2026-03-02", "count": 2 }
    ]
  },
  "meta": null,
  "error": null
}
```

---

# 13. Ejemplos de uso (curl)

### Crear log

```bash
curl -X POST http://localhost:4010/logs ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: <INGEST_API_KEY>" ^
  -d "{\"level\":\"info\",\"event\":\"INVITATION_CREATED\",\"message\":\"Invitation created\",\"service\":\"gestionguias-api\",\"meta\":{\"authorization\":\"Bearer ABC\",\"refreshToken\":\"XYZ\"}}"
```

### Listar logs

```bash
curl "http://localhost:4010/logs?page=1&pageSize=10&order=desc" ^
  -H "x-api-key: <READ_API_KEY>"
```

### Stats

```bash
curl "http://localhost:4010/logs/stats?tz=America/Bogota&topEventsLimit=5" ^
  -H "x-api-key: <READ_API_KEY>"
```

---

# 14. Cómo ejecutar el microservicio

## 14.1 Desarrollo

```bash
npm i
copy .env.example .env
npm run dev
```

## 14.2 Producción

```bash
npm run build
npm start
```

## 14.3 Docker (opcional)

```bash
docker compose up -d
```

---

# 15. Decisiones de diseño (por qué así)

* **MongoDB**: ideal para eventos no relacionales y voluminosos + TTL.
* **TTL index**: elimina logs sin cron jobs, reduce mantenimiento.
* **API keys separadas**: minimiza riesgo (escritura ≠ lectura).
* **Sanitización fuerte**: evita fugas de secretos (lo más crítico).
* **Full-text**: habilita búsqueda rápida tipo “soporte”.

---

# 16. Roadmap inmediato (siguiente fase)

## 16.1 Módulo `mails` (colección `mails`)

* `POST /mails`, `POST /mails/batch`
* `GET /mails`, `GET /mails/:id`, `GET /mails/stats`
* tracking: `provider`, `status`, `to`, `templateId`, latencias, errores, retries, etc.

## 16.2 Mejoras opcionales

* RBAC real (JWT + roles) en lugar de API keys.
* Rate limiting para proteger endpoints de ingesta.
* Circuit-breaker / backpressure si Mongo se degrada.
* `requestId` correlacionado end-to-end (propagación desde servicios emisores).

---

## 17. Resultado

✅ Microservicio operativo y estable
✅ Centralización real de logs del ecosistema
✅ Consulta segura + métricas para soporte
✅ Retención automática (TTL)
✅ Seguridad y privacidad aplicada desde el día 1
