// 场景：工作区 Sub App 贡献点类型 — 阶段 B 注册中心合同（见架构活页）。

/** 内置 first-party 与外部包共用的 App 标识。 */
export const BUILTIN_WORKSPACE_APP_ID = "agnx.builtin" as const;

export type WorkspaceAppId = typeof BUILTIN_WORKSPACE_APP_ID | string;

/** 宿主列表行合同；外观由壳层绘制，数据由 itemProvider 提供。 */
export interface WorkspaceAppListItem {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt?: number;
  keywords?: string[];
  /**
   * 侧栏 / 命令面板列表置顶。
   * 宿主通用列表按 pinned 优先排序；由 App 经 itemProvider 提供。
   */
  pinned?: boolean;
  /**
   * 侧栏当前高亮行（如音乐 now-playing）。
   * 宿主：`selected = item.active || item.id === selectedEntityId`；由 App 提供，禁止壳层 per-App 特判。
   */
  active?: boolean;
  /**
   * 侧栏 / 列表行左侧图片（封面等 http(s) 或本机路径）。
   *
   * 注意这是**列表行内容图**（如音乐封面），不是 App 图标 —— App 图标只认
   * `.agnx/manifest.json` 的 `icon`，不从这里取。
   * 有则宿主绘制图片，拿不到则退回该分段的默认图标。
   */
  imageUrl?: string;
  open?: {
    panelId: string;
    entityId: string;
    titleHint?: string;
  };
}

/**
 * App 可直接贡献的图标组件（推荐）；与宿主同树挂载，无需宿主硬编码 per-App 图标。
 * 也可用 string 键走宿主通用别名表（非业务特判）。
 */
export type WorkspaceAppIcon =
  | string
  | ((props: { size?: number | string; color?: string; absoluteStrokeWidth?: boolean }) => unknown);

export interface WorkspaceAppPrimarySegmentContribution {
  id: string;
  appId: WorkspaceAppId;
  label: string;
  /** 越小越靠前；内置默认 10/20/30/40。 */
  order: number;
  keywords?: readonly string[];
  /**
   * 侧栏/命令面板主视图图标。
   * 推荐传 Lucide 等组件；string 仅作宿主通用别名键，宿主不得为单个 App 特判。
   */
  icon?: WorkspaceAppIcon;
  /**
   * 列表标题呈现（业务分段声明；宿主按此画，禁止壳层 if appId）。
   * - default：仅 title（或宿主既有拼接策略）
   * - inline-muted-subtitle：title 主色 + subtitle 灰色同行（如音乐歌名+艺人）
   */
  listTitlePresentation?: "default" | "inline-muted-subtitle";
  /** 关联的 itemProvider 贡献 id；阶段 B 可暂空，仅占位分段目录。 */
  itemProviderId?: string;
  /** 关联的 organize / PrimaryListBlock id。 */
  organizeBlockId?: string;
  /** 空列表提示（宿主通用列表壳读取）。 */
  emptyHint?: string;
  /** 空列表主按钮；宿主查找同 app 的 command 贡献并 run。 */
  emptyActionCommandId?: string;
  /**
   * 列表顶部常驻操作（命令 id 有序）。
   * 有值时优先于 `emptyActionCommandId` 渲染横排按钮（如「打开播放器」「上传音乐」）。
   */
  listHeaderCommandIds?: readonly string[];
}

export interface WorkspaceAppItemProviderContribution {
  id: string;
  appId: WorkspaceAppId;
  subscribe: (listener: (items: WorkspaceAppListItem[]) => void) => () => void;
  search?: (query: string) => WorkspaceAppListItem[] | Promise<WorkspaceAppListItem[]>;
}

/** 命令面板 / 侧栏列表分组与排序（与内置四分段 organize 同形）。 */
export interface WorkspaceAppOrganizeContext {
  query: string;
  surface: "sidebar-classic" | "sidebar-wechat" | "command-center";
  /** 当前列表 chrome 排序选项 id（由宿主 store 注入）。 */
  sortOptionId?: string;
  /** 当前列表 chrome 分组选项 id（由宿主 store 注入）。 */
  groupOptionId?: string;
}

export interface WorkspaceAppOrganizeGroup {
  key: string;
  title: string;
  items: WorkspaceAppListItem[];
  subgroups?: WorkspaceAppOrganizeGroup[];
}

/** 列表 chrome 排序 cycle 选项（宿主绘制；App 只声明 id/文案）。 */
export interface WorkspaceAppListSortOption {
  id: string;
  label: string;
}

