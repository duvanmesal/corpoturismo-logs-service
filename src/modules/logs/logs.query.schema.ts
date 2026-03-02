import { z } from "zod";
import { LogLevelSchema } from "@/modules/logs/logs.schema";

const SortFieldSchema = z.enum(["ts"]);
const OrderSchema = z.enum(["asc", "desc"]);

export const LogsQuerySchema = z.object({
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

  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),

  sort: SortFieldSchema.default("ts"),
  order: OrderSchema.default("desc")
});
