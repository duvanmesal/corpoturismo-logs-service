import { MongoClient, Db } from "mongodb";
import { env } from "@/config/env";
import { logger } from "@/libs/logger/logger";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.MONGO_URL, {
    // Valores conservadores para un microservicio
    maxPoolSize: 20,
    minPoolSize: 0
  });

  await client.connect();

  db = client.db(env.MONGO_DB);

  logger.info(
    { mongoDb: env.MONGO_DB },
    "Mongo connected"
  );

  return db;
}

export function getMongoDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongo() before using getMongoDb().");
  }
  return db;
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info("Mongo disconnected");
  }
}
