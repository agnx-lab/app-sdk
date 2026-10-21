// 场景：子应用「系统权限门禁」的通用抽象。
//
// 为什么要抽出来：屏幕录制 / 辅助功能这类权限，每个电脑操作类子应用都要做同一套事
// ——声明需要什么、启动时查一次、缺了就挡住主界面并给一个「去开启」按钮、用户开完
// 自动放行、以及「刚授权但要重启才生效」的提示。各写一遍必然三处漂移：文案不一致、
// 忘了处理 restartRequired、轮询泄漏。
//
// 这里只做**纯状态机 + 纯逻辑**，不依赖 React / 不碰 DOM，因此：
//   - 子应用可以用 `createPermissionGate` 拿状态自己渲染；
//   - 也可以用 `resolvePermissionGateView` 拿到「该显示什么」的决策，直接映射到 UI。
//
// 最短路径原则（与宿主一致）：用户最多点两次 —— 面板里的「去开启」→ 系统面板勾选，
// 之后靠 `onChange` 自动推进，**不要让用户回来再点「我已开启」**。

import type {
  SystemPermissionId,
  SystemPermissionStatus,
  WorkspaceAppPermissionApi,
} from "./system-permission-host-api";

/** 门禁整体状态。 */
export type PermissionGateState =
  /** 全部已授权，可以进入主界面。 */
  | "granted"
  /** 缺少授权，需要用户操作。 */
  | "blocked"
  /** 正在查询或等待用户操作。 */
  | "checking"
  /** 已授权但需重启本进程才生效（macOS 常见）。 */
  | "restart-required"
  /** 宿主未提供 host.permissions（旧宿主）或平台不支持。 */
  | "unsupported";

/** 单条权限的展示行。 */
export interface PermissionGateRow {
  id: SystemPermissionId;
  state: SystemPermissionStatus["state"];
  /** 是否曾被拒绝过 —— 决定按钮文案是「去开启」还是「打开系统设置」。 */
  askedBefore: boolean;
  /** 刚授权但需重启。 */
  restartRequired: boolean;
  /** 该行是否已满足。 */
  satisfied: boolean;
}

/** 门禁快照：子应用渲染所需的一切。 */
export interface PermissionGateSnapshot {
  state: PermissionGateState;
  rows: PermissionGateRow[];
  /** 是否至少有一项被拒且用户试过 —— 此时应引导去系统设置而不是再弹框。 */
  needsSettings: boolean;
  /** 是否缺权限。 */
  isBlocked: boolean;
}

export interface PermissionGateOptions {
  /** 本子应用需要的权限（顺序即展示顺序）。 */
  required: readonly SystemPermissionId[];
  /**
   * 可选权限：缺了不挡主界面，只在设置页给提示。
   * 例如「摄像头」对只用屏幕的应用是可选。
   */
  optional?: readonly SystemPermissionId[];
  /** 申请时给用户看的用途说明（宿主弹框里显示）。 */
  reason?: string;
  /** 状态变化回调（含用户去系统设置手动改的情况）。 */
  onChange?: (snapshot: PermissionGateSnapshot) => void;
}

function isSatisfied(status: SystemPermissionStatus | undefined): boolean {
  if (!status) {
    return false;
  }
  // unsupported 视为「不阻塞」：平台不支持时不能把用户永久挡在门外。
  return status.state === "granted" || status.state === "unsupported";
}

/**
 * 由宿主返回的状态数组算出快照。纯函数，便于单测与在任意渲染层复用。
 */
export function resolvePermissionGateView(
  required: readonly SystemPermissionId[],
  statuses: readonly SystemPermissionStatus[],
): PermissionGateSnapshot {
  const byId = new Map(statuses.map((item) => [item.id, item]));
  const rows: PermissionGateRow[] = required.map((id) => {
    const status = byId.get(id);
    const satisfied = isSatisfied(status);
    return {
      id,
      state: status?.state ?? "denied",
      askedBefore: Boolean(status?.askedBefore),
      restartRequired: Boolean(status?.restartRequired),
      satisfied,
    };
  });

  const anyRestart = rows.some((row) => row.restartRequired);
  const anyMissing = rows.some((row) => !row.satisfied);
  // 「被拒且试过」才值得引导去系统设置；没试过就还能弹一次系统框。
  const needsSettings = rows.some((row) => !row.satisfied && row.askedBefore);

  let state: PermissionGateState;
  if (anyRestart) {
    state = "restart-required";
  } else if (anyMissing) {
    state = "blocked";
  } else {
    state = "granted";
  }

  return { state, rows, needsSettings, isBlocked: state === "blocked" };
}

