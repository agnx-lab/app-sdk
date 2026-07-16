// 场景：宿主注入给外置 Mini-App 的运行时 API（通用；与具体行业 App 无关）。
//
// 第三方 / AI skill 只需依赖本包：`npm i @getagnx/app-sdk`，实现 `activate(host)`，
// 把产物放到 `$AGNX_HOME/apps/<appId>/`。不要 import `@getagnx/app` 内部路径。
import type {
  WorkspaceAppCommandContribution,
  WorkspaceAppItemMenuContribution,
  WorkspaceAppItemProviderContribution,
  WorkspaceAppListItem,
  WorkspaceAppMiniAppContribution,
  WorkspaceAppPrimarySegmentContribution,
  WorkspaceAppShortcutContribution,
} from "./types";

/** 命令 / 快捷键 `run` 时宿主传入的上下文（可能缺字段）。 */
export interface WorkspaceAppRunContext {
  serverId?: string;
  workspaceId?: string;
  currentPathname?: string | null;
}

/**
 * 经宿主托管后的文件引用。
 * - `uri` 通常是 `$AGNX_HOME/apps/data/<appId>/…` 或兼容期的 desktop-attachments 绝对路径
 * - 播放 / 预览前请调用 `host.files.resolveObjectUrl`
 */
export interface WorkspaceAppManagedFile {
  title: string;
  /** 托管路径或 blob:/http(s): URI。 */
  uri: string;
  mimeType?: string;
  /** local = 本机导入；remote = 网络资源（若宿主支持）。 */
  origin?: "local" | "remote";
}

/**
 * 选文件并导入托管目录的选项。
 * 过滤条件由 **App** 决定（例如音乐传 `extensions: ["mp3"]`）；SDK 不内置行业语义。
 */
export interface WorkspaceAppPickFilesInput {
  title?: string;
  multiple?: boolean;
  /** 扩展名不带点，如 `["mp3","png","pdf"]`。 */
  extensions?: readonly string[];
  /** Web `<input accept>`，如 `audio/*` 或 `image/*`。 */
  accept?: string;
  filterLabel?: string;
  /**
   * 写入该 App 的数据根（`$AGNX_HOME/apps/data/<appId>/files/`）。
   * 强烈建议外置 App 传入自己的 `manifest.id`，以便卸载时可选清数据且跨重启可播放。
   */
  appId?: string;
}

/** App 运行时数据路径合同（与 `$AGNX_HOME/apps/<id>` 代码根分离）。 */
export interface WorkspaceAppStorageApi {
  /**
   * 返回 `$AGNX_HOME/apps/data/<appId>/`（保证目录存在）。
   * App 应把数据库、用户上传等写入此树，**不要**写进 `apps/<id>/`。
   */
  getDataRoot(appId: string): Promise<string>;
  /**
   * 删除该 App 数据根（可选在卸载流程里调用）。
   * 不会删除 `apps/<id>` 代码目录。
   */
  clearData(appId: string): Promise<void>;
  /**
   * 读写 JSON 文档（落在 `apps/data/<appId>/state/<key>.json`）。
   * 经 daemon 时 Web / Native / Desktop 共享同一真相源（对齐项目/对话等四视图）。
   * `key` 仅允许 `[A-Za-z0-9._-]+`。
   */
  readJson(appId: string, key: string): Promise<unknown | null>;
  writeJson(appId: string, key: string, value: unknown): Promise<void>;
}

/** 可选跨端实时同步（§10.7）：存储 ≠ 同步；未接入则零流量。 */
export interface WorkspaceAppSyncEvent {
  appId: string;
  channel: string;
  revision: string | number;
  publisherClientId?: string;
  payload?: unknown;
}

export interface WorkspaceAppSyncApi {
  /** 写完 storage 后发布 revision ping；daemon 扇出到其他已连接端。 */
  publish(input: {
    appId: string;
    channel: string;
    revision: string | number;
    payload?: unknown;
  }): void;
  /** 订阅本 App（可选 channel）事件；返回取消订阅。 */
  subscribe(input: {
    appId: string;
    channel?: string;
    onEvent: (event: WorkspaceAppSyncEvent) ***REMOVED*** void;
  }): () ***REMOVED*** void;
}

/**
 * 宿主实现的完整表面。外置 `main` 只允许依赖本接口。
 *
 * @example
 * ```ts
 * import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
 *
 * export function activate(host: WorkspaceAppHostApi) {
 *   host.registerPrimarySegment({ id: "demo", appId: "com.example.demo", label: "Demo", order: 60 });
 * }
 * ```
 */
export interface WorkspaceAppHostApi {
  /** 注册侧栏 / 命令面板「主视图」分段。 */
  registerPrimarySegment(contribution: WorkspaceAppPrimarySegmentContribution): void;
  /** 注册主视图下列表数据源。 */
  registerItemProvider(contribution: WorkspaceAppItemProviderContribution): void;
  /** 注册命令面板可搜索命令。 */
  registerCommand(contribution: WorkspaceAppCommandContribution): void;
  /** 注册 Mini-App Tab 面板（自定义 React 组件）。 */
  registerMiniApp(contribution: WorkspaceAppMiniAppContribution): void;
  /** 注册列表项菜单（侧栏 / 命令面板宿主壳注入）。 */
  registerItemMenu(contribution: WorkspaceAppItemMenuContribution): void;
  /** 注册快捷键（合并进宿主帮助面板；优先 `workspace.app.*` actionId）。 */
  registerShortcut(contribution: WorkspaceAppShortcutContribution): void;
  /**
   * 列表项打开 Tab 前的准备回调（按 appId）。
   * 例如 Music 在打开单例播放器 Tab 前先 `setNowPlaying(itemId)`。
   */
  registerListItemOpenPreparer(appId: string, preparer: (itemId: string) ***REMOVED*** void): () ***REMOVED*** void;

  /** 在当前工作区打开 Mini-App Tab。 */
  openMiniAppTab(input: {
    appId: string;
    panelId: string;
    entityId?: string;
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }): boolean;

  /** 切换侧栏主视图到某分段 id（如 `"music"`）。 */
  requestPrimaryView(segmentId: string): void;

  /**
   * 通用文件 Host Service。
   * 选文件 / 解析可读 URI；过滤扩展名由调用方传入。
   */
  files: {
    pickAndImport(input?: WorkspaceAppPickFilesInput): Promise<WorkspaceAppManagedFile[]>;
    resolveObjectUrl(uri: string): Promise<string>;
  };

  /** 运行时数据根（默认 `$AGNX_HOME/apps/data/<appId>`）。 */
  storage: WorkspaceAppStorageApi;

  /**
   * 可选跨端实时同步（§10.7）。
   * 需要对话级三端即时更新时再接；未提供 / 未调用则仅 storage 落盘。
   */
  sync?: WorkspaceAppSyncApi;

  /** 平台门控摘要（避免 App 依赖宿主 constants）。 */
  platform: {
    isWeb: boolean;
  };
}

/** 磁盘 / workspace 包入口须导出的模块形状。 */
export interface WorkspaceAppModule {
  appId: string;
  activate(host: WorkspaceAppHostApi): void | Promise<void>;
}

export type { WorkspaceAppListItem };
