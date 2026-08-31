// 场景：ActionBar hideBar 时把外露 bar 投影进溢出菜单第一段（SDK 公共合同）。

export interface ProjectActionBarOverflowFoldInput {
  barIds: readonly string[];
  overflowIds: readonly string[];
  /** true：不画 bar，菜单前段补回原 bar 项 */
  hideBar: boolean;
}

export interface ProjectActionBarOverflowFoldResult {
  /** 收进菜单的原 bar ids（hideBar 时有值） */
  foldedBarIds: string[];
  /** 菜单后段：原 overflow（已去掉与 folded 重复的 id） */
  menuOverflowIds: string[];
}

/**
 * 单表面 hideBar 投影：折叠 bar → 溢出前段，overflow 仍为后段。
 * 与宪法「具名投影、禁止页面手拼」对齐。
 */
export function projectActionBarOverflowFold(
  input: ProjectActionBarOverflowFoldInput,
): ProjectActionBarOverflowFoldResult {
  const overflowIds = [...input.overflowIds];
  if (!input.hideBar) {
    return { foldedBarIds: [], menuOverflowIds: overflowIds };
  }
  const foldedBarIds = [...input.barIds];
  const foldedSet = new Set(foldedBarIds);
  return {
    foldedBarIds,
    menuOverflowIds: overflowIds.filter((id) => !foldedSet.has(id)),
  };
}
