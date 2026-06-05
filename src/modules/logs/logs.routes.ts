import { Router } from "express";
import type { Db } from "mongodb";
import { requireIngestApiKey } from "../../middlewares/authApiKey";
import { requireReadApiKey } from "../../middlewares/readApiKey";
import { MongoLogsRepository } from "./logs.repository.mongo";
import { LogsService } from "./logs.service";
import { LogsController } from "./logs.controller";
import { asyncHandler } from "../../shared/asyncHandler";

export function buildLogsRouter(db: Db): Router {
  const router = Router();

  const repo = new MongoLogsRepository(db);
  const service = new LogsService(repo);
  const controller = new LogsController(service);

  // Ingest (write)
  router.post("/", requireIngestApiKey, asyncHandler(controller.create));
  router.post("/batch", requireIngestApiKey, asyncHandler(controller.batch));

  // Query (read)
  router.get("/", requireReadApiKey, asyncHandler(controller.list));
  router.get("/stats", requireReadApiKey, asyncHandler(controller.stats));
  router.get("/:id", requireReadApiKey, asyncHandler(controller.getById));

  return router;
}
