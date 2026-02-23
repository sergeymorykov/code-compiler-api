import { createHash } from "node:crypto";
import NodeCache from "node-cache";
import { config } from "../config.js";
import type { WandboxCompileRequest, WandboxCompileResponse } from "../types/wandbox.js";
import { getImageForCompiler, runCompileAndExecute } from "./docker.js";
import { parseOptions } from "../utils/optionsParser.js";
import { formatWandboxResponse } from "../utils/responseFormatter.js";

const cache = config.CACHE_ENABLED
  ? new NodeCache({ stdTTL: config.CACHE_TTL_SECONDS, useClones: false })
  : null;

const CODE_SIZE_LIMIT = config.CODE_SIZE_LIMIT_BYTES;

export class CodeSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeSizeError";
  }
}

function cacheKey(req: WandboxCompileRequest): string {
  const payload = `${req.code}\n${req.compiler}\n${req.options ?? ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Compile and run: validate size, optional cache, docker run, format Wandbox response.
 */
export async function compileAndRun(req: WandboxCompileRequest): Promise<WandboxCompileResponse> {
  const size = Buffer.byteLength(req.code, "utf8");
  if (size > CODE_SIZE_LIMIT) {
    throw new CodeSizeError(`Code size ${size} exceeds limit ${CODE_SIZE_LIMIT}`);
  }

  if (cache) {
    const key = cacheKey(req);
    const cached = cache.get<WandboxCompileResponse>(key);
    if (cached) return cached;
  }

  const flags = parseOptions(req.options);
  const imageName = getImageForCompiler(req.compiler);
  const compilerCommand = req.compiler === "gcc-head" ? "g++" : "clang++";

  const { compile, run } = await runCompileAndExecute(
    imageName,
    req.code,
    flags,
    compilerCommand
  );

  const response = formatWandboxResponse(compile, run);

  if (cache) {
    cache.set(cacheKey(req), response);
  }

  return response;
}
