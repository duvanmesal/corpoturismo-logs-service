import { Router } from "express";
import type { Db } from "mongodb";
import { requireAdminApiKey } from "../../middlewares/adminApiKey";
import { requireReadApiKey } from "../../middlewares/readApiKey";
import { MongoAlertRulesRepository } from "./alert-rules.repository.mongo";
import { AlertRulesService } from "./alert-rules.service";
import { AlertRulesController } from "./alert-rules.controller";
import { asyncHandler } from "../../shared/asyncHandler";

export function buildAlertRulesRouter(db: Db): Router {
  const router = Router();

  const repo = new MongoAlertRulesRepository(db);
  const service = new AlertRulesService(repo, db);
  const controller = new AlertRulesController(service);

  // Read — requires READ key (SUPERVISOR level in gestionguias-api)
  router.get("/rules", requireReadApiKey, asyncHandler(controller.list));
  router.get("/rules/:id", requireReadApiKey, asyncHandler(controller.getById));
  router.get("/evaluate", requireReadApiKey, asyncHandler(controller.evaluate));

  // Mutations — requires ADMIN key (SUPER_ADMIN level in gestionguias-api)
  router.post("/rules", requireAdminApiKey, asyncHandler(controller.create));
  router.patch("/rules/:id", requireAdminApiKey, asyncHandler(controller.update));
  router.delete("/rules/:id", requireAdminApiKey, asyncHandler(controller.delete));

  return router;
}
