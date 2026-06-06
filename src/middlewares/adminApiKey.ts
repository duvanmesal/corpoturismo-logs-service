import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction) {
  if (!env.ADMIN_API_KEY) {
    res.status(503).json({
      data: null,
      meta: null,
      error: { code: "SERVICE_UNAVAILABLE", message: "Admin API key not configured", details: null }
    });
    return;
  }

  const key =
    req.header("x-api-key") ?? req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (!key || key !== env.ADMIN_API_KEY) {
    res.status(401).json({
      data: null,
      meta: null,
      error: { code: "UNAUTHORIZED", message: "Invalid or missing admin API key", details: null }
    });
    return;
  }

  next();
}
