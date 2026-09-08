// 场景：G6 Host Capability RPC 类型 — electron-module 嵌入 renderer 调宿主能力。
export type GuestHostCapabilityName =
  | "fs"
  | "dialog"
  | "spawn"
  | "pty"
  | "git"
  | "oauth.loopback"
  | "shell"
  | "theme"
  | "locale"
  | "stream"
  | "print";

export interface GuestHostCapabilityInvokeInput {
  /** 能力域，如 dialog / fs；须 manifest.guest.capabilities 已声明。 */
  capability: string;
  /** 域内方法，如 open / read。 */
  method: string;
  /** 方法参数（JSON 可序列化）。 */
  payload?: unknown;
}

export interface GuestHostCapabilityInvokeResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  code?: string;
}

export interface WorkspaceAppGuestCapabilityHostApi {
  invoke(input: GuestHostCapabilityInvokeInput): Promise<GuestHostCapabilityInvokeResult>;
  listGranted(): ReadonlyArray<string>;
}
