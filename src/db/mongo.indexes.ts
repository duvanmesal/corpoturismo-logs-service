import { Db } from "mongodb";
import { env } from "@/config/env";
import { logger } from "@/libs/logger/logger";

export async function ensureMongoIndexes(db: Db): Promise<void> {
  const logs = db.collection("logs");
  const mails = db.collection("mails");

  // TTL en logs (por campo ts)
  await logs.createIndex({ ts: 1 }, { expireAfterSeconds: env.LOG_RETENTION_DAYS * 86400 });
  await logs.createIndex({ level: 1, ts: -1 });
  await logs.createIndex({ event: 1, ts: -1 });
  await logs.createIndex({ requestId: 1, ts: -1 });
  await logs.createIndex({ "actor.userId": 1, ts: -1 });
  await logs.createIndex({ "target.entity": 1, "target.id": 1, ts: -1 });
  // (opcional) text index para q full-text
  await logs.createIndex({ message: "text", "meta": "text" });

  // TTL en mails (por campo ts)
  await mails.createIndex({ ts: 1 }, { expireAfterSeconds: env.MAIL_RETENTION_DAYS * 86400 });
  await mails.createIndex({ status: 1, ts: -1 });
  await mails.createIndex({ provider: 1, ts: -1 });
  await mails.createIndex({ "to.email": 1, ts: -1 });

  logger.info("Mongo indexes ensured (logs, mails)");
}
