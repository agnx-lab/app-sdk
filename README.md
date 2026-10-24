# `@agnx-lab/app-sdk`

Agnx **工作区 Sub App** 的通用协议面。第三方 / AI skill **只应依赖本包**，不得 import `@agnx-lab/app` 或 desktop 内部路径。

## 安装（目标发布形态）

```bash
npm i @agnx-lab/app-sdk
```

当前已可发布（`private` 已移除）；包内直接发布 TypeScript 源码（`files: ["src"]`），
消费方需自行用 esbuild / tsgo 处理，宿主运行时由 peer 注入提供实现。

## 最小例子

```ts
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@agnx-lab/app-sdk";

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
- 两版走同一套门闩（路径相对子应用根、文件存在、≤64KB、非占位图）；两版指向同一个文件会被判为无效。
- **不要指望 SVG 里写 `@media (prefers-color-scheme: dark)` 自适应**：宿主拿到的是 `blob:` URL，主题切换不会让图片重新求值媒体查询。必须用 `iconDark` 显式给两版。
- 打包分享时两版文件都要随 App 目录一起分发。

图标门闩的完整校验逻辑由宿主的 `sub-apps:assert-icon` 实现；子应用侧只需按上面四条准备两版文件。

## 与 Agnx 宿主

流程：`npm i @agnx-lab/app-sdk` → 按本 README / JSDoc 实现 `activate(host)` → 放入或安装到 `$AGNX_HOME/apps/<appId>/.agnx/`。

宿主运行时会把 SDK 实例**注入**进来（`workspace-app-peers`），所以：

- 子应用**不需要**把 `@agnx-lab/app-sdk` 打进自己的 bundle，标 `peerDependencies` + `optional` 即可；
- 本包的 npm 依赖只用于**类型检查**和本地构建；运行期实现由宿主提供。

## UI / 氛围（Sub App 默认）

- 面板大面：`backgroundColor: "transparent"`，透出宿主氛围渐变。
- 控件：`theme.colors.input` / `surface1` 或 `rgba(0,0,0,0.22)`；边框/字色用 `theme.colors.*`。
- **不要**根节点实色 `theme.colors.background`（氛围不改写该 token，易出灰岛）。
- 仅内容沉浸时调用 `host.ui.setAtmosphere` / `clearAtmosphere`；工具型 App 只消费、不推送。

### 表单原子（`host.ui` L0）

通用按钮 / 输入 / 芯片走宿主注入（**不要** import `@agnx-lab/app` 内部路径）：

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

实现位置在**宿主产品仓**（不在本 SDK 仓）：宿主把基础控件集中在自己的 `workspace-apps/ui/primitives/` 目录，再挂到 `host.ui` 暴露给子应用。

氛围着色的具体规范由宿主产品维护（不随本 SDK 发布）；本 SDK 只保证 `host.ui` 暴露主题 token，子应用按「只用 token、不写死颜色」实现。

## Pane 级品牌扫光 · 子应用 boot 合同

**子应用不 import 扫光组件。** `@agnx-lab/app-sdk` **未**导出 `BrandLogoLoader` / `BrandLogoLoaderPanel`，`host.ui` 也无对应 API。Pane / Tab 首屏 boot 由**宿主**在中间区统一盖 `workspace-pane-boot-overlay`（横向 Logo 扫光）。

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
import type { WorkspaceAppBrandLogoLoaderPanelProps } from "@agnx-lab/app-sdk";

const Panel = host.ui.BrandLogoLoaderPanel as ComponentType<WorkspaceAppBrandLogoLoaderPanelProps>;

// 左右布局：点导航后右侧内容区 loading
return loading ? <Panel title="加载中…" /> : <ContentView />;
```

- **Pane / Tab 首屏**仍用 `isPanelBootReady`，不要在面板根再叠全屏 Logo。
- 行内/按钮 loading 仍用 compact spinner。

### 相关文档

- 宿主侧的加载动画与刷新语义由宿主产品文档维护（不随本 SDK 发布）。子应用侧只需遵守本文件已写明的 `host.ui` 合同与 boot 就绪信号约定。
