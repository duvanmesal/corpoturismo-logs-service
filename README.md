# corpoturismo-logs-service

Microservicio global para centralizar:
- Logs de dominio (colección `logs`)
- Tracking / auditoría de mailing (colección `mails`)

DB Mongo: `corpoturismo_db_logs`

## Requisitos
- Node.js 20+
- MongoDB (local o Docker)

## Configuración
1. Copia el archivo de entorno:
   - `cp .env.example .env` (en Windows: copia manual)

2. Ajusta `MONGO_URL`, `MONGO_DB`, API keys, etc.

## Scripts
- `npm run dev`        => ejecutar en modo dev
- `npm run dev:watch`  => dev con nodemon
- `npm run build`      => compilar a dist/
- `npm start`          => ejecutar dist/
- `npm run lint`       => eslint
- `npm run format`     => prettier

## Docker (opcional)
- `docker compose up -d`

> En desarrollo puedes usar Mongo local y solo dockerizar el servicio.
