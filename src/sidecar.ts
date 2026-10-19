// 场景：子应用 ensure 工具的通用骨架 — 端口保护 / 进程探活 / 参数解析 / 输出契约。
//
// 设计边界（务必遵守，否则会变成第二个宿主）：
// - 只放**横切关注点**：每个 ensure 脚本都要写、且写法必须完全一致的纯工具。
// - **不接管主流程**：不提供 runEnsure()/launch() 之类的框架。各应用的 main() 保留自己的
//   启动顺序（uvx / uv venv / npm build / 环境注入各不相同），这些差异是上游固有属性，
//   抽象它们只会产出 if (appId === ...) 式分支。
// - 零依赖：只用 node: 内置模块，保证 ensure 脚本在裸 node 下可跑。
//
// 为什么值得抽：8 个已接入子应用共 3372 行 ensure 代码，其中 isPidAlive / parseArgs /
// stopPid / spawnDetached / guardPort 在每个应用里都重写过，且已出现分叉
// （spawnDetached 有两种实现，一种因 stdio 管道未 unref 导致 ensure 进程挂住不退）。
// 统一到 SDK 后修一次全生效。

import { openSync, closeSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

/** 宿主主守护进程端口。任何子应用 sidecar 都不得占用，否则会顶掉整个 Agnx daemon。 */
export const AGNX_DAEMON_PORT = 6767;

const DEFAULT_FORBIDDEN_PORTS: ReadonlySet<number> = new Set([AGNX_DAEMON_PORT]);

export interface EnsureCliArgs {
  workDir: string;
  port: number;
  forceRestart: boolean;
  supervised: boolean;
}

export interface ParseEnsureArgsOptions {
  /** 缺省数据目录（宿主通常已通过 --work-dir 传入）。 */
  defaultWorkDir: string;
  /** 缺省端口。 */
  defaultPort: number;
}

/**
 * 解析宿主约定的 ensure 参数。
 *
 * 宿主固定传 `--port / --work-dir / --force-restart / --supervised`，
 * 且兼容 camelCase 写法（历史脚本两种都收）。每个应用手写一份只会引入漂移。
 */
export function parseEnsureArgs(
  argv: readonly string[],
  opts: ParseEnsureArgsOptions,
): EnsureCliArgs {
  let workDir = opts.defaultWorkDir;
  let port = opts.defaultPort;
  let forceRestart = false;
  let supervised = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--work-dir" || arg === "--workDir") && next) {
      const trimmed = String(next).trim();
      if (trimmed) {
        workDir = trimmed;
      }
      i += 1;
    } else if (arg === "--port" && next) {
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) {
        port = Math.floor(n);
      }
      i += 1;
    } else if (arg === "--force-restart" || arg === "--forceRestart") {
      forceRestart = true;
    } else if (arg === "--supervised") {
      supervised = true;
    }
  }
  return { workDir, port, forceRestart, supervised };
}

/**
 * 端口守卫：拒绝占用 daemon 端口。
 *
 * 这是硬规则——写错一次就可能把用户的主守护进程搞挂。放进 SDK 是让新应用**默认安全**，
 * 而不是靠作者记得从别处抄一行 `FORBIDDEN_PORTS = new Set([6767])`。
 *
 * @returns 合法且未被保护的端口；否则 null（调用方应报错退出）。
 */
export function guardPort(
  rawPort: unknown,
  forbidden: ReadonlySet<number> = DEFAULT_FORBIDDEN_PORTS,
): number | null {
  const n = Number(rawPort);
  if (!Number.isFinite(n)) {
    return null;
  }
  const port = Math.floor(n);
  if (port <= 0 || port > 65535) {
    return null;
  }
  if (forbidden.has(port)) {
    return null;
  }
  return port;
}

/**
 * 端口是否被占用。
 *
 * 返回 true 表示**有进程在监听**（不等于健康，健康要靠 HTTP 探活另行判断）。
 */
