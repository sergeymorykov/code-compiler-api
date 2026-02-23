/**
 * Wandbox API contract types.
 * Response must contain exactly one of: compiler_error | program_error | program_output.
 */

export const WANDBOX_COMPILERS = ["gcc-head", "clang-head"] as const;
export type WandboxCompiler = (typeof WANDBOX_COMPILERS)[number];

export interface WandboxCompileRequest {
  code: string;
  compiler: WandboxCompiler;
  options?: string;
}

/** Exactly one field — Wandbox format. */
export type WandboxCompileResponse =
  | { compiler_error: string }
  | { program_error: string }
  | { program_output: string };
