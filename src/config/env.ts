import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),

  MONGO_URL: z.string().min(1),
  MONGO_DB: z.string().min(1),

  INGEST_API_KEY: z.string().min(16),
  READ_API_KEY: z.string().min(16),
  ADMIN_API_KEY: z.string().min(16).optional(),

  CORS_ORIGIN: z.string().default("*")
});

export type AppEnv = z.infer<typeof EnvSchema>;

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  MONGO_URL: process.env.MONGO_URL,
  MONGO_DB: process.env.MONGO_DB,
  INGEST_API_KEY: process.env.INGEST_API_KEY,
  READ_API_KEY: process.env.READ_API_KEY,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  CORS_ORIGIN: process.env.CORS_ORIGIN
};

const parsedEnv = EnvSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(
    `Missing or invalid environment variables: ${details}. Required: NODE_ENV, MONGO_URL, MONGO_DB, INGEST_API_KEY, READ_API_KEY, CORS_ORIGIN.`
  );
}

export const env: AppEnv = parsedEnv.data;
