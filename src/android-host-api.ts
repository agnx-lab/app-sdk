// 场景：App SDK Android Host Services 公共类型（Phase A 合同草案；无运行时实现）。
// 权威说明见 docs/Android主机服务合同_android-host-services-contract.md

/** Android Host capability；运行时按 appId 解析，缺权拒绝。 */
export type AndroidHostCapability =
  | "android.discover"
  | "android.connect"
  | "android.session"
  | "android.input"
  | "android.inspect"
  | "android.shell"
  | "android.files"
  | "android.screenshot"
  | "android.stream"
  | "android.audio"
  | "android.logcat"
  | "android.openTab";

export type AndroidHostDeviceState = "device" | "offline" | "unauthorized" | "unknown";

export interface AndroidHostDevice {
  id: string;
  state: AndroidHostDeviceState;
  label: string;
  model?: string;
  product?: string;
  device?: string;
  transportId?: string;
  /** 展示用；列表去重真相在 daemon。 */
  transport?: "usb" | "wifi" | "unknown";
}

export type AndroidHostSessionStatus = "idle" | "creating" | "ready" | "closing" | "error";

export type AndroidHostStreamTransport = "base64" | "binary" | "h264";
export type AndroidHostStreamQuality = "auto" | "high" | "medium" | "low";

export interface AndroidHostSession {
  sessionId: string;
  deviceId: string;
  deviceLabel: string;
  status: AndroidHostSessionStatus;
  /** 无 `android.stream` 时 Host 可省略。 */
  stream?: {
    url: string;
    transport: AndroidHostStreamTransport;
  };
  viewportWidth?: number;
  viewportHeight?: number;
  lastLatencyMs?: number;
  error?: string;
}

export type AndroidHostErrorCode =
  | "unavailable"
  | "permission_denied"
  | "device_not_found"
  | "session_not_found"
  | "command_failed"
  | "timeout"
  | "unsupported";

export interface AndroidHostErrorShape {
  code: AndroidHostErrorCode;
  message: string;
  details?: unknown;
}

/**
 * 稳定对外命令面（与 daemon AndroidCommand 对齐）。
 * 未知 action 由 Host 拒绝为 unsupported，不把 server passthrough 泄漏给第三方。
 */
export type AndroidHostCommand =
  | { action: "navigate_home" }
  | { action: "navigate_back" }
  | { action: "navigate_recents" }
  | { action: "rotate"; orientation?: 0 | 1 | 2 | 3 }
  | { action: "screen_toggle" }
  | { action: "screen_timeout"; timeoutMs: number }
  | { action: "keyboard_toggle" }
  | { action: "input_keyevent"; keycode: string }
  | { action: "input_tap"; x: number; y: number }
  | { action: "input_long_press"; x: number; y: number; durationMs?: number }
  | {
      action: "input_swipe";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs?: number;
    }
  | { action: "input_touch_down"; x: number; y: number }
  | { action: "input_touch_move"; x: number; y: number }
  | { action: "input_touch_up"; x: number; y: number }
  | { action: "input_text"; text: string }
  | { action: "screenshot" }
  | { action: "inspect_interactive_elements"; maxCount?: number }
  | { action: "inspect_ui_hierarchy" }
  | { action: "shell_exec"; command: string; timeoutMs?: number }
  | {
      action: "apk_install";
      apkPath: string;
      replace?: boolean;
      grantAllPermissions?: boolean;
    }
  | { action: "push_file"; localPath: string; remotePath?: string }
  | { action: "close" };

export interface AndroidHostUiBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface AndroidHostInteractiveElement {
  index: number;
  text?: string;
  contentDesc?: string;
  hint?: string;
  resourceId?: string;
  className?: string;
  packageName?: string;
  xpath?: string;
  bounds: AndroidHostUiBounds;
  center: { x: number; y: number };
  clickable?: boolean;
  longClickable?: boolean;
  checkable?: boolean;
  checked?: boolean;
  enabled?: boolean;
  focusable?: boolean;
  focused?: boolean;
  scrollable?: boolean;
  selected?: boolean;
  editable?: boolean;
  visibleToUser?: boolean;
}

export interface AndroidHostUiNode {
  xpath: string;
  className?: string;
  resourceId?: string;
  text?: string;
  contentDesc?: string;
  hint?: string;
  packageName?: string;
  bounds?: AndroidHostUiBounds;
  center?: { x: number; y: number };
  clickable?: boolean;
  longClickable?: boolean;
  checkable?: boolean;
  checked?: boolean;
  enabled?: boolean;
  focusable?: boolean;
  focused?: boolean;
  scrollable?: boolean;
  selected?: boolean;
  editable?: boolean;
  visibleToUser?: boolean;
  children: AndroidHostUiNode[];
}

export interface AndroidHostCommandResult {
  ok: boolean;
  output?: string;
  screenshotDataUrl?: string;
  installStatus?: "success" | "failed";
  remotePath?: string;
  interactiveElements?: AndroidHostInteractiveElement[];
  uiXml?: string;
  uiHierarchy?: AndroidHostUiNode[];
  error?: AndroidHostErrorShape;
}

export interface AndroidHostSessionLogEntry {
  id: string;
  ts: number;
  level: "info" | "warning" | "error";
  message: string;
  detail?: string;
  event?: "session" | "command_start" | "command_done" | "command_failed";
  command?: AndroidHostCommand;
}

export interface AndroidHostLogcatLine {
  id: number;
  ts: number;
  text: string;
  tag?: string;
  level?: string;
}

/**
 * 帧回调。v1 主路径为 raster（dataUrl 和/或 bytes）；
 * h264 raw 为 advanced，不得作为唯一必选合同。
 */
