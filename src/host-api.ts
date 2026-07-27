// 场景：宿主注入给外置 Mini-App 的运行时 API（通用；与具体行业 App 无关）。
//
// 第三方 / AI skill 只需依赖本包：`npm i @getagnx/app-sdk`，实现 `activate(host)`，
// 把产物放到 `$AGNX_HOME/apps/<appId>/`。不要 import `@getagnx/app` 内部路径。
import type {
  WorkspaceAppCommandContribution,
  WorkspaceAppIcon,
  WorkspaceAppItemMenuContribution,
  WorkspaceAppItemProviderContribution,
  WorkspaceAppListItem,
  WorkspaceAppMiniAppContribution,
  WorkspaceAppOrganizeContribution,
  WorkspaceAppPrimarySegmentContribution,
  WorkspaceAppShortcutContribution,
  WorkspaceAppTabContextMenuContribution,
} from "./types";
import type { WorkspaceAppAndroidHostApi } from "./android-host-api";

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
  /** 落盘字节数；下载成功时应 > 0。 */
  byteSize?: number;
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

/** 将网络资源托管到 `$AGNX_HOME/apps/data/<appId>/files/`。 */
export interface WorkspaceAppImportRemoteFileInput {
  appId: string;
  url: string;
  title?: string;
  fileName?: string;
  mimeType?: string;
}

/** 将内存字节写入 `$AGNX_HOME/apps/data/<appId>/files/`（剪贴板粘贴图片等）。 */
export interface WorkspaceAppImportBytesInput {
  appId: string;
  /** base64 编码的文件内容。 */
  bytesBase64: string;
  title?: string;
  fileName?: string;
  mimeType?: string;
}

/** 将本机已有文件拷入 `$AGNX_HOME/apps/data/<appId>/files/`（file:// 剪贴板图等）。 */
export interface WorkspaceAppImportPathInput {
  appId: string;
  /** 本机绝对路径（不要 file:// 前缀）。 */
  sourcePath: string;
  title?: string;
  fileName?: string;
}

/** 宿主剪贴板中的位图（Electron 主进程读取，绕开渲染进程 DataTransfer 丢图）。 */
export interface WorkspaceAppClipboardImage {
  bytesBase64: string;
  mimeType: string;
  fileName?: string;
}

/** 宿主级粘贴快照：text/html + 位图 + uri-list。 */
export interface WorkspaceAppClipboardPastePayload {
  textPlain: string;
  textHtml: string;
  uriList: string;
  images: WorkspaceAppClipboardImage[];
  /** 可选：availableFormats，便于诊断。 */
  formats?: string[];
}

/** 选目录（桌面对话框；非桌面返回 null）。 */
export interface WorkspaceAppPickDirectoryInput {
  title?: string;
  defaultPath?: string;
}

/** 把多份托管本地文件打成 ZIP 写入用户选定目录。 */
export interface WorkspaceAppExportZipInput {
  /** 导出 ZIP 文件名，可无 `.zip` 后缀。 */
  fileName: string;
  entries: readonly { name: string; uri: string }[];
  title?: string;
}

export interface WorkspaceAppExportZipResult {
  path: string;
  byteSize: number;
  entryCount: number;
}

