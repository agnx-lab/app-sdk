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
    icon: "sticky-note", // optional; host maps known keys → Lucide
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

| 分组            | API                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 贡献            | `registerPrimarySegment` / `ItemProvider` / `Command` / `MiniApp` / `ItemMenu` / `Shortcut`                                 |
| 导航            | `openMiniAppTab` / `requestPrimaryView`                                                                                     |
| 文件            | `files.pickAndImport` / `files.resolveObjectUrl`                                                                            |
| 存储            | `storage.getDataRoot` / `clearData` / **`readJson` / `writeJson`**（`apps/data/<id>/state/<key>.json`，经 daemon 三端共享） |
| HTTP            | `http.fetchJson`（主进程 JSON）；可选 **`http.createMediaProxyUrl`**（localhost Range 流式代理）                            |
| Android（可选） | **`android?`**（设备/会话/命令/帧流；capability 闸；见 Android 主机服务合同）                                               |
| 浏览器会话      | 可选 **`browserSession.captureMedia`**（屏外页截 `audio/*`；桌面 Electron）                                                 |
| 平台            | `platform.isWeb`                                                                                                            |
| 同步            | **`sync?.publish` / `sync?.subscribe`**（§10.7：revision ping 经 daemon WS；可选接入）                                      |

### 何时接 sync（S4）

1. **只 storage**：数据只需本端持久、对端下次打开再读即可。
2. **storage + sync**：写共享 JSON 后要让**已打开**的其他客户端即时 rehydrate（Notes/Music 列表）。
3. **不要**为 Agent 对话再包一层 sync（已有 daemon WS）。
4. 未 `subscribe` 的 App：零开销。

样例见 `packages/mini-apps/agnx.notes` / `com.example.music` 的 store 写后 publish。

**禁止**在本包增加行业语义（如 `pickMusic`）。过滤扩展名等由 App 自己传入 `files.pickAndImport`。

## 产物放置

构建后放到 `$AGNX_HOME/apps/<manifest.id>/`（可软链）。宿主扫描 `manifest.json` → 加载态为「已安装」时 `activate(host)`。

打包分享：桌面托盘「打包为 .agnxapp」→ `$AGNX_HOME/app-packages/`。

## 与 skill

`agnx-app` skill（智能体代写微应用）：

- 本机：`~/.agents/skills/agnx-app/SKILL.md`
- 仓库：`skills/agnx-app/SKILL.md`

流程：`npm i @getagnx/app-sdk` → 按本 README / JSDoc / skill 实现 `activate(host)` → 放入或安装到 `$AGNX_HOME/apps`。

## UI / 氛围（Mini-App 默认）

- 面板大面：`backgroundColor: "transparent"`，透出宿主氛围渐变。
- 控件：`theme.colors.input` / `surface1` 或 `rgba(0,0,0,0.22)`；边框/字色用 `theme.colors.*`。
- **不要**根节点实色 `theme.colors.background`（氛围不改写该 token，易出灰岛）。
- 仅内容沉浸时调用 `host.ui.setAtmosphere` / `clearAtmosphere`；工具型 App 只消费、不推送。

详见仓内 `docs/应用氛围色系统需求_app-atmosphere-system.md` 与 `agnx-app` skill「UI 主题与氛围」。