export interface AndroidHostFrame {
  ts: number;
  transport: AndroidHostStreamTransport;
  /** 主路径：可直接展示的 raster data URL。 */
  dataUrl?: string;
  /** 可选原始字节（binary / 已解 h264 帧等，实现阶段再钉死语义）。 */
  bytes?: ArrayBuffer;
  viewportWidth?: number;
  viewportHeight?: number;
  latencyMs?: number;
}

export interface AndroidHostFrameStatus {
  viewportWidth?: number;
  viewportHeight?: number;
  lastLatencyMs?: number;
  error?: string;
}

export interface AndroidHostSubscribeDevicesInput {
  onDevices: (devices: readonly AndroidHostDevice[]) ***REMOVED*** void;
  onError?: (error: AndroidHostErrorShape) ***REMOVED*** void;
}

export interface AndroidHostSubscribeFrameStreamInput {
  sessionId: string;
  transport?: AndroidHostStreamTransport;
  quality?: AndroidHostStreamQuality;
  fps?: number;
  /** 非当前焦点时应降帧；由调用方声明，Host 可再限速。 */
  active?: boolean;
  onFrame: (frame: AndroidHostFrame) ***REMOVED*** void;
  onStatus?: (status: AndroidHostFrameStatus) ***REMOVED*** void;
  onError?: (error: AndroidHostErrorShape) ***REMOVED*** void;
}

export interface AndroidHostOpenTabInput {
  deviceId?: string;
  serverId?: string;
  workspaceId?: string;
  currentPathname?: string | null;
}

export interface AndroidHostOpenTabResult {
  androidId: string;
  opened: boolean;
}

/**
 * 可选领域 Host：Android 设备发现 / 会话 / 命令 / 帧流。
 * 仅桌面 Electron 完整可用；非桌面为 undefined 或方法返回 unavailable。
 *
 * @see docs/Android主机服务合同_android-host-services-contract.md
 */
export interface WorkspaceAppAndroidHostApi {
  listDevices(): Promise<AndroidHostDevice[]>;
  subscribeDevices(input: AndroidHostSubscribeDevicesInput): () ***REMOVED*** void;

  connectDevice(input: { endpoint: string }): Promise<{ ok: boolean; message?: string }>;
  pairDevice(input: {
    endpoint: string;
    pairingCode: string;
  }): Promise<{ ok: boolean; message?: string }>;
  enableTcpip(input: {
    deviceId: string;
    port?: number;
  }): Promise<{ ok: boolean; endpoint?: string; message?: string }>;
  disconnectDevice(input: {
    endpointOrDeviceId: string;
  }): Promise<{ ok: boolean; message?: string }>;

  createSession(input?: { deviceId?: string }): Promise<AndroidHostSession>;
  closeSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<AndroidHostSession | null>;
  getSessionLogs(sessionId: string): Promise<AndroidHostSessionLogEntry[]>;

  runCommand(sessionId: string, command: AndroidHostCommand): Promise<AndroidHostCommandResult>;

  subscribeFrameStream(input: AndroidHostSubscribeFrameStreamInput): () ***REMOVED*** void;

  /**
   * 设备音频转发开关（D5）。
   * v1：daemon 启停本机 scrcpy `--no-video` 仅音频子进程；需 PATH 或 `AGNX_SCRCPY_PATH`。
   */
  setAudioEnabled?(input: {
    sessionId: string;
    enabled: boolean;
  }): Promise<{ ok: boolean; error?: AndroidHostErrorShape }>;

  logcat: {
    start(sessionId: string): Promise<void>;
    stop(sessionId: string): Promise<void>;
    clear(sessionId: string): Promise<void>;
    getLines(input: {
      sessionId: string;
      afterId?: number;
      limit?: number;
    }): Promise<AndroidHostLogcatLine[]>;
    /** 可选轮询封装；v1 可仅 getLines + App 自轮询。 */
    subscribe?(input: {
      sessionId: string;
      intervalMs?: number;
      onLines: (lines: readonly AndroidHostLogcatLine[]) ***REMOVED*** void;
      onError?: (error: AndroidHostErrorShape) ***REMOVED*** void;
    }): () ***REMOVED*** void;
  };

  /** 将本地/托管文件 stage 到 daemon 可安装路径。 */
  stageLocalFile?(input: {
    sourceUriOrPath: string;
    fileName?: string;
  }): Promise<{ stagedPath: string }>;

  /**
   * 打开系统 Android 工作区 Tab（保留 kind:"android" 多实例）。
   * 对标 openBrowserTab；无权限或非桌面时不应暴露或返回 opened:false。
   */
  openTab?(input?: AndroidHostOpenTabInput): AndroidHostOpenTabResult;
}

/** action → 所需 capability（runCommand 内二次校验）。 */
export const ANDROID_HOST_COMMAND_CAPABILITY: Record<
  AndroidHostCommand["action"],
  AndroidHostCapability
> = {
  navigate_home: "android.input",
  navigate_back: "android.input",
  navigate_recents: "android.input",
  rotate: "android.input",
  screen_toggle: "android.input",
  screen_timeout: "android.input",
  keyboard_toggle: "android.input",
  input_keyevent: "android.input",
  input_tap: "android.input",
  input_long_press: "android.input",
  input_swipe: "android.input",
  input_touch_down: "android.input",
  input_touch_move: "android.input",
  input_touch_up: "android.input",
  input_text: "android.input",
  screenshot: "android.screenshot",
  inspect_interactive_elements: "android.inspect",
  inspect_ui_hierarchy: "android.inspect",
  shell_exec: "android.shell",
  apk_install: "android.files",
  push_file: "android.files",
  close: "android.session",
};

export function androidHostCapabilityForCommand(
  command: AndroidHostCommand,
): AndroidHostCapability {
  return ANDROID_HOST_COMMAND_CAPABILITY[command.action];
}
