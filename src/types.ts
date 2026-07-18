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
}

export interface WorkspaceAppOrganizeGroup {
  key: string;
  title: string;
  items: WorkspaceAppListItem[];
  subgroups?: WorkspaceAppOrganizeGroup[];
}

export interface WorkspaceAppOrganizeContribution {
  id: string;
  appId: WorkspaceAppId;
  label: string;
  organize: (input: WorkspaceAppOrganizeContext) ***REMOVED*** WorkspaceAppOrganizeGroup[];
}

export interface WorkspaceAppCommandContribution {
  id: string;
  appId: WorkspaceAppId;
  title: string;
  keywords?: readonly string[];
  /** 对应 keyboard-shortcuts help.id，用于命令面板展示快捷键。 */
  shortcutHelpId?: string;
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
  run: (item: WorkspaceAppListItem) ***REMOVED*** void | Promise<void>;
}
