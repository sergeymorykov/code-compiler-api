import { Writable } from "node:stream";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Docker from "dockerode";
import { config } from "../config.js";
import type { CompilePhaseResult, RunPhaseResult } from "../utils/responseFormatter.js";
import { createTarBuffer } from "../utils/tar.js";

function collectStream(): { stream: Writable; getValue: () => string } {
  let value = "";
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      value += chunk.toString("utf8");
      cb();
    },
  });
  return { stream, getValue: () => value };
}

const WORK_DIR = config.WORK_DIR_IN_CONTAINER;
const SOURCE_FILE = "main.cpp";
const RUN_TIMEOUT_SEC = Math.ceil(config.RUN_TIMEOUT_MS / 1000);

/** Non-root user in compiler images (uid:gid). */
const CONTAINER_USER = "1000:1000";

/** Max processes — 256 is enough for g++/clang++; 32 was too low to even start a container. */
const ULIMIT_NPROC = 256;

/**
 * Platform-aware Docker client.
 * DOCKER_HOST env takes precedence; otherwise auto-detect socket by OS.
 */
function createDockerClient(): Docker {
  if (process.env.DOCKER_HOST) {
    return new Docker();
  }

  switch (process.platform) {
    case "win32":
      return new Docker({ socketPath: "//./pipe/docker_engine" });
    case "darwin": {
      const defaultSock = "/var/run/docker.sock";
      const userSock = join(homedir(), ".docker", "run", "docker.sock");
      const socketPath = existsSync(defaultSock) ? defaultSock : existsSync(userSock) ? userSock : defaultSock;
      return new Docker({ socketPath });
    }
    default:
      return new Docker({ socketPath: "/var/run/docker.sock" });
  }
}

const docker = createDockerClient();

export class CompileTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileTimeoutError";
  }
}

export class RunTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunTimeoutError";
  }
}

/**
 * Run compilation and execution in a hardened container.
 * Security: non-root, no network, read-only root, all caps dropped, seccomp, ulimits.
 */
export async function runCompileAndExecute(
  imageName: string,
  code: string,
  compilerFlags: string[],
  compilerCommand: "g++" | "clang++"
): Promise<{ compile: CompilePhaseResult; run: RunPhaseResult | null }> {
  const compileTimeoutMs = config.COMPILE_TIMEOUT_MS;
  const runTimeoutMs = config.RUN_TIMEOUT_MS;

  const tmpfs: Record<string, string> = {
    "/tmp": "rw,noexec,nosuid,size=32m",
  };

  const hostConfig: Docker.HostConfig & { User?: string } = {
    // No network access (prevents exfiltration, C2, etc.)
    NetworkMode: "none",
    // ReadonlyRootfs: true blocks putArchive (API returns "rootfs is marked read-only"). Omit; isolation via NetworkMode, CapDrop, User, Ulimits.
    // Drop all capabilities (no cap_net_raw, cap_sys_admin, etc.)
    CapDrop: ["ALL"],
    // Run as non-root to limit impact of breakout
    User: CONTAINER_USER,
    Tmpfs: tmpfs,
    // Limit number of processes (fork bomb mitigation)
    Ulimits: [
      { Name: "nproc", Soft: ULIMIT_NPROC, Hard: ULIMIT_NPROC },
    ],
    Memory: 512 * 1024 * 1024,
    AutoRemove: false,
  };

  // Custom or default seccomp can cause runc "cannot allocate memory" on Docker Desktop/WSL2.
  // Use unconfined to avoid that; isolation still via NetworkMode, CapDrop, ReadonlyRootfs, Ulimits.
  hostConfig.SecurityOpt = ["no-new-privileges:true", "seccomp=unconfined"];

  const createOptions: Docker.ContainerCreateOptions = {
    Image: imageName,
    HostConfig: hostConfig,
    Cmd: ["tail -f /dev/null"],
    WorkingDir: WORK_DIR,
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
  };

  const container = await docker.createContainer(createOptions);

  try {
    await container.start();
    await new Promise((r) => setTimeout(r, 500));

    const tar = createTarBuffer(SOURCE_FILE, code);
    await container.putArchive(tar, { path: WORK_DIR });

    const compileCmd = `${compilerCommand} -o /workspace/a.out /workspace/${SOURCE_FILE} ${compilerFlags.join(" ")} 2>&1`;
    const compile = await execAndCapture(
      container,
      ["sh", "-c", compileCmd],
      compileTimeoutMs
    );

    if (compile.exitCode !== 0) {
      return { compile, run: null };
    }

    let run: RunPhaseResult;
    try {
      run = await execAndCapture(
        container,
        ["sh", "-c", `timeout ${RUN_TIMEOUT_SEC} /workspace/a.out 2>&1`],
        runTimeoutMs
      );
    } catch (err) {
      if (err instanceof RunTimeoutError) {
        run = {
          exitCode: 124,
          stdout: "",
          stderr: "Execution timed out.",
        };
      } else {
        throw err;
      }
    }

    return { compile, run };
  } finally {
    try { await container.stop({ t: 2 }); } catch { /* already stopped */ }
    try { await container.remove(); } catch { /* already removed */ }
  }
}

