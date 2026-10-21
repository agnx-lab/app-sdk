import { describe, expect, it, vi } from "vitest";
import { createPermissionGate, resolvePermissionGateView } from "./permission-gate";
import type {
  SystemPermissionStatus,
  WorkspaceAppPermissionApi,
} from "./system-permission-host-api";

const deniedAll = (ids: SystemPermissionStatus["id"][]): SystemPermissionStatus[] =>
  ids.map((id) => denied(id));

const granted = (id: SystemPermissionStatus["id"]): SystemPermissionStatus => ({
  id,
  state: "granted",
});
const denied = (
  id: SystemPermissionStatus["id"],
  extra?: Partial<SystemPermissionStatus>,
): SystemPermissionStatus => ({ id, state: "denied", ...extra });

describe("resolvePermissionGateView", () => {
  it("全绿 → granted，可进主界面", () => {
    const view = resolvePermissionGateView(
      ["screen.capture", "accessibility"],
      [granted("screen.capture"), granted("accessibility")],
    );
    expect(view.state).toBe("granted");
    expect(view.isBlocked).toBe(false);
    expect(view.rows.every((row) => row.satisfied)).toBe(true);
  });

  it("缺一项 → blocked", () => {
    const view = resolvePermissionGateView(
      ["screen.capture", "accessibility"],
      [granted("screen.capture"), denied("accessibility")],
    );
    expect(view.state).toBe("blocked");
    expect(view.isBlocked).toBe(true);
  });

  it("restartRequired 优先于 blocked —— 这是「授权了但没生效」，不是「没授权」", () => {
    const view = resolvePermissionGateView(
      ["screen.capture"],
      [denied("screen.capture", { restartRequired: true })],
    );
    expect(view.state).toBe("restart-required");
  });

  it("被拒且试过 → needsSettings（应引导去系统设置，别再弹框）", () => {
    const view = resolvePermissionGateView(
      ["screen.capture"],
      [denied("screen.capture", { askedBefore: true })],
    );
    expect(view.needsSettings).toBe(true);
  });

  it("没试过 → 不该引导去系统设置（还能弹一次系统框）", () => {
    const view = resolvePermissionGateView(
      ["screen.capture"],
      [denied("screen.capture", { askedBefore: false })],
    );
    expect(view.needsSettings).toBe(false);
  });

  it("unsupported 不阻塞：平台不支持时不能把用户永久挡在门外", () => {
    const view = resolvePermissionGateView(
      ["screen.capture"],
      [{ id: "screen.capture", state: "unsupported" }],
    );
    expect(view.state).toBe("granted");
    expect(view.isBlocked).toBe(false);
  });

  it("宿主没返回某项时按未满足处理，不误判为已授权", () => {
    const view = resolvePermissionGateView(["screen.capture"], []);
    expect(view.state).toBe("blocked");
    expect(view.rows[0]?.state).toBe("denied");
  });
});

describe("PermissionGate", () => {
  function makeApi(overrides?: Partial<WorkspaceAppPermissionApi>): WorkspaceAppPermissionApi {
    return {
      query: vi.fn(async (ids: SystemPermissionStatus["id"][]) => ids.map((id) => granted(id))),
      request: vi.fn(async (ids: SystemPermissionStatus["id"][]) => ids.map((id) => granted(id))),
      onChange: vi.fn(() => () => undefined),
      ...overrides,
    };
  }

  it("宿主不支持 host.permissions 时返回 null，调用方应直接放行", () => {
    expect(createPermissionGate(undefined, { required: ["screen.capture"] })).toBeNull();
  });

  it("初始快照按未满足算，避免首帧闪一下主界面", () => {
    const gate = createPermissionGate(makeApi(), { required: ["screen.capture"] });
    expect(gate?.current.state).toBe("blocked");
  });

  it("check 拿到全绿后放行", async () => {
    const gate = createPermissionGate(makeApi(), { required: ["screen.capture"] });
    const snap = await gate!.check();
    expect(snap.state).toBe("granted");
  });

  it("query 抛错不阻塞：仍可让用户点「去开启」", async () => {
    const api = makeApi({
      query: vi.fn(async () => {
        throw new Error("ipc down");
      }),
    });
    const gate = createPermissionGate(api, { required: ["screen.capture"] });
    const snap = await gate!.check();
    expect(snap.state).toBe("blocked");
  });

  it("request 把 reason 透传给宿主（弹框要显示用途）", async () => {
    const api = makeApi();
    const gate = createPermissionGate(api, {
      required: ["screen.capture"],
      reason: "需要看到你的桌面",
    });
    await gate!.request();
    expect(api.request).toHaveBeenCalledWith(["screen.capture"], "需要看到你的桌面");
  });

  it("onChange 推送单项授权后自动推进（用户去系统设置手动开也能感知）", async () => {
    const listeners: Array<(s: SystemPermissionStatus) => void> = [];
    const api = makeApi({
      query: vi.fn(async (ids: SystemPermissionStatus["id"][]) => deniedAll(ids)),
      onChange: vi.fn((listener) => {
        listeners.push(listener);
        return () => undefined;
      }),
    });
    const seen: string[] = [];
    const gate = createPermissionGate(api, {
      required: ["screen.capture"],
      onChange: (snap) => seen.push(snap.state),
    });
    await gate!.check();
    gate!.subscribe();
    listeners[0]?.(granted("screen.capture"));
    expect(seen).toContain("granted");
    expect(gate!.current.state).toBe("granted");
  });

  it("dispose 后不再响应推送（防面板卸载后泄漏）", async () => {
    const listeners: Array<(s: SystemPermissionStatus) => void> = [];
    const api = makeApi({
      query: vi.fn(async (ids: SystemPermissionStatus["id"][]) => deniedAll(ids)),
      onChange: vi.fn((listener) => {
        listeners.push(listener);
        return () => undefined;
      }),
    });
    const gate = createPermissionGate(api, { required: ["screen.capture"] });
    await gate!.check();
    gate!.subscribe();
    gate!.dispose();
    listeners[0]?.(granted("screen.capture"));
    expect(gate!.current.state).toBe("blocked");
  });
});