export interface WorkspaceAppDeleteUrisResult {
  deleted: string[];
  skipped: string[];
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

export type WorkspaceAppConfigScope = "global" | "app";

export interface WorkspaceAppConfigChangeEvent<T = unknown> {
  scope: WorkspaceAppConfigScope;
  appId?: string;
  key: string;
  value: T;
  revision: string | number;
  source: "local" | "remote" | "hydrate";
}

export interface WorkspaceAppConfigApi {
  /** 读取配置 JSON；`app` scope 缺值时可回退 `global`，再回退 defaultValue。 */
  get<T = unknown>(input: {
    scope: WorkspaceAppConfigScope;
    appId?: string;
    key: string;
    defaultValue?: T;
  }): Promise<T>;
  /** 写入配置 JSON；宿主负责写后发出 sync revision ping。 */
  set<T = unknown>(input: {
    scope: WorkspaceAppConfigScope;
    appId?: string;
    key: string;
    value: T;
  }): Promise<void>;
  /** 订阅配置变化；返回取消订阅。 */
  subscribe<T = unknown>(input: {
    scope: WorkspaceAppConfigScope;
    appId?: string;
    key: string;
    defaultValue?: T;
    emitCurrent?: boolean;
    listener: (event: WorkspaceAppConfigChangeEvent<T>) ***REMOVED*** void;
  }): () ***REMOVED*** void;
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
 * 操作栏布局（与宿主 ActionBarLayout 对齐）：
 * bar = 外露；overflow = 更多菜单；hidden = 不显示。
 */
export interface WorkspaceAppActionBarLayout {
  bar: string[];
  overflow: string[];
  hidden?: string[];
  /**
   * 外露 bar 是否同时显示图标与文案（「显示完整」）。
   * 与宿主 ActionBarLayout.showBarLabels 对齐；默认 false（仅图标）。
   * 接入方即使当前 UI 不渲染文案，也应完整透传保存，避免公共编辑布局失效。
   */
  showBarLabels?: boolean;
}

export interface WorkspaceAppActionLayoutItem {
  id: string;
  label: string;
  /** 编辑布局列表 leading；传 Lucide 组件，由宿主渲染 */
  icon?: WorkspaceAppIcon;
  /** 是否允许在编辑布局里隐藏；默认 true */
  canHide?: boolean;
}

/** 编辑布局附加段（壳层 / 实体等多段合同）。 */
export interface WorkspaceAppActionLayoutSecondarySection {
  /** 稳定键；写入 onSave 时用于区分；默认 `secondary` */
  id?: string;
  title: string;
  layout: WorkspaceAppActionBarLayout;
  defaultLayout: WorkspaceAppActionBarLayout;
  items: WorkspaceAppActionLayoutItem[];
  onSave: (layout: WorkspaceAppActionBarLayout) ***REMOVED*** void;
}

export interface WorkspaceAppCustomizeActionLayoutInput {
  title?: string;
  /**
   * 主段布局（多段时通常为「壳层」；单段时即唯一段）。
   * 与 secondarySection 同时传入时，弹层按「主段 → 分割线 → 附加段」渲染。
   */
  layout: WorkspaceAppActionBarLayout;
  defaultLayout: WorkspaceAppActionBarLayout;
  items: WorkspaceAppActionLayoutItem[];
  /** 主段标题；多段时显示在主段列表上方 */
  sectionTitle?: string;
  enableVisibilityToggle?: boolean;
  onSave: (layout: WorkspaceAppActionBarLayout) ***REMOVED*** void;
  onClose?: () ***REMOVED*** void;
  /** 附加段（实体菜单等）；与主段各自独立 bar/overflow/hidden，不可跨段拖拽 */
  secondarySection?: WorkspaceAppActionLayoutSecondarySection;
  /**
   * 编辑布局底部「详情」——打开宿主 view-detail 风格信息 sheet。
   * Mini-App 只提供回调；弹层由宿主渲染。
   */
  detailAction?: {
    label?: string;
    onPress: () ***REMOVED*** void;
  };
}

export interface WorkspaceAppDetailRow {
  label: string;
  value: string;
  helpText?: string;
  /** 有则宿主渲染此节点代替纯文本 value（如氛围色操作区）。 */
  valueContent?: unknown;
}

export interface WorkspaceAppOpenDetailSheetInput {
  title: string;
  rows: WorkspaceAppDetailRow[];
}

/** Mini-App 向宿主 View details 追加的行（可含自定义值区 ReactNode）。 */
export interface WorkspaceAppDetailSheetExtraRow {
  label: string;
  value: string;
  helpText?: string;
  /** 有则宿主渲染此节点代替纯文本 value（行内即时保存，无整页保存按钮）。 */
  valueContent?: unknown;
}

export interface WorkspaceAppRegisterDetailSheetExtrasInput {
  appId: string;
  buildRows: () ***REMOVED*** ReadonlyArray<WorkspaceAppDetailSheetExtraRow>;
}

/** 瞬时快捷键（按顺序分配 Option/Alt 1–n），用于操作栏悬停提示。 */
export interface WorkspaceAppTransientShortcutInput {
  id: string;
  label: string;
  run: () ***REMOVED*** void;
}

export interface WorkspaceAppTransientShortcutSession {
  /** 含快捷键提示的悬停 / title 文案，如「置顶 (⌥1)」；会反映 Rebind */
  getTitle: (id: string) ***REMOVED*** string;
  /** 当前生效的键帽序列（含改绑），供 tip 渲染 */
  getShortcutKeys: (id: string) ***REMOVED*** readonly string[] | undefined;
  dispose: () ***REMOVED*** void;
}

export interface WorkspaceAppTransientShortcutRegisterOptions {
  /**
   * 仅当返回 true 时消费 ⌥/Alt+1–9。
   * 用于「当前焦点 Tab 独占」：未激活时不得抢其它 Tab（如 Android）的同名快捷键。
   */
  isActive?: () ***REMOVED*** boolean;
  /**
   * 写入全局 Shortcuts 帮助面板，并注册可 Rebind 的 `registerShortcut` 绑定。
   * 需同时传 `appId`。
   */
  helpSection?: {
    id: string;
    title: string;
  };
  /** 与 helpSection 配对；用于贡献注册 / 卸载。 */
  appId?: string;
}

/** 更多菜单行（与工具栏 overflow 同源数据结构）。 */
export type WorkspaceAppMenuItem =
  | { type: "separator" }
  | {
      type: "item";
      id: string;
      label: string;
      /** 传 Lucide 组件；宿主渲染为 leading，禁止 Mini-App 自造菜单行 */
      icon?: WorkspaceAppIcon;
      /**
       * 与栏上同一数据源的强调态（如已置顶）：宿主用 accent 着色/填充 leading，
       * 避免菜单内永远 muted、栏上却高亮的不一致。
       */
      active?: boolean;
      /** 危险操作（删除等）：宿主用 destructive 着色 */
      destructive?: boolean;
      /** 键帽序列，交宿主 `<Shortcut keys={…} />` 渲染（如 `["alt","p"]`） */
      shortcutKeys?: readonly string[];
      disabled?: boolean;
    };

/**
 * Mini-App 动作贡献：只声明语义，外露 bar / 溢出投影由宿主 ActionBar 消化 layout。
 * 业务禁止再手写 `if (showBarLabels)`。
 */
export interface WorkspaceAppActionContribution {
  id: string;
  label: string;
  icon?: WorkspaceAppIcon;
  onPress: () ***REMOVED*** void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  shortcutKeys?: readonly string[];
  /** tip 文案；缺省用 label（可含更完整说明，仍不含快捷键字符串） */
  tipLabel?: string;
}

/** 宿主 ActionBar 溢出三点的 chrome 选项（items 由 ActionBar 按 layout 投影生成）。 */
export type WorkspaceAppActionBarOverflowProps = Omit<
  WorkspaceAppActionOverflowMenuProps,
  "items" | "onSelect"
>;

/**
 * 列表行 / 底栏动作整机：bar 外露 + 三点 +（可选）surface 右键/长按 + showBarLabels。
 * Mini-App 应优先用 ActionBar，禁止再手拼 ActionBarButton + ActionOverflowMenu 第二套。
 */
export interface WorkspaceAppActionBarProps {
  layout: WorkspaceAppActionBarLayout;
  /** 已知动作全集；bar/overflow 按 layout.id 取用 */
  actions: readonly WorkspaceAppActionContribution[];
  /**
   * true：不渲染外露 bar，并把原 bar 投影进溢出菜单第一段（移动端小封面等）。
   * 投影算法与 SDK `projectActionBarOverflowFold` 同源。
   */
  hideBar?: boolean;
  /** rail 排布：`even` 用于大封面底栏均分 */
  distribute?: "start" | "end" | "even";
  iconSize?: number;
  mutedColor?: string;
  accentColor?: string;
  /**
   * 列表行/卡片主体。提供后宿主渲染 surface 右键/长按，与三点同源菜单项。
   * 业务勿再自造第二套 ContextMenu。
   */
  surface?: unknown;
  /**
   * surface 与 chrome 几何（勿与 `layout` 动作布局混淆）：
   * - `row`（默认）：`[surface | bar | 三点]` 横排（歌曲行）
   * - `card`：surface 铺满，bar+三点浮在右上角（封面卡片，对齐 OverflowMenu.layout=card）
   */
  surfaceLayout?: "row" | "card";
  /** 三点菜单 chrome；不传则不渲染溢出触发器（仍可只画 bar） */
  overflowMenu?: WorkspaceAppActionBarOverflowProps;
  /**
   * 可选外露 bar 命中区样式（业务 token/hover；宿主不内置封面 scrim）。
   * 可为静态 style，或 `({ hovered, pressed }) ***REMOVED*** style`。
   */
  barButtonStyle?: unknown;
  testID?: string;
}

export interface WorkspaceAppActionBarButtonProps {
  label: string;
  /** 由 ActionBar 从 layout.showBarLabels 注入；业务勿自行分支 */
  showBarLabels: boolean;
  tipLabel?: string;
  shortcutKeys?: readonly string[];
  tipSide?: "top" | "bottom" | "left" | "right";
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () ***REMOVED*** void;
  iconSize?: number;
  mutedColor?: string;
  accentColor?: string;
  icon?: WorkspaceAppIcon;
  /**
   * 可选命中区样式（业务 token/hover；宿主不内置封面 scrim）。
   * 可为静态 style，或 `({ hovered, pressed }) ***REMOVED*** style`。
   */
  hitStyle?: unknown;
  testID?: string;
  children?: unknown;
}

export interface WorkspaceAppActionOverflowMenuProps {
  items: readonly WorkspaceAppMenuItem[];
  onSelect: (id: string) ***REMOVED*** void;
  /** 底部追加「编辑布局」，与 WorkspacePaneToolbar overflow 同源 */
  showEditLayout?: boolean;
  editLayoutLabel?: string;
  onEditLayout?: () ***REMOVED*** void;
  moreLabel?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  triggerSize?: number;
  triggerColor?: string;
  /**
   * 可选触发器样式（由业务传入 token/hover，宿主不内置封面强化）。
   * 可为静态 style，或 `({ hovered, pressed, open }) ***REMOVED*** style`。
   */
  triggerStyle?: unknown;
  testID?: string;
  /**
   * 可选列表行/卡片主体。宿主启用桌面右键 + 移动端长按，
   * 菜单项与三点 **同一份 items**（宿主 ContextMenu 同源）。
   * Mini-App 禁止再自造第二套右键/长按菜单。
   */
  surface?: unknown;
  /**
   * 是否渲染三点触发器。默认 true。
   * 为 false 时必须同时传 `surface`，仅靠右键/长按打开同一份菜单
   * （例如播放器标题区与底栏三点分置）。
   */
  showTrigger?: boolean;
  /**
   * surface 右键 / 长按菜单的锚点（公共合同，默认 `point`）。
   * - `point`：跟鼠标 / 触控落点（宽 surface：标题区、搜索行等必须用这个）
   * - `trigger`：钉在 surface 盒模型边缘（窄行触发器场景）
   */
  contextAnchor?: "point" | "trigger";
  /**
   * surface 布局：
   * - `row`（默认）：「surface 弹性 + 三点」横排，适合歌曲行
   * - `card`：三点浮在 surface 右上角，适合封面卡片
   */
  layout?: "row" | "card";
  /**
   * 通用：悬停某菜单项时回调；移出项或旁路飞出层时传 null。
   * 与 `renderHoverSidePanel` 配套。
   */
  onItemHoverChange?: (id: string | null) ***REMOVED*** void;
  /**
   * 通用：按悬停项 id 渲染卡片外侧飞出层（进度条 / 数值器 / 输入框等由调用方决定）。
   * 挂在对应行右侧，位置由行结构定死；不参与布局测量；同属下拉表面。
   */
  renderHoverSidePanel?: (id: string) ***REMOVED*** unknown;
}

/** Mini-App → 宿主的氛围色种子（只传色，不传媒体）。 */
export interface WorkspaceAppAtmosphereSeed {
  primary: string;
  secondary?: string;
  tertiary?: string;
  luminance?: "dark" | "light" | "unknown";
  sourceId: string;
  sourceLabel?: string;
}

export interface WorkspaceAppAtmospherePreset {
  id: string;
  name: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  luminance?: "dark" | "light" | "unknown";
  builtin?: boolean;
  createdAt?: number;
}

export type WorkspaceAppAtmosphereMode =
  | { kind: "follow-app" }
  | { kind: "preset"; presetId: string };

export interface WorkspaceAppAtmosphereSnapshot {
  mode: WorkspaceAppAtmosphereMode;
  effective: WorkspaceAppAtmosphereSeed | null;
  pane: WorkspaceAppAtmosphereSeed | null;
  global: WorkspaceAppAtmospherePreset | null;
}

export type WorkspaceAppNotificationKind = "info" | "success" | "warning" | "error";

export interface WorkspaceAppNotificationInput {
  title: string;
  message?: string;
  kind?: WorkspaceAppNotificationKind;
  /** 默认约 2.2s；`null` 表示需手动关闭（宿主可能降级为较长 duration）。 */
  durationMs?: number | null;
}

export interface WorkspaceAppNotificationApi {
  show(input: WorkspaceAppNotificationInput): void;
}

export type WorkspaceAppProgressEndKind = "success" | "error" | "cancelled";

export interface WorkspaceAppProgressCreateInput {
  title: string;
  message?: string;
  /** 有值时进度条为确定型；否则为不确定型。 */
  total?: number;
  appId?: string;
  /** 为 true 时顶栏展示取消按钮；需配合 handle.cancel() 或宿主注册取消回调。 */
  cancellable?: boolean;
}

export interface WorkspaceAppProgressReportInput {
  message?: string;
  value?: number;
  total?: number;
}

export interface WorkspaceAppProgressEndInput {
  message?: string;
  kind?: WorkspaceAppProgressEndKind;
}

export interface WorkspaceAppProgressHandle {
  readonly id: string;
  report(input?: WorkspaceAppProgressReportInput): void;
  end(input?: WorkspaceAppProgressEndInput): void;
  /** 仅 `cancellable: true` 时有意义；触发注册的取消回调并标记为 cancelled。 */
  cancel(): void;
}

export interface WorkspaceAppProgressApi {
  create(input: WorkspaceAppProgressCreateInput): WorkspaceAppProgressHandle;
}

/** 宿主 UI 能力（复用壳层成熟组件，避免 Mini-App 自造弹层）。 */
export interface WorkspaceAppUiApi {
  /**
   * 打开宿主「编辑布局」sheet（与消息 footer / 工作区工具栏 / 安卓 Tab 同源）。
   * Mini-App 不得自造第二套布局编辑器。
   */
  customizeActionLayout(input: WorkspaceAppCustomizeActionLayoutInput): void;
  /**
   * 打开侧栏宿主 chrome 实体菜单编辑布局（layoutKey = item-menu:appId:segmentId）。
   * 仅绑定侧栏/命令面板列表行表面；其它表面请用 customizeEntityMenuLayout。
   */
  customizeItemMenuLayout(input: { appId: string; segmentId: string; title?: string }): void;
  /** 读取侧栏实体菜单布局（已按 known contribution ids 归一化）。 */
  getItemMenuLayout(input: { appId: string; segmentId: string }): WorkspaceAppActionBarLayout;
  /** 订阅侧栏实体菜单布局变更。 */
  subscribeItemMenuLayout(
    input: { appId: string; segmentId: string },
    onStoreChange: () ***REMOVED*** void,
  ): () ***REMOVED*** void;
  /**
   * 仅当侧栏表面尚无持久化布局时写入默认。
   * 已有用户布局时 no-op。
   */
  seedItemMenuLayoutIfAbsent(input: {
    appId: string;
    segmentId: string;
    layout: WorkspaceAppActionBarLayout;
  }): void;
  /**
   * 多表面实体菜单：同源动作目录、按 surfaceId 独立 layoutKey
   * （entity-menu:appId:menuId:surfaceId）。
   * 例：Music track 的 player / queue 与侧栏 item-menu 布局互不覆盖。
   */
  getEntityMenuLayout(input: {
    appId: string;
    menuId: string;
    surfaceId: string;
    knownIds: readonly string[];
  }): WorkspaceAppActionBarLayout;
  subscribeEntityMenuLayout(
    input: { appId: string; menuId: string; surfaceId: string },
    onStoreChange: () ***REMOVED*** void,
  ): () ***REMOVED*** void;
  customizeEntityMenuLayout(input: {
    appId: string;
    menuId: string;
    surfaceId: string;
    title?: string;
    items: WorkspaceAppActionLayoutItem[];
    defaultLayout?: WorkspaceAppActionBarLayout;
  }): void;
  seedEntityMenuLayoutIfAbsent(input: {
    appId: string;
    menuId: string;
    surfaceId: string;
    knownIds: readonly string[];
    layout: WorkspaceAppActionBarLayout;
  }): void;
  /** 写入多表面实体菜单布局（迁移默认 / App 内同步）。 */
  setEntityMenuLayout(input: {
    appId: string;
    menuId: string;
    surfaceId: string;
    knownIds: readonly string[];
    layout: WorkspaceAppActionBarLayout;
  }): void;
  /**
   * 向宿主推送整应用氛围种子（只传颜色，不传封面/视频）。
   * 渲染是否生效由宿主仲裁（跟随 App + 当前 focused pane）。
   */
  setAtmosphere(seed: WorkspaceAppAtmosphereSeed): void;
  /** 清除该 source 的氛围种子；若其为当前有效源则回落全局。 */
  clearAtmosphere(sourceId: string): void;
  /** 只读快照：模式、有效色、pane 色、全局预设。 */
  getAtmosphereSnapshot(): WorkspaceAppAtmosphereSnapshot;
  /** 写入「我的氛围」预设并可选切到该预设；返回预设 id。 */
  addAtmospherePreset(input: {
    name: string;
    primary: string;
    secondary?: string;
    tertiary?: string;
    luminance?: WorkspaceAppAtmosphereSeed["luminance"];
  }): string;
  /**
   * 动态注册瞬时快捷键（默认 Option/Alt 1–n）。
   * 多 session 可并存，但只有 `isActive()` 为真的最上层会消费按键；
   * 激活时优先于宿主全局 ⌥N（跳 Tab / Android 等）；未激活不 preventDefault。
   * 可选 `helpSection`：写入全局 Shortcuts 帮助面板独立分组（仅文档，不进统一绑定表）。
   */
  registerTransientShortcuts(
    shortcuts: readonly WorkspaceAppTransientShortcutInput[],
    options?: WorkspaceAppTransientShortcutRegisterOptions,
  ): WorkspaceAppTransientShortcutSession;
  /**
   * 打开 Mini-App「Agent Context」对齐看板（本 App 可调工具 + 上下文路径）。
   * 与 Agent Tab 的 Agent Context 入口对齐；勿自造第二套浮层。
   */
  openAppAgentContext(input: { appId: string }): void;
  /** 关闭 `openAppAgentContext` 打开的看板；未打开时 no-op。 */
  closeAppAgentContext(): void;
  /** 当前是否有 App Agent Context 看板打开。 */
  isAppAgentContextOpen(): boolean;
  /**
   * 打开宿主详情 sheet（与侧栏/命令面板 View details 同类信息弹层）。
   * Mini-App 不得自造第二套详情浮层。
   */
  openDetailSheet(input: WorkspaceAppOpenDetailSheetInput): void;
  /** 关闭 `openDetailSheet` 打开的详情；未打开时 no-op。 */
  closeDetailSheet(): void;
  /** 当前是否有 Mini-App 详情 sheet 打开（供 ⌥D 等快捷键切换）。 */
  isDetailSheetOpen(): boolean;
  /**
   * 向宿主 Tab「View details」追加本 App 的配置行（如行内编辑）。
   * 返回注销函数；activate 卸载时应调用。
   */
  registerDetailSheetExtras(input: WorkspaceAppRegisterDetailSheetExtrasInput): () ***REMOVED*** void;
  /**
   * 与 WorkspacePaneToolbar「…」overflow **同一套** DropdownMenu 装配。
   * Mini-App 在 JSX 内渲染此组件，只换 items 数据；禁止自造菜单或平行 openMenu。
   */
  ActionOverflowMenu: (props: WorkspaceAppActionOverflowMenuProps) ***REMOVED*** unknown;
  /**
   * 按 layout 投影外露 bar + 溢出三点；自动消化 showBarLabels / hideBar。
   * Mini-App 只交 contributions + rail 策略，禁止自绘「显示完整」分支。
   */
  ActionBar: (props: WorkspaceAppActionBarProps) ***REMOVED*** unknown;
  /**
   * 单个 bar 按钮（图标或图标+文案）；一般由 ActionBar 内部使用，也可单独复用。
   */
  ActionBarButton: (props: WorkspaceAppActionBarButtonProps) ***REMOVED*** unknown;
  /**
   * 宿主悬停 tip（Tooltip + ShortcutTooltipContent 键帽）。
   * Mini-App 禁止自造 tip；label 不含快捷键文案，快捷键只走 shortcutKeys。
   */
  ActionTooltip: (props: WorkspaceAppActionTooltipProps) ***REMOVED*** unknown;
  /**
   * 桌面原生确认框（可选 checkbox）。非桌面时返回 { confirmed: false }。
   * 高敏操作（如 Frida/改签）必须先走此确认，禁止静默执行。
   */
  confirmRisk?(input: WorkspaceAppConfirmRiskInput): Promise<WorkspaceAppConfirmRiskResult>;
  /**
   * 轻量全局通知（toast）。Mini-App 禁止自造第二套全局提示层。
   */
  notification: WorkspaceAppNotificationApi;
  /**
   * 长任务进度（单任务壳层）。Mini-App 禁止自造全局进度条/阻塞层。
   */
  progress: WorkspaceAppProgressApi;
}

export interface WorkspaceAppActionTooltipProps {
  label: string;
  /** 如 `["alt","1"]`；由宿主 Shortcut 渲染键帽，禁止写进 label */
  shortcutKeys?: readonly string[];
  side?: "top" | "bottom" | "left" | "right";
  /** 为 false 时不包 tip，只渲染 children（音量非静音等） */
  enabled?: boolean;
  children: unknown;
}

/** 桌面主进程在微应用 tools/ 白名单内执行 sidecar 工具。 */
export interface WorkspaceAppRunToolInput {
  /** 当前微应用 id；工具必须位于该 App 的本地目录 tools/ 下。 */
  appId: string;
  /** 相对路径，仅允许 `tools/*.py|sh|mjs|js`。 */
  tool: string;
  /** 传给工具的 argv（无 shell）。 */
  args?: readonly string[];
  /** 超时毫秒；默认约 10 分钟，上限约 20 分钟。 */
  timeoutMs?: number;
}

export interface WorkspaceAppRunToolResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  /** 工具 stdout 末行 `RESULT_JSON:{...}` 解析结果；无则 null。 */
  resultJson: unknown | null;
  progressTail: string[];
  appDirPath: string;
  toolPath: string;
  dataRoot: string;
  durationMs: number;
}

/** 桌面风险确认（强确认文案 + 可选勾选）。 */
export interface WorkspaceAppConfirmRiskInput {
  title?: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  kind?: "info" | "warning" | "error";
  /** 有则弹出带 checkbox 的确认框。 */
  checkboxLabel?: string;
  checkboxChecked?: boolean;
}

export interface WorkspaceAppConfirmRiskResult {
  confirmed: boolean;
  /** 无 checkbox 时恒为 false。 */
  dontAskAgain: boolean;
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

/** Agent 可调用的 Mini-App 工具可见性闸门（P6）。 */
export type WorkspaceAppAgentToolAvailability = "always" | "tab-open" | "tab-visible";

export interface WorkspaceAppAgentToolContext {
  appId: string;
  tabId?: string | null;
  agentId?: string | null;
}

export interface WorkspaceAppAgentToolDefinition {
  /** 叶子名；完整逻辑名 agnx.app.<appId>.<name> */
  name: string;
  description: string;
  /** JSON Schema object（可选；仅描述，daemon 作提示） */
  inputSchema?: Record<string, unknown>;
  execute: (input: unknown, ctx: WorkspaceAppAgentToolContext) ***REMOVED*** Promise<unknown> | unknown;
}

export interface WorkspaceAppRegisterAgentToolsInput {
  appId: string;
  tools: readonly WorkspaceAppAgentToolDefinition[];
  /** 默认 always */
  availability?: WorkspaceAppAgentToolAvailability;
}

/** Tab 种类（与宿主工作区 target.kind 对齐；P1 先保证 mini-app 发射）。 */
export type WorkspaceAppTabKind =
  | "mini-app"
  | "terminal"
  | "browser"
  | "diff"
  | "preview"
  | "settings"
  | "files"
  | string;

export type WorkspaceAppTabLifecycleReason =
  | "mount"
  | "unmount"
  | "user"
  | "layout"
  | "lru-unmount"
  | "retarget"
  | "deactivate";

export interface WorkspaceAppTabRef {
  tabId: string;
  kind: WorkspaceAppTabKind;
  appId?: string;
  panelId?: string;
  entityId?: string;
}

export interface WorkspaceAppTabLifecycleEvent extends WorkspaceAppTabRef {
  reason?: WorkspaceAppTabLifecycleReason;
}

export interface WorkspaceAppTabFocusEvent extends WorkspaceAppTabRef {
  /** 与 pane isInteractive 对齐 */
  active: boolean;
}

export interface WorkspaceAppTabVisibleEvent extends WorkspaceAppTabRef {
  visible: boolean;
}

export type WorkspaceAppTabEvent =
  | WorkspaceAppTabLifecycleEvent
  | WorkspaceAppTabFocusEvent
  | WorkspaceAppTabVisibleEvent;

/** 冷恢复相位偏好（宿主可扩展字段；App 按需读取）。 */
export interface WorkspaceAppColdRestorePrefs {
  reason: "host-ready" | "late-session" | "manual" | string;
}

/** 后台会话登记：允许冷启动无 UI 恢复。 */
export interface WorkspaceAppBackgroundSessionInput {
  appId: string;
  /** 如 audio / long-task；宿主只作分类，不做行业语义。 */
  kind: string;
  /** 若提供，冷恢复相位调用；失败隔离。 */
  restore?: () ***REMOVED*** void | Promise<void>;
}

export interface WorkspaceAppHostApi {
  /** 注册侧栏 / 命令面板「主视图」分段。 */
  registerPrimarySegment(contribution: WorkspaceAppPrimarySegmentContribution): void;
  /** 注册主视图下列表数据源。 */
  registerItemProvider(contribution: WorkspaceAppItemProviderContribution): void;
  /**
   * 注册列表分组 / 排序（命令面板与侧栏同构 organize）。
   * 与 `primarySegment.organizeBlockId` 对齐；Music / Notes 后续分组排序走此口，禁止宿主 per-App 特判。
   */
  registerOrganize(contribution: WorkspaceAppOrganizeContribution): void;
  /** 注册命令面板可搜索命令。 */
  registerCommand(contribution: WorkspaceAppCommandContribution): void;
  /** 注册 Mini-App Tab 面板（自定义 React 组件）。 */
  registerMiniApp(contribution: WorkspaceAppMiniAppContribution): void;
  /** 注册列表项菜单（侧栏 / 命令面板宿主壳注入）。 */
  registerItemMenu(contribution: WorkspaceAppItemMenuContribution): void;
  /** Mini-App Tab 右键菜单项（按 appId 合并到宿主菜单）。 */
  registerTabContextMenu(contribution: WorkspaceAppTabContextMenuContribution): void;
  /** 注册快捷键（合并进宿主帮助面板；优先 `workspace.app.*` actionId）。 */
  registerShortcut(contribution: WorkspaceAppShortcutContribution): void;
  /**
   * 列表项打开 Tab 前的准备回调（按 appId）。
   * 例如 Music 在打开单例播放器 Tab 前先 `setNowPlaying(itemId)`。
   */
  registerListItemOpenPreparer(appId: string, preparer: (itemId: string) ***REMOVED*** void): () ***REMOVED*** void;

