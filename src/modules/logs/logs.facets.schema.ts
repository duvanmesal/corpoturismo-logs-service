import { z } from "zod";

// Reuses the same filter shape as the list query, minus pagination/sort.
export const LogsFacetsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),

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

  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type LogsFacetsQuery = z.infer<typeof LogsFacetsQuerySchema>;
