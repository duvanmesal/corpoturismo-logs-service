import { NextFunction, Request, Response } from "express";
import crypto from "crypto";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim() ? incoming.trim() : crypto.randomUUID();

  (req as any).requestId = requestId;

  res.setHeader("x-request-id", requestId);

  next();
}
