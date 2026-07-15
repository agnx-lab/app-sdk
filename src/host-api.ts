// 场景：宿主注入给外置 Mini-App 的运行时 API（通用；与具体行业 App 无关）。
import type {
  WorkspaceAppCommandContribution,
  WorkspaceAppItemMenuContribution,
  WorkspaceAppItemProviderContribution,
  WorkspaceAppListItem,
  WorkspaceAppMiniAppContribution,
  WorkspaceAppPrimarySegmentContribution,
  WorkspaceAppShortcutContribution,
} from "./types";

export interface WorkspaceAppRunContext {
  serverId?: string;
  workspaceId?: string;
  currentPathname?: string | null;
}

/** 经宿主托管后的文件引用（本地上传 / 附件目录）；各 App 自行解释 mime。 */
export interface WorkspaceAppManagedFile {
  title: string;
  /** 托管路径或 blob:/http(s): URI，可供后续 resolveObjectUrl。 */
  uri: string;
  mimeType?: string;
  /** local = 本机导入；remote = 网络资源（若宿主支持）。 */
  origin?: "local" | "remote";
}

export interface WorkspaceAppPickFilesInput {
  title?: string;
  multiple?: boolean;
  /** 扩展名不带点，如 ["mp3","png","pdf"] */
  extensions?: readonly string[];
  /** Web file input accept，如 "audio/*,.mp3" 或 "image/*" */
  accept?: string;
  filterLabel?: string;
}

/**
 * 宿主实现；外置 `main` 的 `activate(host)` 只依赖此通用 surface。
 * 行业能力（播放器、画板、表格…）留在各 Mini-App；宿主只提供壳与文件/工作区服务。
 */
export interface WorkspaceAppHostApi {
  registerPrimarySegment(contribution: WorkspaceAppPrimarySegmentContribution): void;
  registerItemProvider(contribution: WorkspaceAppItemProviderContribution): void;
  registerCommand(contribution: WorkspaceAppCommandContribution): void;
  registerMiniApp(contribution: WorkspaceAppMiniAppContribution): void;
  registerItemMenu(contribution: WorkspaceAppItemMenuContribution): void;
  registerShortcut(contribution: WorkspaceAppShortcutContribution): void;

  openMiniAppTab(input: {
    appId: string;
    panelId: string;
    entityId?: string;
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  }): boolean;

  requestPrimaryView(segmentId: string): void;

  /** 通用文件 Host Service（选文件、导入附件、解析可读 URI）。 */
  files: {
    pickAndImport(input?: WorkspaceAppPickFilesInput): Promise<WorkspaceAppManagedFile[]>;
    /** 将托管路径 / blob / http 解析为可给 media 元素用的 object URL 或原样 URI。 */
    resolveObjectUrl(uri: string): Promise<string>;
  };

  /** 平台门控摘要（避免 App 依赖宿主 constants）。 */
  platform: {
    isWeb: boolean;
  };
}

export interface WorkspaceAppModule {
  appId: string;
  activate(host: WorkspaceAppHostApi): void | Promise<void>;
}

export type { WorkspaceAppListItem };
