import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import type { Db } from "mongodb";
import { env } from "@/config/env";
import { requestContext } from "@/middlewares/requestContext";
import { errorHandler } from "@/middlewares/errorHandler";
import { healthRouter } from "@/routes/health.routes";
import { buildLogsRouter } from "@/modules/logs/logs.routes";

export function buildApp(db: Db) {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());
  app.use(compression());

  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);

  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      skip: () => env.NODE_ENV === "test"
    })
  );

  app.get("/", (_req, res) => {
    res.status(200).json({ service: "corpoturismo-logs-service", ok: true });
  });

  app.use(healthRouter);

  app.use("/logs", buildLogsRouter(db));

  // 404
  app.use((_req, res) => {
    res.status(404).json({
      data: null,
      meta: null,
      error: { code: "NOT_FOUND", message: "Route not found", details: null }
    });
  });

  app.use(errorHandler);

  return app;
}
