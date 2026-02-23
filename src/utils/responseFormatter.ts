import type { WandboxCompileResponse } from "../types/wandbox.js";

export interface CompilePhaseResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunPhaseResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Converts Docker container compile/run output to Wandbox response.
 * Exactly one field: compiler_error | program_error | program_output.
 */
export function formatWandboxResponse(
  compile: CompilePhaseResult,
  run: RunPhaseResult | null
): WandboxCompileResponse {
  if (compile.exitCode !== 0) {
    const text = [compile.stderr.trim(), compile.stdout.trim()].filter(Boolean).join("\n") || "Compilation failed.";
    return { compiler_error: text };
  }
  if (run === null) {
    return { program_error: "Execution phase did not run." };
  }
  if (run.exitCode !== 0) {
    const text = [run.stderr.trim(), run.stdout.trim()].filter(Boolean).join("\n") || `Process exited with code ${run.exitCode}.`;
    return { program_error: text };
  }
  return { program_output: run.stdout.trim() || "" };
}