export interface WorkspaceAppOrganizeContribution {
  id: string;
  appId: WorkspaceAppId;
  label: string;
  organize: (input: WorkspaceAppOrganizeContext) => WorkspaceAppOrganizeGroup[];
  /**
   * 侧栏 / 命令面板分组标题右侧排序 cycle。
   * 有值时宿主展示并可驱动通用列表排序；无值则该分段不显示贡献型排序 chrome。
   */
  sortOptions?: readonly WorkspaceAppListSortOption[];
  /** 默认排序选项；缺省取 sortOptions[0]。 */
  defaultSortOptionId?: string;
  /**
   * 侧栏 / 命令面板分组标题右侧分组 cycle（与 sortOptions 独立，可组合）。
   */
  groupOptions?: readonly WorkspaceAppListSortOption[];
  /** 默认分组选项；缺省取 groupOptions[0]。 */
  defaultGroupOptionId?: string;
  /**
   * 可选：按 sortOptionId 对已过滤 items 排序。
   * 不提供时宿主按内置约定处理：`title`/`name` 名称；其余按 updatedAt 降序。
   */
  sortItems?: (
    items: readonly WorkspaceAppListItem[],
    sortOptionId: string,
  ) => WorkspaceAppListItem[];
}

export interface WorkspaceAppCommandSidebarAction {
  /**
   * 侧栏顶部按钮默认是否显示。
   * 缺省 true（声明了 sidebarAction 即默认进侧栏按钮组）。
   */
  defaultVisible?: boolean;
  /** 按钮文案；缺省用 command.title。 */
  label?: string;
  /** 越小越靠前；仅在侧栏按钮组 app 命令段内排序，缺省 100。 */
  order?: number;
}

export interface WorkspaceAppCommandContribution {
  id: string;
  appId: WorkspaceAppId;
  title: string;
  keywords?: readonly string[];
  /** 对应 keyboard-shortcuts help.id，用于命令面板展示快捷键。 */
  shortcutHelpId?: string;
  /**
   * 命令图标。侧栏顶部按钮等运行时可共用；**命令面板「子应用」列表行优先读 manifest.icon 静态路径**。
   */
  icon?: WorkspaceAppIcon;
  /**
   * 侧栏顶部按钮组入口。
   * 有值时：该命令可出现在侧栏顶部按钮组，并进入「命令」编辑布局的「侧栏显示」段。
   * 无值时：仅命令面板可搜，不进侧栏按钮组，也不出现在该编辑布局（避免与真实侧栏错位）。
   */
  sidebarAction?: WorkspaceAppCommandSidebarAction;
  /**
   * 为 true 时不进入命令面板（含命令分组布局）。
   * 用于仅供 Tab 右键菜单 / 宿主内部调用的命令。
   */
  commandCenterHidden?: boolean;
  run: (context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }) => void | Promise<void>;
}

/** 外置 App 优先使用 `workspace.app.*`；sectionId/sectionTitle 由 App 自带，宿主不预留 per-App 帮助分组。 */
export interface WorkspaceAppShortcutContribution {
  id: string;
  appId: WorkspaceAppId;
  actionId: string;
  helpId: string;
  label: string;
  /** 帮助面板分组 id（自由字符串，由 App 自定）。 */
  sectionId: string;
  sectionTitle: string;
  macCombo: string;
  nonMacCombo: string;
  helpKeys: readonly string[];
  /**
   * 仅当 Sub App 瞬时快捷键面激活时匹配（如音乐播放器可见）。
   * 用于 ⌥N 等与「跳 Tab」同 chord 的表面专属键，并可进入设置页 Rebind。
   */
  requireTransientSurfaceActive?: boolean;
  run?: (context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }) => void | Promise<void>;
}

/**
 * Shortcuts 面板功能组（产品组 / 布局组）。
 * sectionId/sectionTitle 仍由 registerShortcut 携带；本贡献用于分组元数据与「打开编辑布局」入口。
 */
export interface WorkspaceAppShortcutGroupContribution {
  id: string;
  appId: WorkspaceAppId;
  /** 分组 stable key；与 shortcut.sectionId 对齐时可复用同一字符串。 */
  groupKey: string;
  title: string;
  kind: "product" | "layout";
  /** Shortcuts 面板标题右侧「编辑布局…」；曲目/侧栏菜单类 product 组可声明。 */
  openLayoutEditor?: () => void;
  /** 由编辑布局 inline Rebind 的 helpId；Shortcuts 列表剔除以免与独立热键重复。 */
  layoutManagedShortcutSourceKeys?: readonly string[];
  /**
   * 由 Tab 公共详情「配置 → 快捷键」分组 Rebind 的 helpId（product 热键）。
   * Settings → Shortcuts 同步剔除；曲目/侧栏菜单类仍走 layoutManaged + 编辑布局。
   */
  detailManagedShortcutSourceKeys?: readonly string[];
}

export interface WorkspaceAppIsolationProfile {
  /**
   * 轻量隔离模式（任务 E）：
   * - none：同渲染进程面板（默认）
   * - sidecar-tools：长任务 / 高风险经 host.tools 主进程白名单
   * - iframe：面板内嵌跨域文档（可配合 iframeShortcutCapture）
   * - worker：面板内 Web Worker 重计算（opt-in 经 host.worker.observe 上报）
   */
  mode?: "none" | "sidecar-tools" | "iframe" | "worker";
  /** 声明依赖的 tools/* 相对路径（诊断展示；不自动强制执行）。 */
  sidecarTools?: readonly string[];
  /** worker 模式时可选脚本标识（诊断展示；App 自行 spawn Worker）。 */
  workerScripts?: readonly string[];
  /** 给人看的隔离说明。 */
  note?: string;
}