  /**
   * 注册 Agent 可调用工具（L2）。与 registerCommand 平行，不自动从命令导出。
   * 返回 unregister；App deactivate 时应调用。
   */
  registerAgentTools(input: WorkspaceAppRegisterAgentToolsInput): () ***REMOVED*** void;

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
    importFromUrl(input: WorkspaceAppImportRemoteFileInput): Promise<WorkspaceAppManagedFile>;
    /** 剪贴板 / 拖拽等内存字节落盘。 */
    importBytes(input: WorkspaceAppImportBytesInput): Promise<WorkspaceAppManagedFile>;
    /** 本机路径拷入 apps/data（剪贴板 file:// 图）。 */
    importFromPath(input: WorkspaceAppImportPathInput): Promise<WorkspaceAppManagedFile>;
    resolveObjectUrl(uri: string): Promise<string>;
    /** 桌面选目录；取消或非桌面返回 null。 */
    pickDirectory(input?: WorkspaceAppPickDirectoryInput): Promise<string | null>;
    /**
     * 删除托管路径（仅 `$AGNX_HOME/apps/data` 内）。
     * 用于曲目删除等「列表 + 物理文件」同语义清理。
     */
    deleteUris(uris: readonly string[]): Promise<WorkspaceAppDeleteUrisResult>;
    /**
     * 选目录后把 entries 打成 ZIP 写入该目录。
     * 仅桌面；entries.uri 必须是 apps/data 内本地路径。
     */
    exportZip(input: WorkspaceAppExportZipInput): Promise<WorkspaceAppExportZipResult | null>;
  };

