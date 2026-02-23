import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  COMPILE_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30_000),
  RUN_TIMEOUT_MS: z.coerce.number().min(1000).max(30_000).default(5_000),
  CODE_SIZE_LIMIT_BYTES: z.coerce.number().min(1024).default(128 * 1024),
  CACHE_ENABLED: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("false"),
  CACHE_TTL_SECONDS: z.coerce.number().min(1).max(3600).default(60),
  IMAGE_GCC_HEAD: z.string().min(1).default("wandbox-clone-api-gcc-head"),
  IMAGE_CLANG_HEAD: z.string().min(1).default("wandbox-clone-api-clang-head"),
  WORK_DIR_IN_CONTAINER: z.string().default("/workspace"),
  SECCOMP_PROFILE_PATH: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
