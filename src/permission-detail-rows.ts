// 场景：把「系统权限」做进子应用的**详情配置**，而不是盖在 Tab 内容区。
//
// 为什么不在 Tab 里遮挡：用户点开子应用是想用它的界面，不是来配权限的。整屏挡住
// 既打断使用，又让人以为应用坏了。权限是「配置项」，属于详情配置；应用真正需要
// 某项权限时，才在自己的 UI 里提示一句「去详情配置授权」。
//
// 为什么放在 SDK：这套行的文案（已授权 / 未授权 / 需重启）和「去开启」的跳转逻辑，
// 每个电脑操作类子应用都要写一遍。抽出来后子应用只需一行：
//
// ```ts
// host.registerDetailSheetExtras(
//   buildPermissionDetailRows(host, { required: ["screen.capture", "accessibility"] }),
// );
// ```
//
// 关键交互约束（来自真实反馈）：
//   - 系统设置里授权的是**宿主 Agnx**，不是子应用名字。必须明确写出来，
//     否则用户打开系统设置后不知道该给哪个应用打勾。
//   - 「已授权」要能在详情里看到，作为配置完成的确认。
//   - 授权后需重启时，显示「需重启 Agnx」而不是「未授权」。

import type { WorkspaceAppHostApi } from "./host-api";
import type { WorkspaceAppDetailSheetExtraRow } from "./host-api";
import type { SystemPermissionId, SystemPermissionStatus } from "./system-permission-host-api";
import { resolvePermissionGateView } from "./permission-gate";

/** 权限 id → 中文名（与 macOS 面板一致）。 */
const PERMISSION_LABELS: Record<string, string> = {
  "screen.capture": "屏幕录制",
  accessibility: "辅助功能",
  camera: "摄像头",
  microphone: "麦克风",
  "full-disk": "完全磁盘访问",
};

export interface PermissionDetailRowsOptions {
  /** 本子应用需要的权限。 */
  required: readonly SystemPermissionId[];
  /** 宿主授权对象的显示名 —— 系统设置里出现的是它，不是子应用名。默认 Agnx。 */
  hostAppLabel?: string;
  /** 分组标题，默认「系统权限」。 */
  groupTitle?: string;
}

/** 单行状态文案。 */
export function describePermissionStatus(status: SystemPermissionStatus | undefined): string {
  if (!status) {
    return "未授权";
  }
  if (status.restartRequired) {
    return "需重启 Agnx";
  }
  switch (status.state) {
    case "granted":
      return "已授权";
    case "unsupported":
      return "不支持";
    default:
      return status.askedBefore ? "未授权（曾被拒绝）" : "未授权";
  }
}

/**
 * 构造详情配置里的权限行。
 *
 * 返回的是 `registerDetailSheetExtras` 的 builder，**每次打开详情都会重新查**，
 * 所以用户在系统设置里勾完回来，重新打开详情就能看到「已授权」。
 *
 * 注意：本函数是同步 builder，而查询是异步的。这里用「缓存 + 触发重查」的方式：
 * 首次调用返回当前缓存（可能为空 → 显示未授权），同时在后台发起查询，
 * 查完通过 `host.registerDetailSheetExtras` 的 revision 机制刷新。
 */
export function buildPermissionDetailRows(
  host: WorkspaceAppHostApi,
  options: PermissionDetailRowsOptions,
): () => WorkspaceAppDetailSheetExtraRow[] {
  const groupTitle = options.groupTitle ?? "系统权限";
  const hostAppLabel = options.hostAppLabel ?? "Agnx";
  const required = options.required;
  // 最近一次查询结果；null 表示还没查过。
  let lastStatuses: SystemPermissionStatus[] | null = null;
  let inFlight = false;

  const refresh = () => {
    const api = host.permissions;
    if (!api || inFlight) {
      return;
    }
    inFlight = true;
    void api
      .query([...required])
      .then((statuses) => {
        lastStatuses = statuses;
        return statuses;
      })
      .catch(() => {
        // 查询失败保持上一次结果，不要闪成「未授权」。
      })
      .finally(() => {
        inFlight = false;
      });
  };

  return () => {
    // 每次构建行都触发一次后台重查，下次打开详情即是最新状态。
    refresh();

    const view = resolvePermissionGateView(required, lastStatuses ?? []);
    const rows: WorkspaceAppDetailSheetExtraRow[] = view.rows.map((row) => {
      const label = PERMISSION_LABELS[row.id] ?? row.id;
      const status = lastStatuses?.find((item) => item.id === row.id);
      const satisfied = row.satisfied;
      return {
        label,
        value: describePermissionStatus(status),
        helpText: satisfied
          ? undefined
          : `授权对象是「${hostAppLabel}」（不是本应用的名字）。点下方按钮打开系统设置，在列表里找到 ${hostAppLabel} 并打开开关。`,
        groupId: "system-permissions",
        groupTitle,
      };
    });

    // 全部满足时补一行说明，让「配置完成」这件事在详情里可见。
    if (view.state === "granted") {
      rows.push({
        label: "授权对象",
        value: hostAppLabel,
        helpText: "系统设置里勾选的是宿主 Agnx；子应用共用宿主的系统权限。",
        groupId: "system-permissions",
        groupTitle,
      });
    }

    return rows;
  };
}

/**
 * 打开某项权限对应的系统设置面板。
 *
 * 子应用可以在自己的 UI 里放一个「去详情配置授权」的按钮，调用本函数跳过去。
 * 返回 false 表示宿主不支持（非桌面端 / 旧宿主），调用方应静默降级。
 */
export async function openPermissionSettings(
  host: WorkspaceAppHostApi,
  id: SystemPermissionId,
): Promise<boolean> {
  const api = host.permissions;
  if (!api) {
    return false;
  }
  // 先走 request：宿主会弹框说明用途 → 深链系统面板 → 轮询。
  // 用户已经拒绝过时，宿主内部会转成「只打开设置」，不会重复弹系统框。
  try {
    await api.request([id]);
    return true;
  } catch {
    return false;
  }
}