  /**
   * 宿主剪贴板（桌面主进程）。
   * 渲染进程 paste 事件的 DataTransfer 常丢图；微应用应经此读取完整图文。
   */
  clipboard?: {
    readPastePayload(): Promise<WorkspaceAppClipboardPastePayload>;
  };

  /**
   * 宿主代发 HTTP JSON（Electron 主进程 net.fetch），供 Mini-App 访问远端聚合源 / 本机 sidecar。
   * 另可选：媒体 Range 代理（流式播放，非整文件下载）。
   */
  http: {
    fetchJson(
      url: string,
      init?: {
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        headers?: Record<string, string>;
        body?: string;
        timeoutMs?: number;
        /** true 时返回带 status/headers/setCookie 的 meta 包装 */
        returnMeta?: boolean;
      },
    ): Promise<unknown>;
    /**
     * 将 http(s) 音视频 URL 换成本机 Range 代理地址，供 `<audio>` / `<video>` 流式播放。
     * 非 Electron 时原样返回（passthrough）。
     */
    createMediaProxyUrl?(input: {
      url: string;
      referer?: string;
    }): Promise<{ proxyUrl: string; id: string }>;
  };

  /**
   * 可选：隐藏浏览器会话截流（屏外加载第三方页，拦截 audio/*）。
   * 仅桌面 Electron；爬取/站点脚本仍在 Mini-App，宿主只提供通用会话能力。
   */
  browserSession?: {
    captureMedia(input: {
      pageUrl?: string;
      /** 内置站点动作；优先于裸 pageUrl 导航策略 */
      preset?: "pixabay-music-search" | "soundstripe-library-search" | "soundstripe-home" | "none";
      query?: string;
      clickButtonText?: string;
      timeoutMs?: number;
      /** true=只刮搜索列表，不点播放 */
      listOnly?: boolean;
    }): Promise<{
      mediaUrls: string[];
      tracks?: Array<{
        title: string;
        artist?: string;
        pageUrl?: string;
        mediaUrl?: string;
      }>;
      finalUrl: string;
      title: string;
      preset: string;
    }>;
  };