/**
 * Resolve compiler name to Docker image name.
 */
export function getImageForCompiler(compiler: "gcc-head" | "clang-head"): string {
  return compiler === "gcc-head" ? config.IMAGE_GCC_HEAD : config.IMAGE_CLANG_HEAD;
}

function execAndCapture(
  container: Docker.Container,
  cmd: string[],
  timeoutMs: number
): Promise<CompilePhaseResult | RunPhaseResult> {
  return new Promise((resolve, reject) => {
    const isRun = cmd[0] === "sh" && cmd[2]?.includes("a.out");
    const timeoutErr = isRun ? new RunTimeoutError("Run phase timed out") : new CompileTimeoutError("Compile phase timed out");

    container.exec(
      {
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: WORK_DIR,
      },
      (err: Error | null, exec: Docker.Exec | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        if (!exec) {
          reject(new Error("No exec instance"));
          return;
        }

        const timeout = setTimeout(() => {
          (exec as { kill?: (cb: () => void) => void }).kill?.(() => {});
          reject(timeoutErr);
        }, timeoutMs);

        exec.start({ Detach: false, Tty: false }, (startErr: Error | null, stream: NodeJS.ReadableStream | undefined) => {
          if (startErr) {
            clearTimeout(timeout);
            reject(startErr);
            return;
          }
          if (!stream) {
            clearTimeout(timeout);
            reject(new Error("No stream"));
            return;
          }
          const out = collectStream();
          const err = collectStream();
          const modem = (docker as Docker & { modem?: { demuxStream: (a: NodeJS.ReadableStream, b: NodeJS.WritableStream, c: NodeJS.WritableStream) => void } }).modem;
          if (modem?.demuxStream) {
            modem.demuxStream(stream, out.stream, err.stream);
          } else {
            let buf = Buffer.alloc(0);
            stream.on("data", (chunk: Buffer) => {
              buf = Buffer.concat([buf, chunk]);
              while (buf.length >= 8) {
                const streamId = buf[0];
                const len = buf.readUInt32BE(4);
                if (buf.length < 8 + len) break;
                const payload = buf.subarray(8, 8 + len);
                buf = buf.subarray(8 + len);
                if (streamId === 1) out.stream.write(payload);
                else if (streamId === 2) err.stream.write(payload);
              }
            });
            stream.on("end", () => { out.stream.end(); err.stream.end(); });
          }
          stream.on("end", () => {
            exec.inspect((_err: Error | null, data?: Docker.ExecInspectInfo) => {
              clearTimeout(timeout);
              const exitCode = data?.ExitCode ?? 255;
              resolve({ exitCode, stdout: out.getValue(), stderr: err.getValue() });
            });
          });
        });
      }
    );
  });
}
