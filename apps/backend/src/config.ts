import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const envPath = path.resolve(__dirname, '../../../.env');
loadEnv({ path: envPath });

const envSchemaBase = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_BASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_USE_EMULATOR: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  FIREBASE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_PORT: z.string().optional(),
  FIREBASE_FIRESTORE_EMULATOR_PORT: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().url().optional()
});

const envSchema = envSchemaBase.superRefine(
  (value: z.infer<typeof envSchemaBase>, ctx: z.RefinementCtx) => {
  if (!value.FIREBASE_SERVICE_ACCOUNT_PATH) {
    if (!value.FIREBASE_PROJECT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FIREBASE_PROJECT_ID is required when FIREBASE_SERVICE_ACCOUNT_PATH is not set'
      });
    }
    if (!value.FIREBASE_CLIENT_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FIREBASE_CLIENT_EMAIL is required when FIREBASE_SERVICE_ACCOUNT_PATH is not set'
      });
    }
    if (!value.FIREBASE_PRIVATE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FIREBASE_PRIVATE_KEY is required when FIREBASE_SERVICE_ACCOUNT_PATH is not set'
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fastify logger is not available here; keep the error terse.
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;

