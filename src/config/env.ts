import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),

  MONGO_URL: z.string().min(1),
  MONGO_DB: z.string().min(1).default("corpoturismo_db_logs"),

  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
  MAIL_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  INGEST_API_KEY: z.string().min(16),
  READ_API_KEY: z.string().min(16),

  CORS_ORIGIN: z.string().default("*")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env: AppEnv = EnvSchema.parse(process.env);
