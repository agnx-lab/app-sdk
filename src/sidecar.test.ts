// 场景：SDK sidecar 骨架 — 端口保护 / 参数解析 / 探活 / 输出契约。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGNX_DAEMON_PORT,
  guardPort,
  isPidAlive,
  isPortBusy,
  loopbackOrigin,
  parseEnsureArgs,
  spawnDetached,
  stopPid,
  waitForPidGone,
} from "./sidecar";

/** 起一个随机端口的 TCP 监听，返回端口与关闭函数（抽出来以压平测试内嵌套回调）。 */
async function listenOnRandomPort(): Promise<{ port: number; close: () => Promise<void> }> {
  const { createServer } = await import("node:net");
  const server = createServer();
  const port = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 0);
    });
  });
  return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** 等 ms 毫秒（测试用，压平 Promise 嵌套）。 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("app-sdk sidecar", () => {
  let tmp = "";
  afterEach(() => {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = "";
    }
  });

  describe("guardPort", () => {
    it("拒绝宿主 daemon 端口（硬规则：占用会顶掉整个 Agnx）", () => {
      expect(guardPort(AGNX_DAEMON_PORT)).toBeNull();
      expect(guardPort(6767)).toBeNull();
    });

    it("放行普通端口并规范化", () => {
      expect(guardPort(8100)).toBe(8100);
      expect(guardPort("8100")).toBe(8100);
      expect(guardPort(8100.9)).toBe(8100);
    });

    it("非法端口一律 null", () => {
      expect(guardPort(0)).toBeNull();
      expect(guardPort(-1)).toBeNull();
      expect(guardPort(70000)).toBeNull();
      expect(guardPort("abc")).toBeNull();
      expect(guardPort(null)).toBeNull();
    });

    it("支持自定义保护端口集合", () => {
      expect(guardPort(9000, new Set([9000]))).toBeNull();
      expect(guardPort(6767, new Set([9000]))).toBe(6767);
    });
  });

  describe("parseEnsureArgs", () => {
    const opts = { defaultWorkDir: "/tmp/w", defaultPort: 8000 };

    it("解析宿主约定的四个参数", () => {
      const got = parseEnsureArgs(
        ["--port", "8106", "--work-dir", "/data/app", "--force-restart", "--supervised"],
        opts,
      );
      expect(got).toEqual({
        port: 8106,
        workDir: "/data/app",
        forceRestart: true,
        supervised: true,
      });
    });

    it("兼容 camelCase 写法", () => {
      const got = parseEnsureArgs(["--port", "8100", "--workDir", "/x"], opts);
      expect(got.workDir).toBe("/x");
    });

    it("缺省值来自调用方", () => {
      const got = parseEnsureArgs([], opts);
      expect(got.port).toBe(8000);
      expect(got.workDir).toBe("/tmp/w");
      expect(got.forceRestart).toBe(false);
      expect(got.supervised).toBe(false);
    });

    it("非法端口不覆盖缺省值", () => {
      expect(parseEnsureArgs(["--port", "abc"], opts).port).toBe(8000);
      expect(parseEnsureArgs(["--port", "-5"], opts).port).toBe(8000);
    });
  });

  describe("isPidAlive / waitForPidGone", () => {
    it("当前进程存活、明显不存在的 pid 判死", () => {
      expect(isPidAlive(process.pid)).toBe(true);
      expect(isPidAlive(9_999_999)).toBe(false);
      expect(isPidAlive(0)).toBe(false);
      expect(isPidAlive(-1)).toBe(false);
      expect(isPidAlive(undefined)).toBe(false);
    });

    it("已退出进程 waitForPidGone 立即返回 true", async () => {
      await expect(waitForPidGone(9_999_999, 200)).resolves.toBe(true);
    });

    it("存活进程超时返回 false", async () => {
      await expect(waitForPidGone(process.pid, 200)).resolves.toBe(false);
    });

    it("stopPid 对已死进程直接成功", async () => {
      await expect(stopPid(9_999_999)).resolves.toBe(true);
    });
  });

  describe("isPortBusy", () => {
    it("无监听返回 false，有监听返回 true", async () => {
      const { port, close } = await listenOnRandomPort();
      try {
        await expect(isPortBusy(port)).resolves.toBe(true);
      } finally {
        await close();
      }
      await expect(isPortBusy(port)).resolves.toBe(false);
    });
  });

  describe("spawnDetached", () => {
    it("日志落文件且可读，进程能自行退出", async () => {
      tmp = mkdtempSync(path.join(tmpdir(), "agnx-sdk-sidecar-"));
      const logFile = path.join(tmp, "out.log");
      const spawned = spawnDetached(process.execPath, ["-e", "console.log('hello-from-sidecar')"], {
        logFile,
        env: {},
      });
      expect(typeof spawned.pid).toBe("number");
      // 等子进程写完
      await sleep(600);
      expect(readFileSync(logFile, "utf8")).toContain("hello-from-sidecar");
      expect(spawned.readLog()).toContain("hello-from-sidecar");
    });

    it("readLog 对不存在的日志文件返回空串而不抛错", () => {
      tmp = mkdtempSync(path.join(tmpdir(), "agnx-sdk-sidecar-"));
      const logFile = path.join(tmp, "missing.log");
      const spawned = spawnDetached(process.execPath, ["-e", "0"], { logFile, env: {} });
      expect(spawned.readLog()).toBe("");
    });
  });

  it("loopbackOrigin 统一拼装", () => {
    expect(loopbackOrigin(8106)).toBe("http://127.0.0.1:8106");
  });
});
