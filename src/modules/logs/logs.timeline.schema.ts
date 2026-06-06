import { z } from "zod";

export const LogsTimelineQuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),

  // Same filters as list
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  service: z.string().optional(),
  module: z.string().optional(),
  event: z.string().optional(),
  method: z.string().toUpperCase().optional(),
  statusCode: z.coerce.number().int().optional(),
  actorUserId: z.string().optional(),
  requestId: z.string().optional(),
  entity: z.string().optional(),
  q: z.string().optional(),

  bucket: z.enum(["minute", "hour", "day"]).default("hour"),
  tz: z.string().default("UTC")
});

export type LogsTimelineQuery = z.infer<typeof LogsTimelineQuerySchema>;
