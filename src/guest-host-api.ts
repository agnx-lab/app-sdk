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
   * 宿主指定的目标地址（绝对 URL），优先于 ensure 输出的 origin。
   *
   * 用于「Tab 承载子应用首页之外的站点」：子应用的 ensure 工具只会产出它自己的
   * origin，光靠 ensure 无法把面板指向别的站点。给了本字段就跳过 ensure 的
   * origin，但仍会先跑 ensure（sidecar 可能仍需拉起）。只取 origin，路径忽略。
   */
  targetUrl?: string;
  /** 覆盖 manifest.sidecar.ensureTool；默认读扫描报告。 */
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

/** `openTabOrFocus` 入参：把嵌页里点开的链接交给宿主按域名复用 Tab。 */
export interface WorkspaceAppGuestOpenTabInput {
  /** 要打开的目标地址（绝对 URL）。 */
  url: string;
  /** Tab 显示名（如站点名「四库全书」）；缺省回退站点标题 / 域名。 */
  title?: string;
  /**
   * 是否按 origin 复用同一个 Tab（默认 true）。
   * false 时每次都新建 Tab，但仍按 origin 命名。
   */
  reusesOrigin?: boolean;
}

export interface WorkspaceAppGuestHostApi {
  mount(input: WorkspaceAppGuestMountInput): () => void;
  mountElectronModule(input: WorkspaceAppGuestElectronModuleMountInput): () => void;
  getDiagnostics(): WorkspaceAppGuestDiagnostic | null;
  /** G6 Host Capability RPC（electron-module 嵌入面）。 */
  capability?: WorkspaceAppGuestCapabilityHostApi;
  /**
   * 打开或聚焦一个「承载某个站点」的子应用 Tab。
   *
   * 语义：**同 origin 复用，不同 origin 新建**，站外域名交给系统浏览器。
   * - 复用：已存在承载该 origin 的 Tab 时，把它的地址改成新 url 并聚焦，不新增 Tab。
   * - 新建：否则新开一个 Tab，标题用 `title`（缺省站点标题 → 域名）。
   * - 站外：非 http(s) 或非当前站点域名族时返回 false，由调用方交给宿主外部打开。
   *
   * @returns true 表示宿主已接管（复用或新建）；false 表示未接管，调用方须自行兜底。
   */
  openTabOrFocus?(input: WorkspaceAppGuestOpenTabInput): boolean;
}
