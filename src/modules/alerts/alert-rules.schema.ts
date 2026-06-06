import { z } from "zod";

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  level: z.enum(["error", "warn"]),
  windowMinutes: z.number().int().min(1).max(1440),
  threshold: z.number().int().min(1),
  service: z.string().optional(),
  module: z.string().optional(),
  enabled: z.boolean().default(true)
});

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();

export const EvaluateQuerySchema = z.object({
  service: z.string().optional()
});

export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleSchema>;
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleSchema>;
export type EvaluateQuery = z.infer<typeof EvaluateQuerySchema>;