export interface WorkspaceAppMiniAppContribution {
  id: string;
  appId: WorkspaceAppId;
  title: string;
  /** Tab / 切换器 leading 图标；推荐 WorkspaceAppIcon 组件（与 manifest.icon 静态标可并存）。 */
  icon?: WorkspaceAppIcon;
  /** 阶段 C 再挂载真实组件；阶段 B 仅登记槽位。 */
  component?: unknown;
  /** 标签标题：同步读当前 entity（可接 store.getState）。 */
  getEntityTitle?: (entityId: string) => string | null;
  /** 标签标题订阅；与 getEntityTitle 配对供宿主 useSyncExternalStore。 */
  subscribeEntityTitle?: (entityId: string, listener: () => void) => () => void;
  /**
   * 桌面 force-subframe 快捷键转发：可选强制开/关。
   * 默认由宿主按扫盘 `manifest.guest` 解析策略推导（guest-webview / proxied-iframe / direct-iframe 自动开）；
   * `true` 强制开，`false` 强制关。同框 React 面板（无 Guest）勿开。
   */
  iframeShortcutCapture?: boolean;
  /** 任务 E：轻量隔离声明（诊断 / 文档索引；不改变默认执行路径）。 */
  isolation?: WorkspaceAppIsolationProfile;
  /**
   * 面板组件已注册但首屏数据/水合未完成时为 false。
   * 宿主延续 pane 级 BrandLogo 遮罩，避免与 Tab 过渡 loading 二次闪屏。
   */
  isPanelBootReady?: () => boolean;
  /** 与 isPanelBootReady 配对，供宿主 useSyncExternalStore。 */
  subscribePanelBootReady?: (listener: () => void) => () => void;
  /**
   * 打开本面板（且没指定实体）时用哪个实体 id。
   *
   * 同一个子应用可以有几种完全不同的 Tab，每个 Tab 各有名字 / 图标 / 内容：
   * 承载条目的面板靠 `getEntityTitle` 起名，装固定页面的面板靠下面的 `entityLabel`。
   * 子应用要开自己另一个面板的 Tab，就自己调 `host.openSubAppTab({ appId, panelId, entityId })`，
   * 宿主只负责「开某面板的某个实体」，不认识背后是什么。
   */
  defaultEntityId?: string;
  /**
   * 该实体缺名时的兜底名字与图标（有 `getEntityTitle` / Tab 自带标题时以那些为准）。
   * 图标缺省回落 manifest.icon → 通用图标。
   */
  entityLabel?: string;
  entityIcon?: WorkspaceAppIcon;
}

export interface WorkspaceAppItemMenuContribution {
  id: string;
  appId: WorkspaceAppId;
  /** 作用于哪个 primary segment / provider。 */
  segmentId: string;
  label: string;
  /**
   * 菜单 leading 图标（必填）。
   * 推荐传 Lucide 组件；宿主不得仅靠 menu id 猜测图标。
   */
  icon: WorkspaceAppIcon;
  /** 按条目动态文案（如置顶 / 取消置顶）。 */
  resolveLabel?: (item: WorkspaceAppListItem) => string;
  /** 按条目动态图标（如置顶 Pin / 取消置顶 PinOff）。 */
  resolveIcon?: (item: WorkspaceAppListItem) => WorkspaceAppIcon;
  /** 菜单右侧键帽（如 `["alt","p"]`）；宿主用 Shortcut 渲染。 */
  shortcutKeys?: readonly string[];
  /**
   * 快捷键动作源（与 registerShortcut 的 helpId 对齐）。
   * 编辑布局 inline Rebind 与 shortcuts 面板共用；跨 surface 只存一份映射。
   * 缺省时宿主可尝试用同 app 下 id 相同的 shortcut 贡献的 helpId。
   */
  shortcutSourceKey?: string;
  run: (item: WorkspaceAppListItem) => void | Promise<void>;
}

/** Sub App Tab 右键/菜单条贡献（宿主按 appId 合并，禁止 if appId 硬编码业务项）。 */
export interface WorkspaceAppTabContextMenuContext {
  appId: WorkspaceAppId;
  panelId: string;
  entityId: string;
  tabId: string;
}

export interface WorkspaceAppTabContextMenuContribution {
  id: string;
  appId: WorkspaceAppId;
  /** 仅匹配该 panel；缺省对该 app 下所有 mini-app Tab 生效。 */
  panelId?: string;
  label: string;
  /**
   * 菜单 leading 图标。推荐 Lucide 组件；宿主不得靠 menu id 猜图标。
   */
  icon?: WorkspaceAppIcon;
  /** 越小越靠前；缺省 100。 */
  order?: number;
  /** 动态文案。 */
  resolveLabel?: (context: WorkspaceAppTabContextMenuContext) => string;
  /** 是否显示；缺省 true。在打开菜单时求值。 */
  isVisible?: (context: WorkspaceAppTabContextMenuContext) => boolean;
  /** 是否禁用；缺省 false。 */
  isDisabled?: (context: WorkspaceAppTabContextMenuContext) => boolean;
  run: (context: WorkspaceAppTabContextMenuContext) => void | Promise<void>;
}
