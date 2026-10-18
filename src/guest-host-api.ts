// 场景：Guest Surface Host API 类型 — Sub App 嵌入上游 Web UI / electron-module 的合同面。
import type { WorkspaceAppGuestCapabilityHostApi } from "./guest-capability-host-api";
export type WorkspaceAppGuestKind = "none" | "web" | "native-bridge" | "electron-module";

export type WorkspaceAppGuestAuth = "none" | "url-token-then-cookie" | "bearer" | "custom";

export type WorkspaceAppGuestPreferStrategy =
  | "auto"
  | "direct-iframe"
  | "proxied-iframe"
  | "guest-webview"
  | "electron-module";

export type WorkspaceAppGuestResolvedStrategy =
  | "direct-iframe"
  | "proxied-iframe"
  | "guest-webview"
  | "electron-module"
  | "native-bridge"
  | "unsupported";

export interface WorkspaceAppRuntimeSidecarManifestLite {
  id: string;
  ensureTool: string;
  stateFile: string;
  kind?: "python-gateway" | "node-host" | "rust-binary" | "generic";
  healthKind?: "http" | "framed-ipc" | "process";
}

export interface WorkspaceAppRuntimeManifestLite {
  sidecars?: ReadonlyArray<WorkspaceAppRuntimeSidecarManifestLite>;
}

export interface WorkspaceAppGuestManifestLite {
  kind?: WorkspaceAppGuestKind;
  auth?: WorkspaceAppGuestAuth;
  /** L8 传输能力（websocket/sse/cookies）或 G6 Host Capability 名（fs/dialog/…）。 */
  capabilities?: ReadonlyArray<string>;
  module?: string;
  rendererEntry?: string;
  preferStrategy?: WorkspaceAppGuestPreferStrategy;
}

export type WorkspaceAppGuestSurfaceState = "idle" | "mounting" | "ready" | "error" | "load-slow";

export interface WorkspaceAppGuestMountInput {
  /** 专用空 host 元素（须带 data-agnx-guest-surface-host）；React 面板内 overlay 等须与其 sibling，勿共用 ref。 */
  container: HTMLElement;
  /**
   * 加载方式之一：直接加载这个网址（绝对 URL，**不跑 ensure、不拉任何后台**）。
   *
   * 面板自己决定本 Tab 要不要后台：
   * - 要走本子应用的后台 → 传 `ensureTool`，宿主跑它拿 origin；
   * - 不需要后台、就是一张现成网页 → 传 `targetUrl`，宿主原样加载。
   *
   * 两个都传时 `targetUrl` 优先（后台可能仍需拉起时自行为之）。只取 origin，路径忽略。
   */
  targetUrl?: string;
  /**
   * 加载方式之一：跑这个 ensure 工具拉起后台，用它的 origin 加载（缺省读扫描报告里的
   * manifest.sidecar.ensureTool）。与 `targetUrl` 二选一。
   */
  ensureTool?: string;
  /** 传给 ensure 脚本的额外参数（如 --port）。 */
  ensureArgs?: readonly string[];
  timeoutMs?: number;
  /**
   * iframe/webview 首屏 load 等待上限（默认 20s）。
   * 超时仍回调 onReady，但诊断 surfaceState=load-slow；失败码走 onError。
   */
  surfaceReadyTimeoutMs?: number;
  /**
   * 挂载期是否由宿主注入品牌 Logo 扫光遮罩（默认 true）。
   * 全 Guest 子应用统一过渡；Panel 勿再叠纯文字「正在启动…」。
   */
  bootOverlay?: boolean;
  /** 遮罩主文案；默认「正在启动 {manifest.name}…」。 */
  bootTitle?: string;
  /** 挂载相位（ensure / proxy / surface-load）；Panel 可跟相位改辅文案。 */
  onPhase?: (phase: string) => void;
  /**
   * 表面已可交互（iframe load / webview dom-ready，或超时软放行）。
   * 勿在 ensure 完成瞬间撤遮罩，否则易见空白或上游「连接中」。
   */
  onReady?: (detail: WorkspaceAppGuestReadyDetail) => void;
  onError?: (error: WorkspaceAppGuestErrorDetail) => void;
}

export interface WorkspaceAppGuestElectronModuleMountInput {
  /** 专用空 host 元素（须带 data-agnx-guest-module-host）。 */
  container: HTMLElement;
  /** 覆盖 manifest.guest.rendererEntry；ensure 成功时以 ensure 输出为准。 */
  rendererEntry?: string;
  /** 覆盖 runtime.sidecars[0].ensureTool；未配置时跳过 ensure，直接绿屏占位。 */
  ensureTool?: string;
  ensureArgs?: readonly string[];
  timeoutMs?: number;
  onReady?: (detail: WorkspaceAppGuestElectronModuleReadyDetail) => void;
  onError?: (error: WorkspaceAppGuestErrorDetail) => void;
}

export interface WorkspaceAppGuestReadyDetail {
  strategy: WorkspaceAppGuestResolvedStrategy;
  origin: string;
  reused?: boolean;
}

export interface WorkspaceAppGuestElectronModuleReadyDetail {
  strategy: "electron-module";
  rendererEntry: string;
  /** ensure 输出的上游 preload 绝对路径（GenOffice agnx-embed 等）。 */
  preloadPath?: string;
  reused?: boolean;
}

export interface WorkspaceAppGuestErrorDetail {
  code: string;
  message: string;
  strategy?: WorkspaceAppGuestResolvedStrategy;
}

export interface WorkspaceAppGuestDiagnostic {
  appId: string;
  strategy: WorkspaceAppGuestResolvedStrategy | null;
  origin: string | null;
  auth: WorkspaceAppGuestAuth;
  lastError: WorkspaceAppGuestErrorDetail | null;
  /** 当前相位（如 mount.ensure / mount.surface-load）。 */
  phase: string | null;
  /** 最近相位轨迹（有界，供 AI 复制）。 */
  phaseTrail: readonly string[];
  ensureTool: string | null;
  /** proxied-iframe 会话 id；direct/webview 为 null。 */
  proxySid: string | null;
  /** 单次 mount 相关 id，对齐 Host 观测 detail。 */
  correlationId: string | null;
  surfaceState: WorkspaceAppGuestSurfaceState;
  updatedAt: string;
}

export interface WorkspaceAppGuestHostApi {
  mount(input: WorkspaceAppGuestMountInput): () => void;
  mountElectronModule(input: WorkspaceAppGuestElectronModuleMountInput): () => void;
  getDiagnostics(): WorkspaceAppGuestDiagnostic | null;
  /** G6 Host Capability RPC（electron-module 嵌入面）。 */
  capability?: WorkspaceAppGuestCapabilityHostApi;
}
