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
  open?: {
    panelId: string;
    entityId: string;
    titleHint?: string;
  };
}

export interface WorkspaceAppPrimarySegmentContribution {
  id: string;
  appId: WorkspaceAppId;
  label: string;
  /** 越小越靠前；内置默认 10/20/30/40。 */
  order: number;
  keywords?: readonly string[];
  /** 关联的 itemProvider 贡献 id；阶段 B 可暂空，仅占位分段目录。 */
  itemProviderId?: string;
  /** 关联的 organize / PrimaryListBlock id。 */
  organizeBlockId?: string;
  /** 空列表提示（宿主通用列表壳读取）。 */
  emptyHint?: string;
  /** 空列表主按钮；宿主查找同 app 的 command 贡献并 run。 */
  emptyActionCommandId?: string;
}

export interface WorkspaceAppItemProviderContribution {
  id: string;
  appId: WorkspaceAppId;
  subscribe: (listener: (items: WorkspaceAppListItem[]) ***REMOVED*** void) ***REMOVED*** () ***REMOVED*** void;
  search?: (query: string) ***REMOVED*** WorkspaceAppListItem[] | Promise<WorkspaceAppListItem[]>;
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

/**
 * App 可注册的快捷键贡献 — 宿主合并进键盘绑定表（阶段 D 外置 App 同走此协议）。
 * 外置 App 优先使用 `workspace.app.*`；内置亦可复用宿主已有 KeyboardActionId（如 notes）。
 */
export interface WorkspaceAppShortcutContribution {
  id: string;
  appId: WorkspaceAppId;
  actionId: string;
  helpId: string;
  label: string;
  /** 帮助面板分组 id；内置如 notes / navigation。 */
  sectionId: string;
  sectionTitle: string;
  macCombo: string;
  nonMacCombo: string;
  helpKeys: readonly string[];
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
  run: (item: WorkspaceAppListItem) ***REMOVED*** void | Promise<void>;
}
