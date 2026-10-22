// 场景：@agnx-lab/app-sdk — 窗内二级 Tab 条合同（宿主 WorkspaceTabChip 渲染，Sub App 只同步数据）。
import type { WorkspaceAppIcon } from "./types";

/** 与宿主 Tab 标记色菜单同色阶。 */
export type WorkspaceTabMarkerColor = "red" | "yellow" | "blue" | "green";

export interface WorkspaceSubTabChipPresentation {
  label: string;
  markerColor?: WorkspaceTabMarkerColor | null;
  /** 侧栏/Tab 图标；与 faviconUrl 二选一或并存（宿主优先 favicon）。 */
  icon?: WorkspaceAppIcon;
  faviconUrl?: string | null;
  isLoading?: boolean;
}

export interface WorkspaceSubTabDescriptor {
  id: string;
  presentation: WorkspaceSubTabChipPresentation;
  /** 默认 true；单页时可 false 隐藏关闭钮。 */
  closable?: boolean;
}

export interface WorkspaceSubTabStripSyncInput {
  /** 宿主分配的 strip 所有者 id（建议 appId:panelId[:entityId]）。 */
  ownerId: string;
  tabs: readonly WorkspaceSubTabDescriptor[];
  activeTabId: string;
}

export interface WorkspaceSubTabStripHandlers {
  onSelect?: (tabId: string) => void;
  onClose?: (tabId: string) => void;
  onCloseOthers?: (keepTabId: string) => void;
  onMarkerColorChange?: (tabId: string, color: WorkspaceTabMarkerColor | null) => void;
  onNewTab?: () => void;
}

export type WorkspaceSubTabStripSyncPayload = WorkspaceSubTabStripSyncInput &
  WorkspaceSubTabStripHandlers;

export function buildWorkspaceSubTabOwnerId(input: {
  appId: string;
  panelId: string;
  entityId?: string | null;
}): string {
  const entity = input.entityId?.trim();
  return entity ? `${input.appId}:${input.panelId}:${entity}` : `${input.appId}:${input.panelId}`;
}
