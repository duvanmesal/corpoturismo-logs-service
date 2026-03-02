import { z } from "zod";
import { LogLevelSchema } from "@/modules/logs/logs.schema";

export const LogsStatsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),

  level: LogLevelSchema.optional(),
  event: z.string().min(1).max(120).optional(),
  service: z.string().min(1).max(120).optional(),

  actorUserId: z.string().min(1).max(120).optional(),
  requestId: z.string().min(1).max(120).optional(),

  entity: z.string().min(1).max(80).optional(),
  entityId: z.string().min(1).max(120).optional(),

  q: z.string().min(1).max(200).optional(),

  // top eventos
  topEventsLimit: z.coerce.number().int().min(1).max(50).default(10),

  // bucket por día (timezone opcional; por defecto UTC)
  tz: z.string().min(1).max(80).default("UTC")
});
