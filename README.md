# `@getagnx/app-sdk`

Agnx **工作区 Mini-App** 的通用协议面。第三方 / AI skill **只应依赖本包**，不得 import `@getagnx/app` 或 desktop 内部路径。

## 安装（目标发布形态）

```bash
npm i @getagnx/app-sdk
```

当前仍在 monorepo 内（`"private": true`）；对外 `npm publish` 前会去掉 private 并补齐构建产物 `dist/`。

## 最小例子

```ts
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@getagnx/app-sdk";

export const appId = "com.example.demo";

export function activate(host: WorkspaceAppHostApi): void {
  host.registerPrimarySegment({
    id: "demo",
    appId,
    label: "Demo",
    order: 60,
  });
  host.registerCommand({
    id: "demo.open",
    appId,
    title: "打开 Demo",
    run: () ***REMOVED*** {
      host.openMiniAppTab({ appId, panelId: "demo.main" });
    },
  });
}

const mod: WorkspaceAppModule = { appId, activate };
export default mod;
```

## Host 表面（摘要）

| 分组 | API                                                                                         |
| ---- | ------------------------------------------------------------------------------------------- |
| 贡献 | `registerPrimarySegment` / `ItemProvider` / `Command` / `MiniApp` / `ItemMenu` / `Shortcut` |
| 导航 | `openMiniAppTab` / `requestPrimaryView`                                                     |
| 文件 | `files.pickAndImport` / `files.resolveObjectUrl`                                            |
| 存储 | `storage.getDataRoot` / `storage.clearData`（默认 `$AGNX_HOME/app-data/<appId>`）           |
| 平台 | `platform.isWeb`                                                                            |

**禁止**在本包增加行业语义（如 `pickMusic`）。过滤扩展名等由 App 自己传入 `files.pickAndImport`。

## 产物放置

构建后放到 `$AGNX_HOME/apps/<manifest.id>/`（可软链）。宿主扫描 `manifest.json` → 加载态为「已安装」时 `activate(host)`。

打包分享：桌面托盘「打包为 .agnxapp」→ `$AGNX_HOME/app-packages/`。

## 与 skill

未来 `agnx-app` skill：`npm i @getagnx/app-sdk` → 按本 README / JSDoc 实现 `activate(host)` → 放入或安装到 apps。
