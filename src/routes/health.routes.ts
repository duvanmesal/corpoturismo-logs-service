import { Router } from "express";
import { getMongoDb } from "@/db/mongo.client";
import { mongoHealth } from "@/db/mongo.health";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const db = getMongoDb();
  const health = await mongoHealth(db);

  res.status(health.ok ? 200 : 503).json({
    service: "corpoturismo-logs-service",
    ok: health.ok,
    ...health.details
  });
});