  /**
   * 可选特权：工作区 Browser View（桌面 WebContentsView 宿主）。
   * 仅系统 first-party（如 com.agnx.browser）应调用；≠ browserSession 屏外媒体捕获。
   * 非 Electron 时方法可能缺失或返回 unavailable。
   */
  browserView?: {
    attach(input: {
      browserId: string;
      partition: string;
      initialUrl?: string;
      visible?: boolean;
      bounds?: { x: number; y: number; width: number; height: number };
    }): Promise<unknown>;
    destroy(browserId: string): Promise<unknown>;
    setBounds(
      browserId: string,
      bounds: { x: number; y: number; width: number; height: number },
    ): Promise<unknown>;
    setVisible(browserId: string, visible: boolean): Promise<unknown>;
    navigate(browserId: string, url: string): Promise<unknown>;
    goBack(browserId: string): Promise<unknown>;
    goForward(browserId: string): Promise<unknown>;
    reload(browserId: string, ignoreCache?: boolean): Promise<unknown>;
    stop(browserId: string): Promise<unknown>;
    executeJavaScript(browserId: string, code: string): Promise<unknown>;
    getState(browserId: string): Promise<unknown>;
    capturePreview(browserId: string): Promise<unknown>;
    openDevTools(browserId: string): Promise<unknown>;
    clearData(
      browserId: string,
      dataType?: "cookies" | "cache" | "storage" | "all",
    ): Promise<unknown>;
  };

