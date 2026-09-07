// 场景：Guest Surface Host API 类型 — Sub App 嵌入上游 Web UI 的合同面。
export type WorkspaceAppGuestKind = "none" | "web" | "native-bridge";

export type WorkspaceAppGuestAuth = "none" | "url-token-then-cookie" | "bearer" | "custom";

export type WorkspaceAppGuestPreferStrategy =
  | "auto"
  | "direct-iframe"
  | "proxied-iframe"
  | "guest-webview";

export type WorkspaceAppGuestResolvedStrategy =
  | "direct-iframe"
  | "proxied-iframe"
  | "guest-webview"
  | "native-bridge"
  | "unsupported";

export interface WorkspaceAppGuestManifestLite {
  kind?: WorkspaceAppGuestKind;
  auth?: WorkspaceAppGuestAuth;
  capabilities?: ReadonlyArray<"websocket" | "sse" | "cookies">;
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

export interface WorkspaceAppGuestReadyDetail {
  strategy: WorkspaceAppGuestResolvedStrategy;
  origin: string;
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
  getDiagnostics(): WorkspaceAppGuestDiagnostic | null;
}
