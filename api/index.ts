import type { Express } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";

let appPromise: Promise<Express> | null = null;
let indexesPromise: Promise<void> | null = null;

async function getServerlessApp(): Promise<Express> {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    try {
      const [{ buildApp }, { connectMongo }, { ensureMongoIndexes }] = await Promise.all([
        import("../src/app"),
        import("../src/db/mongo.client"),
        import("../src/db/mongo.indexes")
      ]);

      const db = await connectMongo();
      indexesPromise ??= ensureMongoIndexes(db);
      await indexesPromise;

      return buildApp(db);
    } catch (err) {
      appPromise = null;
      indexesPromise = null;
      throw err;
    }
  })();

  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getServerlessApp();
    app(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error("[vercel] Failed to initialize corpoturismo-logs-service", err);

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        service: "corpoturismo-logs-service",
        ok: false,
        error: {
          code: "SERVERLESS_BOOTSTRAP_FAILED",
          message
        }
      })
    );
  }
}