  /**
   * 可选：打开工作区 Browser Tab（kind:"browser"）。
   * 系统 Browser 微应用命令入口；第三方默认不应依赖。
   */
  openBrowserTab?(input?: {
    initialUrl?: string;
    profileId?: string;
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }): {
    browserId: string;
    opened: boolean;
  };

  /**
   * 可选特权：Android 设备发现 / 会话 / 命令 / 帧流（桌面 ADB）。
   * 多消费方合同见 docs/Android主机服务合同_android-host-services-contract.md；
   * 类型见 ./android-host-api。第三方默认最小权限；引擎/真相在 daemon。
   */
  android?: WorkspaceAppAndroidHostApi;

  /**
   * 宿主壳就绪相位（扫盘 / first-party activate 完成）。
   * 已就绪则回调尽快触发；返回取消订阅。
   */
  lifecycle: {
    isHostReady(): boolean;
    onHostReady(listener: () ***REMOVED*** void): () ***REMOVED*** void;
    /**
     * 冷恢复相位（HostReady 之后、或晚注册 session 时补发）。
     * App 也可只靠 `background.registerSession({ restore })`，二者都会在同一相位触发。
     */
    onColdRestore(listener: (prefs: WorkspaceAppColdRestorePrefs) ***REMOVED*** void): () ***REMOVED*** void;
    /** 窗口隐藏 / pagehide 等（非 App 卸载）。 */
    onSuspend(listener: () ***REMOVED*** void): () ***REMOVED*** void;
    /** 窗口回到前台。 */
    onResume(listener: () ***REMOVED*** void): () ***REMOVED*** void;
  };

