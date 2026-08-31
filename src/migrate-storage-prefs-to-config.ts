// 场景：storage 长期 prefs → host.config 一次性迁移 helper（B3）。
import type { WorkspaceAppConfigApi, WorkspaceAppStorageApi } from "./host-api";

export type MigrateStoragePrefsToConfigResult = "migrated" | "skipped" | "noop";

export interface MigrateStoragePrefsToConfigInput {
  storage: Pick<WorkspaceAppStorageApi, "readJson">;
  config: Pick<WorkspaceAppConfigApi, "get" | "set">;
  appId: string;
  storageKey: string;
  configKey: string;
  /** 默认整份 storage 文档写入 config；可裁剪 prefs 子集。 */
  extract?: (storageDoc: unknown) => unknown;
  /** 已有有效 config 时跳过；默认：非 null/undefined 即视为已迁移。 */
  alreadyMigrated?: (configVal: unknown) => boolean;
}

/**
 * 若 config 尚无值，则从 storage 读出并写入 config（不删除 storage，双读过渡）。
 */
export async function migrateStoragePrefsToConfig(
  input: MigrateStoragePrefsToConfigInput,
): Promise<MigrateStoragePrefsToConfigResult> {
  const existing = await input.config.get({
    scope: "app",
    appId: input.appId,
    key: input.configKey,
  });
  const isMigrated =
    input.alreadyMigrated?.(existing) ?? (existing !== null && existing !== undefined);
  if (isMigrated) {
    return "skipped";
  }

  let storageDoc: unknown;
  try {
    storageDoc = await input.storage.readJson(input.appId, input.storageKey);
  } catch {
    return "noop";
  }
  if (storageDoc === null || storageDoc === undefined) {
    return "noop";
  }

  const value = input.extract ? input.extract(storageDoc) : storageDoc;
  if (value === null || value === undefined) {
    return "noop";
  }

  await input.config.set({
    scope: "app",
    appId: input.appId,
    key: input.configKey,
    value,
  });
  return "migrated";
}
