// 场景：ActionBar hideBar 时 bar→overflow 投影单测（SDK）。
import { describe, expect, it } from "vitest";
import { projectActionBarOverflowFold } from "./project-action-bar-overflow";

describe("projectActionBarOverflowFold", () ***REMOVED*** {
  it("hideBar=false 时不折叠，仅返回 overflow", () ***REMOVED*** {
    expect(
      projectActionBarOverflowFold({
        barIds: ["pin", "detail"],
        overflowIds: ["share", "addPlaylist"],
        hideBar: false,
      }),
    ).toEqual({
      foldedBarIds: [],
      menuOverflowIds: ["share", "addPlaylist"],
    });
  });

  it("hideBar=true 时 bar 进前段，overflow 去重后进后段", () ***REMOVED*** {
    expect(
      projectActionBarOverflowFold({
        barIds: ["pin", "detail", "playNext"],
        overflowIds: ["share", "pin", "addPlaylist"],
        hideBar: true,
      }),
    ).toEqual({
      foldedBarIds: ["pin", "detail", "playNext"],
      menuOverflowIds: ["share", "addPlaylist"],
    });
  });
});
