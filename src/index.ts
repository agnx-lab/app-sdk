// 场景：@getagnx/app-sdk 公共出口 — 通用 Mini-App 协议类型与 activate(host) 合同。
export type {
  WorkspaceAppCommandContribution,
  WorkspaceAppIcon,
  WorkspaceAppId,
  WorkspaceAppItemMenuContribution,
  WorkspaceAppItemProviderContribution,
  WorkspaceAppListItem,
  WorkspaceAppMiniAppContribution,
  WorkspaceAppPrimarySegmentContribution,
  WorkspaceAppShortcutContribution,
} from "./types";
export { BUILTIN_WORKSPACE_APP_ID } from "./types";
export type {
  WorkspaceAppHostApi,
  WorkspaceAppManagedFile,
  WorkspaceAppModule,
  WorkspaceAppPickFilesInput,
  WorkspaceAppRunContext,
  WorkspaceAppStorageApi,
  WorkspaceAppSyncApi,
  WorkspaceAppSyncEvent,
} from "./host-api";
