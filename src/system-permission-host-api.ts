// 场景：子应用系统级权限（屏幕录制 / 辅助功能 / 摄像头…）的 host.* 合同。
//
// 设计依据：`系统权限_最短路径交互设计与实现方案.md` §5.1。
// 最短路径原则：用户只点两次 —— 弹框「去开启」→ 宿主深链到 macOS 对应面板 →
// 用户勾选 Agnx → 宿主轮询检测到 granted 后自动推进（子应用无需再点「我已开启」）。

/**
 * 系统权限 ID。命名与 macOS 面板一一对应：
 * - `screen.capture` 屏幕录制（`Privacy_ScreenCapture`）
 * - `accessibility` 辅助功能（`Privacy_Accessibility`）
 * - `camera` 摄像头（`Privacy_Camera`）
 * - `microphone` 麦克风（`Privacy_Microphone`）
 * - `full-disk` 完全磁盘访问（`Privacy_AllFiles`）
 */
export type SystemPermissionId =
  | "screen.capture"
  | "accessibility"
  | "camera"
  | "microphone"
  | "full-disk";

export const SYSTEM_PERMISSION_IDS: readonly SystemPermissionId[] = [
  "screen.capture",
  "accessibility",
  "camera",
  "microphone",
  "full-disk",
] as const;

/** 单项权限状态。 */
export interface SystemPermissionStatus {
  id: SystemPermissionId;
  /** granted 已授权 / denied 被拒或未开 / unsupported 平台不支持或子应用未声明 */
  state: "granted" | "denied" | "unsupported";
  /** 是否已在系统里被用户显式拒绝过（宿主侧记录，用于决定要不要再弹） */
  askedBefore?: boolean;
  /**
   * 用户刚在系统面板授权、但本进程仍读不到（macOS 常见：需重启 App 生效）。
   * 为 true 时宿主 UI 引导「重启 Agnx 生效」，不要显示成 denied。
   */
  restartRequired?: boolean;
}

/**
 * `host.permissions` 合同（可选能力）。
 *
 * 子应用必须按可选处理：未升级宿主时 `host.permissions` 为 undefined。
 */
export interface WorkspaceAppPermissionApi {
  /** 查询当前状态（不弹框、不写记录）。 */
  query(ids: SystemPermissionId[]): Promise<SystemPermissionStatus[]>;
  /**
   * 申请：宿主弹框说明用途 → 用户点「去开启」→ 深链系统面板 + 轮询（1s / 120s 超时）→
   * 返回最终状态。子应用拿到 `granted` 后直接继续，不需要用户再回来点按钮。
   */
  request(ids: SystemPermissionId[], reason?: string): Promise<SystemPermissionStatus[]>;
  /** 监听状态变化（用户去系统设置里手动改了也能感知）。返回取消订阅。 */
  onChange(listener: (status: SystemPermissionStatus) => void): () => void;
}