export function isPortBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * PID 是否存活。
 *
 * EPERM 视为存活：进程存在只是没权限发信号（常见于其他用户起的服务）。
 * 8 个应用里这段逐字节相同，统一后行为一致。
 */
export function isPidAlive(pid: unknown): boolean {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 1) {
    return false;
  }
  try {
    process.kill(n, 0);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "EPERM"
    ) {
      return true;
    }
    return false;
  }
}

/** 等进程退出，超时返回 false。 */
export async function waitForPidGone(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return !isPidAlive(pid);
}

/** 停进程：先 SIGTERM，超时再 SIGKILL。 */
export async function stopPid(pid: unknown, timeoutMs = 5_000): Promise<boolean> {
  const n = Number(pid);
  if (!isPidAlive(n)) {
    return true;
  }
  try {
    process.kill(n, "SIGTERM");
  } catch {
    return !isPidAlive(n);
  }
  if (await waitForPidGone(n, timeoutMs)) {
    return true;
  }
  try {
    process.kill(n, "SIGKILL");
  } catch {
    // 已经退了
  }
  return waitForPidGone(n, 2_000);
}

export interface SpawnDetachedOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** 日志文件路径；日志追加写入，读日志取尾部。 */
  logFile: string;
  /** 诊断缓冲上限（默认 12k 字符）。 */
  maxLogBytes?: number;
}

export interface SpawnedSidecar {
  child: ChildProcess;
  pid: number | null;
  /** 读日志尾部（用于失败时报错）。 */
  readLog: () => string;
}

/**
 * 起一个脱离父进程的后台进程。
 *
 * **必须 unref + 日志落文件**：早期版本用 `stdio: ["ignore","pipe","pipe"]` 且未 unref，
 * 子进程继承了管道句柄，导致 ensure 轮询进程永远不退出（实测会挂死宿主启动）。
 * 这里统一为文件日志，从根本上避开引用计数问题。
 */
export function spawnDetached(
  command: string,
  args: readonly string[],
  opts: SpawnDetachedOptions,
): SpawnedSidecar {
  const maxLog = opts.maxLogBytes ?? 12_000;
  const fd = openSync(opts.logFile, "a");
  let child: ChildProcess;
  try {
    child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env as NodeJS.ProcessEnv,
      detached: true,
      stdio: ["ignore", fd, fd],
    });
  } finally {
    // 子进程已拿到自己的 fd 副本，父侧不再需要。
    closeSync(fd);
  }
  child.unref();
  return {
    child,
    pid: child.pid ?? null,
    readLog: () => {
      try {
        const raw = readFileSync(opts.logFile, "utf8");
        return raw.length > maxLog ? raw.slice(-maxLog) : raw;
      } catch {
        return "";
      }
    },
  };
}

export type EnsureResult =
  | {
      ok: true;
      reused: boolean;
      port: number;
      origin: string;
      pid: number | null;
      warnings?: string[];
      [extra: string]: unknown;
    }
  | { ok: false; error: string; [extra: string]: unknown };

/**
 * 按宿主契约打印结果：**stdout 最后一行必须是单行 JSON**。
 *
 * 成功：{ok:true, reused, port, origin, pid}
 * 失败：{ok:false, error} 且 exitCode=1
 *
 * `origin` 是宿主加载页面用的地址，缺失会导致宿主自行拼装、易出错，故强制要求。
 */
export function emitResult(result: EnsureResult): void {
  if (!result.ok) {
    process.exitCode = 1;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

/** 生成 http origin（统一 host/端口拼接，避免各应用各写一份）。 */
export function loopbackOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/** 轻量诊断日志：写 stderr，不污染宿主解析的 stdout。 */
export function createEnsureLogger(tag: string): (phase: string, fields?: object) => void {
  return (phase: string, fields?: object) => {
    process.stderr.write(`[${tag}] ${JSON.stringify({ phase, ...fields })}\n`);
  };
}