/**
 * 创建一个权限门禁控制器。
 *
 * 典型用法（子应用 glue 里）：
 * ```ts
 * const gate = createPermissionGate(host.permissions, {
 *   required: ["screen.capture", "accessibility"],
 *   reason: "需要屏幕录制才能看到你的桌面",
 *   onChange: (snap) => renderPermissionView(snap),
 * });
 * await gate.check();       // 进面板时查一次
 * await gate.request();     // 用户点「去开启」
 * gate.dispose();           // 面板卸载
 * ```
 *
 * 返回 null 表示宿主不支持（旧宿主 / 非 mac），调用方应当直接放行主界面，
 * 不要把用户挡在门外。
 */
export function createPermissionGate(
  api: WorkspaceAppPermissionApi | undefined,
  options: PermissionGateOptions,
): PermissionGate | null {
  if (!api) {
    return null;
  }
  return new PermissionGate(api, options);
}

export class PermissionGate {
  private readonly api: WorkspaceAppPermissionApi;
  private readonly required: readonly SystemPermissionId[];
  private readonly reason?: string;
  private readonly onChangeCallback?: (snapshot: PermissionGateSnapshot) => void;
  private unsubscribe: (() => void) | null = null;
  private disposed = false;
  private snapshot: PermissionGateSnapshot;

  constructor(api: WorkspaceAppPermissionApi, options: PermissionGateOptions) {
    this.api = api;
    this.required = [...options.required, ...(options.optional ?? [])];
    this.reason = options.reason;
    this.onChangeCallback = options.onChange;
    // 初始态按「全部未满足」算，避免首帧把未查当成已授权而闪一下主界面。
    this.snapshot = resolvePermissionGateView(
      this.required,
      this.required.map((id) => ({ id, state: "denied" as const })),
    );
  }

  /** 当前快照（同步，随时可读）。 */
  get current(): PermissionGateSnapshot {
    return this.snapshot;
  }

  /** 查询一次（不弹框）。进面板、窗口重新激活时调。 */
  async check(): Promise<PermissionGateSnapshot> {
    if (this.disposed) {
      return this.snapshot;
    }
    try {
      const statuses = await this.api.query([...this.required]);
      return this.apply(statuses);
    } catch {
      // 查询失败不阻塞：当作未满足，让用户还能点「去开启」。
      return this.snapshot;
    }
  }

  /**
   * 申请授权。宿主负责弹框 + 深链 + 轮询，这里只等结果。
   * 返回最终快照，调用方据此决定是否放行。
   */
  async request(): Promise<PermissionGateSnapshot> {
    if (this.disposed) {
      return this.snapshot;
    }
    try {
      const statuses = await this.api.request([...this.required], this.reason);
      return this.apply(statuses);
    } catch {
      return this.snapshot;
    }
  }

  /**
   * 订阅宿主推送的状态变化。用户去系统设置里手动开关也能感知，
   * 从而自动推进（不需要用户回来点按钮）。
   */
  subscribe(): void {
    if (this.disposed || this.unsubscribe) {
      return;
    }
    this.unsubscribe = this.api.onChange((status) => {
      if (this.disposed || !this.required.includes(status.id)) {
        return;
      }
      // 合并单项更新：宿主按项推送，这里保持整份快照语义。
      const merged = this.snapshot.rows.map((row) =>
        row.id === status.id
          ? {
              id: status.id,
              state: status.state,
              askedBefore: Boolean(status.askedBefore),
              restartRequired: Boolean(status.restartRequired),
              satisfied: isSatisfied(status),
            }
          : row,
      );
      this.emit(
        resolvePermissionGateView(
          this.required,
          merged.map((row) => ({
            id: row.id,
            state: row.state,
            askedBefore: row.askedBefore,
            restartRequired: row.restartRequired,
          })),
        ),
      );
    });
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private apply(statuses: readonly SystemPermissionStatus[]): PermissionGateSnapshot {
    return this.emit(resolvePermissionGateView(this.required, statuses));
  }

  private emit(snapshot: PermissionGateSnapshot): PermissionGateSnapshot {
    this.snapshot = snapshot;
    this.onChangeCallback?.(snapshot);
    return snapshot;
  }
}
