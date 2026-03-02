import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "@/libs/logger/logger";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation => 400
  if (err instanceof ZodError) {
    return res.status(400).json({
      data: null,
      meta: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.issues
      }
    });
  }

  const status = typeof err?.status === "number" ? err.status : 500;

  logger.error(
    {
      status,
      message: err?.message,
      stack: err?.stack
    },
    "Unhandled error"
  );

  return res.status(status).json({
    data: null,
    meta: null,
    error: {
      code: status === 500 ? "INTERNAL_ERROR" : "ERROR",
      message: status === 500 ? "Internal server error" : err?.message ?? "Error",
      details: err?.details ?? null
    }
  });
}