  /**
   * Mini-App 面板级 Tab 生命周期（挂载/卸载/焦点/可见）。
   * 与布局槽位 open/close 可能不同步（LRU keep-alive）；payload.reason 区分。
   */
  tabs: {
    onOpen(listener: (event: WorkspaceAppTabLifecycleEvent) ***REMOVED*** void): () ***REMOVED*** void;
    onClose(listener: (event: WorkspaceAppTabLifecycleEvent) ***REMOVED*** void): () ***REMOVED*** void;
    onFocus(listener: (event: WorkspaceAppTabFocusEvent) ***REMOVED*** void): () ***REMOVED*** void;
    onBlur(listener: (event: WorkspaceAppTabFocusEvent) ***REMOVED*** void): () ***REMOVED*** void;
    onVisibleChange(listener: (event: WorkspaceAppTabVisibleEvent) ***REMOVED*** void): () ***REMOVED*** void;
    subscribeKind(
      kind: WorkspaceAppTabKind,
      handler: (event: WorkspaceAppTabEvent) ***REMOVED*** void,
    ): () ***REMOVED*** void;
  };

  /**
   * 后台会话：申请钉住本 App 的 Mini-App Tab（LRU 不卸），避免续播被硬重载。
   */
  background: {
    requestRetain(input: { appId: string; active: boolean; reason?: string }): void;
    /**
     * 声明长生命周期会话（音频 / 长任务等）。
     * 提供 `restore` 时，宿主在 cold restore 相位调用；返回取消注册。
     */
    registerSession(input: WorkspaceAppBackgroundSessionInput): () ***REMOVED*** void;
  };

