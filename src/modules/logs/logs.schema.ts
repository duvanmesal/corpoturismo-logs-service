import { z } from "zod";

export const LogLevelSchema = z.enum(["info", "warn", "error"]);

export const CreateLogSchema = z.object({
  level: LogLevelSchema,
  event: z.string().min(2).max(120),
  message: z.string().max(2000).optional(),
  service: z.string().max(120).optional(),
  requestId: z.string().max(120).optional(),

  actor: z
    .object({
      userId: z.string().max(120).optional(),
      email: z.string().email().optional(),
      role: z.string().max(80).optional()
    })
    .optional(),

  target: z
    .object({
      entity: z.string().max(80).optional(),
      id: z.string().max(120).optional(),
      email: z.string().email().optional()
    })
    .optional(),

  http: z
    .object({
      method: z.string().max(16).optional(),
      path: z.string().max(300).optional(),
      status: z.number().int().min(100).max(599).optional(),
      ip: z.string().max(80).optional(),
      userAgent: z.string().max(400).optional(),
      durationMs: z.number().int().min(0).max(60_000).optional()
    })
    .optional(),

  meta: z.record(z.any()).optional(),

  ts: z.string().datetime().optional()
});

export const CreateLogBatchSchema = z.object({
  items: z.array(CreateLogSchema).min(1).max(500)
});
