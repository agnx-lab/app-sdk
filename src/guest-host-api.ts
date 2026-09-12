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

export interface WorkspaceAppGuestMountInput {
  /** 专用空 host 元素（须带 data-agnx-guest-surface-host）；React 面板内 overlay 等须与其 sibling，勿共用 ref。 */
  container: HTMLElement;
  /** 覆盖 manifest.sidecar.ensureTool；默认读扫描报告。 */
  ensureTool?: string;
  /** 传给 ensure 脚本的额外参数（如 --port）。 */
  ensureArgs?: readonly string[];
  timeoutMs?: number;
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
}

export interface WorkspaceAppGuestHostApi {
  mount(input: WorkspaceAppGuestMountInput): () => void;
  mountElectronModule(input: WorkspaceAppGuestElectronModuleMountInput): () => void;
  getDiagnostics(): WorkspaceAppGuestDiagnostic | null;
  /** G6 Host Capability RPC（electron-module 嵌入面）。 */
  capability?: WorkspaceAppGuestCapabilityHostApi;
}