  /** 运行时数据根（默认 `$AGNX_HOME/apps/data/<appId>`）。 */
  storage: WorkspaceAppStorageApi;

  /** 宿主配置层：global / app 两级长期偏好；区别于业务状态 storage。 */
  config: WorkspaceAppConfigApi;

  /**
   * 可选跨端实时同步（§10.7）。
   * 需要对话级三端即时更新时再接；未提供 / 未调用则仅 storage 落盘。
   */
  sync?: WorkspaceAppSyncApi;

  /**
   * 宿主 UI 表面（编辑布局等）。
   * 复用壳层组件；Mini-App 不要自造平行实现。
   */
  ui: WorkspaceAppUiApi;

  /**
   * 可选：桌面 sidecar 工具运行器（主进程 spawn，仅 tools/ 白名单）。
   * 非 Electron / 不可用时为 undefined；Mini-App 须自行降级提示。
   */
  tools?: {
    run(input: WorkspaceAppRunToolInput): Promise<WorkspaceAppRunToolResult>;
  };

  /** 平台门控摘要（避免 App 依赖宿主 constants）。 */
  platform: {
    isWeb: boolean;
  };

  /**
   * 可选：解析 Mini-App 包内静态站入口（`dist/game` / `game`）。
   * Electron → `agnx-miniapp-static://`；Web/Native 直连 → daemon HTTP token 路径；不可用时返回 null。
   */
  miniAppStatic?: {
    getEntryUrl(appId: string, entryPath?: string): Promise<string | null>;
  };
}

/** 磁盘 / workspace 包入口须导出的模块形状。 */
export interface WorkspaceAppModule {
  appId: string;
  activate(host: WorkspaceAppHostApi): void | Promise<void>;
  /** 卸载/禁用/强制重激活前调用；用于释放 Audio、定时器、订阅。 */
  deactivate?(host: WorkspaceAppHostApi): void | Promise<void>;
}

export type { WorkspaceAppListItem };
