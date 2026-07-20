// 场景：工作区 Mini-App 贡献点类型 — 阶段 B 注册中心合同（见架构活页）。

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
   * 有则宿主优先绘制图片，失败再退回分段默认图标。
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
  | ((props: { size?: number | string; color?: string; absoluteStrokeWidth?: boolean }) ***REMOVED*** unknown);

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
  subscribe: (listener: (items: WorkspaceAppListItem[]) ***REMOVED*** void) ***REMOVED*** () ***REMOVED*** void;
  search?: (query: string) ***REMOVED*** WorkspaceAppListItem[] | Promise<WorkspaceAppListItem[]>;
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
  organize: (input: WorkspaceAppOrganizeContext) ***REMOVED*** WorkspaceAppOrganizeGroup[];
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
  ) ***REMOVED*** WorkspaceAppListItem[];
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
   * 命令图标。侧栏顶部按钮 / 命令面板可共用；推荐 Lucide 组件或图片型组件。
   * 宿主不得为具体业务 App 硬编码图标。
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
  }) ***REMOVED*** void | Promise<void>;
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
   * 仅当 Mini-App 瞬时快捷键面激活时匹配（如音乐播放器可见）。
   * 用于 ⌥N 等与「跳 Tab」同 chord 的表面专属键，并可进入设置页 Rebind。
   */
  requireTransientSurfaceActive?: boolean;
  run?: (context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }) ***REMOVED*** void | Promise<void>;
}

export interface WorkspaceAppMiniAppContribution {
  id: string;
  appId: WorkspaceAppId;
  title: string;
  /** Tab / 切换器 leading 图标；推荐 Lucide 组件。 */
  icon?: WorkspaceAppIcon;
  /** 阶段 C 再挂载真实组件；阶段 B 仅登记槽位。 */
  component?: unknown;
  /** 标签标题：同步读当前 entity（可接 store.getState）。 */
  getEntityTitle?: (entityId: string) ***REMOVED*** string | null;
  /** 标签标题订阅；与 getEntityTitle 配对供宿主 useSyncExternalStore。 */
  subscribeEntityTitle?: (entityId: string, listener: () ***REMOVED*** void) ***REMOVED*** () ***REMOVED*** void;
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
  resolveLabel?: (item: WorkspaceAppListItem) ***REMOVED*** string;
  /** 菜单右侧键帽（如 `["alt","p"]`）；宿主用 Shortcut 渲染。 */
  shortcutKeys?: readonly string[];
  /**
   * 外露到侧栏列表项三点左侧（菜单外按钮）；hover 与三点同步可见。
   */
  showAsChromeAction?: boolean;
  /**
   * 是否仍出现在右键/三点菜单；默认 true。
   * false 时仅 chrome 外露（需配合 showAsChromeAction）。
   */
  includeInMenu?: boolean;
  run: (item: WorkspaceAppListItem) ***REMOVED*** void | Promise<void>;
}

/** Mini-App Tab 右键/菜单条贡献（宿主按 appId 合并，禁止 if appId 硬编码业务项）。 */
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
  /**
   * 外露到单标题 chrome / 侧栏 Tab 行三点左侧（菜单外按钮）。
   */
  showAsChromeAction?: boolean;
  /**
   * 是否仍出现在右键/三点菜单；默认 true。
   * false 时仅 chrome 外露（需配合 showAsChromeAction）。
   */
  includeInMenu?: boolean;
  /** 动态文案。 */
  resolveLabel?: (context: WorkspaceAppTabContextMenuContext) ***REMOVED*** string;
  /** 是否显示；缺省 true。在打开菜单时求值。 */
  isVisible?: (context: WorkspaceAppTabContextMenuContext) ***REMOVED*** boolean;
  /** 是否禁用；缺省 false。 */
  isDisabled?: (context: WorkspaceAppTabContextMenuContext) ***REMOVED*** boolean;
  run: (context: WorkspaceAppTabContextMenuContext) ***REMOVED*** void | Promise<void>;
}
