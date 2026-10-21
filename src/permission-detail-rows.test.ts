import { describe, expect, it, vi } from "vitest";
import {
  buildPermissionDetailRows,
  describePermissionStatus,
  openPermissionSettings,
} from "./permission-detail-rows";
import type { WorkspaceAppHostApi } from "./host-api";
import type {
  SystemPermissionStatus,
  WorkspaceAppPermissionApi,
} from "./system-permission-host-api";

const granted = (id: SystemPermissionStatus["id"]): SystemPermissionStatus => ({
  id,
  state: "granted",
});

const grantAll = (ids: SystemPermissionStatus["id"][]): SystemPermissionStatus[] =>
  ids.map((id) => granted(id));

function makeApi(overrides?: Partial<WorkspaceAppPermissionApi>): WorkspaceAppPermissionApi {
  return {
    query: vi.fn(async (ids: SystemPermissionStatus["id"][]) => grantAll(ids)),
    request: vi.fn(async (ids: SystemPermissionStatus["id"][]) => grantAll(ids)),
    onChange: vi.fn(() => () => undefined),
    ...overrides,
  };
}

function makeHost(api?: WorkspaceAppPermissionApi): WorkspaceAppHostApi {
  return { permissions: api } as unknown as WorkspaceAppHostApi;
}

describe("describePermissionStatus", () => {
  it("已授权", () => {
    expect(describePermissionStatus(granted("screen.capture"))).toBe("已授权");
  });

  it("需重启优先于未授权 —— 用户已勾选，只是还没生效", () => {
    expect(
      describePermissionStatus({ id: "screen.capture", state: "denied", restartRequired: true }),
    ).toBe("需重启 Agnx");
  });

  it("被拒过要标出来，用户才知道要去系统设置而不是再点一次", () => {
    expect(
      describePermissionStatus({ id: "screen.capture", state: "denied", askedBefore: true }),
    ).toBe("未授权（曾被拒绝）");
  });

  it("没查到时按未授权", () => {
    expect(describePermissionStatus(undefined)).toBe("未授权");
  });

  it("平台不支持", () => {
    expect(describePermissionStatus({ id: "camera", state: "unsupported" })).toBe("不支持");
  });
});

describe("buildPermissionDetailRows", () => {
  it("宿主没有 permissions 时仍产出行（显示未授权），不崩", () => {
    const build = buildPermissionDetailRows(makeHost(undefined), {
      required: ["screen.capture"],
    });
    const rows = build();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("屏幕录制");
    expect(rows[0]?.value).toBe("未授权");
  });

  it("helpText 明确写出授权对象是宿主 Agnx（用户不知道要给谁授权）", () => {
    const build = buildPermissionDetailRows(makeHost(undefined), {
      required: ["screen.capture"],
    });
    const rows = build();
    expect(rows[0]?.helpText).toContain("Agnx");
    expect(rows[0]?.helpText).toContain("不是本应用的名字");
  });

  it("自定义 hostAppLabel 会出现在文案里", () => {
    const build = buildPermissionDetailRows(makeHost(undefined), {
      required: ["screen.capture"],
      hostAppLabel: "Agnx Dev",
    });
    expect(build()[0]?.helpText).toContain("Agnx Dev");
  });

  it("权限行归到「系统权限」分组", () => {
    const build = buildPermissionDetailRows(makeHost(undefined), {
      required: ["screen.capture", "accessibility"],
    });
    const rows = build();
    expect(rows.every((row) => row.groupId === "system-permissions")).toBe(true);
    expect(rows[0]?.groupTitle).toBe("系统权限");
  });

  it("查询到全绿后，下次构建显示已授权并补一行「授权对象」", async () => {
    const api = makeApi();
    const build = buildPermissionDetailRows(makeHost(api), { required: ["screen.capture"] });
    build(); // 第一次：触发后台查询
    await vi.waitFor(() => {
      expect(api.query).toHaveBeenCalled();
    });
    // 等 promise 落地
    await new Promise((r) => setTimeout(r, 0));
    const rows = build();
    expect(rows.some((row) => row.value === "已授权")).toBe(true);
    // 全绿时补一行说明授权对象
    expect(rows.some((row) => row.label === "授权对象")).toBe(true);
  });

  it("查询失败时保持上一次结果，不闪成未授权", async () => {
    let call = 0;
    const api = makeApi({
      query: vi.fn(async (ids: SystemPermissionStatus["id"][]) => {
        call += 1;
        if (call === 1) return grantAll(ids);
        throw new Error("ipc down");
      }),
    });
    const build = buildPermissionDetailRows(makeHost(api), { required: ["screen.capture"] });
    build();
    await new Promise((r) => setTimeout(r, 0));
    build(); // 触发第二次（会失败）
    await new Promise((r) => setTimeout(r, 0));
    const rows = build();
    expect(rows.some((row) => row.value === "已授权")).toBe(true);
  });
});

describe("openPermissionSettings", () => {
  it("宿主不支持时返回 false（调用方静默降级）", async () => {
    await expect(openPermissionSettings(makeHost(undefined), "screen.capture")).resolves.toBe(
      false,
    );
  });

  it("走 request 让宿主弹框 + 深链 + 轮询", async () => {
    const api = makeApi();
    await expect(openPermissionSettings(makeHost(api), "screen.capture")).resolves.toBe(true);
    expect(api.request).toHaveBeenCalledWith(["screen.capture"]);
  });

  it("request 抛错时返回 false，不把异常抛给 UI", async () => {
    const api = makeApi({
      request: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(openPermissionSettings(makeHost(api), "screen.capture")).resolves.toBe(false);
  });
});
