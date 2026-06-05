import { env } from "./config/env";
import { buildApp } from "./app";
import { connectMongo, disconnectMongo } from "./db/mongo.client";
import { ensureMongoIndexes } from "./db/mongo.indexes";
import { logger } from "./libs/logger/logger";

const DEFAULT_PORT = 4010;

function resolvePort(): number {
  const rawPort = process.env.PORT;
  if (!rawPort) return DEFAULT_PORT;

  const port = Number(rawPort);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

async function bootstrap() {
  const db = await connectMongo();
  await ensureMongoIndexes(db);

  const app = buildApp(db);
  const port = resolvePort();

  const server = app.listen(port, () => {
    logger.info({ port, env: env.NODE_ENV }, "Server listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Bootstrap failed");
  process.exit(1);
});
