# `@getagnx/app-sdk`

Agnx **工作区 Sub App** 的通用协议面。第三方 / AI skill **只应依赖本包**，不得 import `@getagnx/app` 或 desktop 内部路径。

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
    run: () => {
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

样例见 `packages/sub-apps/agnx.notes` / `com.example.music` 的 store 写后 publish。

**禁止**在本包增加行业语义（如 `pickMusic`）。过滤扩展名等由 App 自己传入 `files.pickAndImport`。

## 产物放置

构建后放到 `$AGNX_HOME/apps/<manifest.id>/`（可软链）。宿主扫描 `manifest.json` → 加载态为「已安装」时 `activate(host)`。

打包分享：桌面托盘「打包为 .agnxapp」→ `$AGNX_HOME/app-packages/`。

## App 图标合同（manifest 静态配置）

命令面板「子应用」列表的 leading 图标 **只读 `manifest.json` 的 `icon` / `iconDark` 字段**（相对 App 根目录的静态文件路径，如 `"./assets/icon.svg"`）。宿主扫描时解析为绝对路径，**不靠** `activate` / `registerCommand` / `registerMiniApp` 运行时贡献点。

| 表面                 | 图标来源                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| 命令面板「子应用」行 | **`manifest.icon`**（扫描 `iconPath`）→ 无则 `registerCommand.icon` → `registerMiniApp.icon` → `AppWindow` |
| Tab / 切换器         | `registerMiniApp.icon`（运行时组件）                                                                       |
| 侧栏主视图分段       | `registerPrimarySegment.icon`                                                                              |

**Sub App 作者义务：**

1. 在 `manifest.json` 写 `"icon": "./相对路径/brand.svg"`（或 png/webp），文件随 App 目录一起分发。
2. Tab/侧栏若需动态组件标，可另在 `registerMiniApp` / `registerCommand` 传 `WorkspaceAppIcon`；与 manifest 静态标互不替代。
3. 改图标后保存 manifest + 替换文件 → 命令面板「子应用 → 重新扫描」即可，**无需改宿主代码**。

### 明暗两版图标（`iconDark`，可选）

品牌图标是纯黑 / 纯白单色时（如 DeepSeek），在浅色主题下看得见、深色主题下就糊成一片。这类 App 可以再声明一版深色图标：

```json
{
  "icon": "./apps/web/public/favicon.svg",
  "iconDark": "./apps/web/public/favicon-dark.svg"
}
```

- **`icon`** = 基础版（浅色主题首选）；**`iconDark`** = 深色主题版。
- 宿主按**解析后的实际主题**选版：深色主题（`dark` / `darkZinc` / `darkMidnight` / `darkClaude` / `darkGhostty`）且声明了 `iconDark` → 用深色版；其余一律用 `icon`。
- **`iconDark` 完全是可选的**：不写就是「只有一版图标」，深色主题沿用 `icon`，与改造前行为完全一致。
- 两版走同一套门闩（相对仓根、文件存在、≤64KB、非脚手架占位图），`npm run sub-apps:assert-icon` 会一起校验；两版指向同一个文件会被判为无效。
- **不要指望 SVG 里写 `@media (prefers-color-scheme: dark)` 自适应**：宿主拿到的是 `blob:` URL，主题切换不会让图片重新求值媒体查询。必须用 `iconDark` 显式给两版。
- 打包分享时两版文件都要随 App 目录一起分发。

详见 `skills/agnx-app/SKILL.md` §App 图标与 Logo。

## 与 skill

`agnx-app` skill（智能体代写子应用）：

- **唯一权威（本仓库）：** `skills/agnx-app/SKILL.md`
- **禁止**复制到 `~/.agents/skills/` 或 `~/.claude/skills/`（会泄漏到其他非 Agnx 项目）
- **本机 Cursor 仅在本仓库生效：** `mkdir -p .cursor/skills && ln -sf ../../skills/agnx-app .cursor/skills/agnx-app`（`.cursor/` 已 gitignore，各开发者本地执行一次）

流程：`npm i @getagnx/app-sdk` → 按本 README / JSDoc / skill 实现 `activate(host)` → 放入或安装到 `$AGNX_HOME/apps`。

## UI / 氛围（Sub App 默认）

- 面板大面：`backgroundColor: "transparent"`，透出宿主氛围渐变。
- 控件：`theme.colors.input` / `surface1` 或 `rgba(0,0,0,0.22)`；边框/字色用 `theme.colors.*`。
- **不要**根节点实色 `theme.colors.background`（氛围不改写该 token，易出灰岛）。
- 仅内容沉浸时调用 `host.ui.setAtmosphere` / `clearAtmosphere`；工具型 App 只消费、不推送。

### 表单原子（`host.ui` L0）

通用按钮 / 输入 / 芯片走宿主注入（**不要** import `@getagnx/app` 内部路径）：

| 符号                | 用途                                   |
| ------------------- | -------------------------------------- |
| `host.ui.Button`    | `variant` + `size`；新风格只扩 variant |
| `host.ui.TextField` | 单行真输入框                           |
| `host.ui.Chip`      | 内容宽次级芯片                         |
| `host.ui.Select`    | field 风下拉（触发器对齐 TextField）   |

```ts
createElement(host.ui.Button, { variant: "default", size: "sm", onPress, children: "保存" });
createElement(host.ui.TextField, { value, onChangeText, placeholder });
createElement(host.ui.Chip, { label: "选择目录", onPress });
createElement(host.ui.Select, {
  value,
  options: [{ id: "a", label: "选项 A" }],
  onSelect: setValue,
  placeholder: "请选择",
});
```

实现目录（宿主）：`packages/app/src/workspace-apps/ui/primitives/`。以后新控件往该目录加，再挂到 `host.ui`。

详见仓内 [应用氛围宪法](../../docs/constitutions/应用氛围_app-atmosphere.md)、[应用氛围基准与进度](../../docs/应用氛围基准与进度_app-atmosphere-baseline-and-progress.md) 与 `agnx-app` skill「UI 主题与氛围」。

## Pane 级品牌扫光 · 子应用 boot 合同

**子应用不 import 扫光组件。** `@getagnx/app-sdk` **未**导出 `BrandLogoLoader` / `BrandLogoLoaderPanel`，`host.ui` 也无对应 API。Pane / Tab 首屏 boot 由**宿主**在中间区统一盖 `workspace-pane-boot-overlay`（横向 Logo 扫光）。

### 子应用应做什么

在 `registerMiniApp` 上挂 **boot 就绪信号**（与 `component` 配对）：

| 字段                                                 | 用途                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| `isPanelBootReady?: () => boolean`                   | 同步读：面板已 mount 且首屏数据/水合完成 → `true` |
| `subscribePanelBootReady?: (listener) => () => void` | 就绪态变化时通知宿主（供 `useSyncExternalStore`） |

未注册时宿主视为「无额外 boot 等待」；有异步首屏（IDB/宿主 storage 水合、大列表首包等）的 App **应**注册，避免 F5 后内容已可点但扫光不拆，或子应用自绘第二套 loading。

### 最小例子（参考 `com.example.music`）

```ts
host.registerMiniApp({
  id: "demo.main",
  appId,
  title: "Demo",
  component: DemoPanel,
  isPanelBootReady: () => demoStore.getState().hydrated,
  subscribePanelBootReady: (onStoreChange) =>
    demoStore.subscribe(
      (s) => s.hydrated,
      () => onStoreChange(),
    ),
});
```

- 子应用 **面板内部**行内/按钮 loading：继续用 compact spinner（DESIGN 允许）。
- **不要**在面板里再画一层全屏 Logo 扫光（会与宿主 pane overlay 叠双段动画）。
- 若未来需要在面板**内部区块**也用同款扫光：使用 **`host.ui.BrandLogoLoader` / `host.ui.BrandLogoLoaderPanel`**（与宿主同源组件）；**禁止** copy 宿主 CSS。

### `host.ui` 品牌扫光（面板内内容区）

```tsx
import type { ComponentType } from "react";
import type { WorkspaceAppBrandLogoLoaderPanelProps } from "@getagnx/app-sdk";

const Panel = host.ui.BrandLogoLoaderPanel as ComponentType<WorkspaceAppBrandLogoLoaderPanelProps>;

// 左右布局：点导航后右侧内容区 loading
return loading ? <Panel title="加载中…" /> : <ContentView />;
```

- **Pane / Tab 首屏**仍用 `isPanelBootReady`，不要在面板根再叠全屏 Logo。
- 行内/按钮 loading 仍用 compact spinner。

### 相关文档

- [品牌加载全仓升级台账](../../docs/foundation/品牌加载全仓升级台账_brand-loading-rollout-progress.md) §6
- [子应用加载模式与刷新语义](../../docs/sub-app/子应用加载模式与刷新语义需求_sub-app-load-mode-refresh-semantics-requirements.md) §4.4（F5 + React Compiler 踩坑）
