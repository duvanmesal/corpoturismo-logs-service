import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";

export function requireReadApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (!key || key !== env.READ_API_KEY) {
    return res.status(401).json({
      data: null,
      meta: null,
      error: { code: "UNAUTHORIZED", message: "Invalid or missing READ API key", details: null }
    });
  }

  next();
}
