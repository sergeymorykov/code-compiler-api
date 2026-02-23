import { Router, Request, Response } from "express";
import { z } from "zod";
import { WANDBOX_COMPILERS } from "../types/wandbox.js";
import { compileAndRun } from "../services/compiler.js";
import { CompileTimeoutError, RunTimeoutError } from "../services/docker.js";
import { CodeSizeError } from "../services/compiler.js";
import { config } from "../config.js";

const compileRequestBodySchema = z.object({
  code: z.string().min(1),
  compiler: z.enum(WANDBOX_COMPILERS),
  options: z.string().optional(),
});

const router = Router();
const CODE_SIZE_LIMIT = config.CODE_SIZE_LIMIT_BYTES;

router.post("/api/compile.json", async (req: Request, res: Response): Promise<void> => {
  const parsed = compileRequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { code } = parsed.data;
  if (Buffer.byteLength(code, "utf8") > CODE_SIZE_LIMIT) {
    res.status(400).json({ error: `Code size exceeds limit of ${CODE_SIZE_LIMIT} bytes` });
    return;
  }

  try {
    const response = await compileAndRun(parsed.data);
    res.json(response);
  } catch (err) {
    if (err instanceof CodeSizeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof CompileTimeoutError) {
      res.status(504).json({ error: "Compilation timed out" });
      return;
    }
    if (err instanceof RunTimeoutError) {
      res.status(504).json({ error: "Execution timed out" });
      return;
    }
    console.error("Compile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
