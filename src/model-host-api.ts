// 场景：宿主向 Sub App / Agent Tab 暴露「模型源」能力（L3）。
//
// 分层定位（见 docs/runtime/model-source/模型源能力契约_host-model-contract.md）：
//   L5 消费层  Agent Tab、子应用（ZCode / DSH / Magpie…）
//   L4 协议层  env overlay 注入、ACP spawn
//   L3 模型源层  ← 本模块
//   L2 存储层  config.json → agents.providers.*.endpointCredentials
//   L1 进程层  ACP 子进程 / CLI / daemon
//
// 设计要点：
// 1. **归一化出口** —— 不管底层是静态 API Key、sessionKey 换来的 token、还是 OAuth token，
//    对调用方都只是「一个凭证字符串」。参照 Sub2API `TokenInfo`（oauth_service.go:117-127）。
// 2. **能力代理** —— 默认不向调用方暴露明文；调用方拿句柄，按需 resolve。
//    resolve() 每次重新签发，宿主可在此做限流/审计/刷新。
// 3. **单一契约** —— 内部 Agent Tab 与外部子应用调同一套接口，
//    宿主内部按需选择实现（Agent 转 env overlay，子应用直接返回）。

/**
 * AI 厂家（Platform）—— 决定「讲哪种方言」。
 *
 * 与 {@link WorkspaceAppModelAccessMode} 正交：账号 = 厂家 × 接入方式。
 * 参照 Sub2API `config/domain/constants.go:19-25`。
 */
export type WorkspaceAppModelPlatform =
  | "anthropic"
  | "openai"
  | "gemini"
  | "grok"
  | "bedrock"
  | "vertex"
  | "other";

/**
 * 接入方式（AccessMode）—— 决定「怎么证明身份」。
 *
 * 只包含**凭证维度**的方式。ACP 属运行时维度，不在本枚举内；
 * 用 {@link WorkspaceAppModelApi.canInject} 表达其边界。
 */
export type WorkspaceAppModelAccessMode = "api_key" | "oauth" | "session" | "setup_token";

/**
 * 凭证的公开视图 —— **刻意不含任何 secret**。
 *
 * 调用方据此渲染选择器；要实际调用模型需经 {@link WorkspaceAppModelHandle.resolve}。
 */
export interface WorkspaceAppModelCredentialSummary {
  /** 稳定 ID，作为引用键。对应 config 的 `endpointCredentials[].id`。 */
  readonly id: string;
  /** 用户可见名字（如 "plus" / "工作号"）。 */
  readonly label: string;
  readonly platform: WorkspaceAppModelPlatform;
  readonly accessMode: WorkspaceAppModelAccessMode;
  /** 端点。登录类凭证在取得 token 前可能为空。 */
  readonly baseUrl?: string;
  /** 凭证明文是否齐全（可用于发起调用）。 */
  readonly ready: boolean;
  /** 凭证是否会过期。为 true 时应在 401 后重新 resolve。 */
  readonly expiring: boolean;
  /**
   * 该凭证挂载在哪几个 provider 下（如 `["codex", "claude"]`）。
   *
   * 为什么需要：同一份上游凭证常被多个 provider 共用（实测用户配置里
   * 37 个凭证中 35 个被 8 个 provider 挂载）。Agent Tab 要「列出 Codex 账户」时，
   * 必须能按 provider 过滤，否则会把只属于 claude 的凭证也列给 Codex。
   *
   * **可选**：旧 daemon 不返回时调用方应按「不过滤」处理，保持兼容。
   */
  readonly providerIds?: readonly string[];
}

/**
 * 解析结果 —— **归一化出口**，唯一会携带秘密的地方。
 *
 * 每次 `resolve()` 重新签发；调用方**不应**长期缓存 `apiKey`。
 */
export interface WorkspaceAppModelResolvedEndpoint {
  readonly baseUrl: string;
  /** 归一化凭证：可能是静态 API Key，也可能是刷新出来的 access_token。 */
  readonly apiKey: string;
  /** API 协议 —— 决定如何发请求（与厂家是两个维度）。 */
  readonly apiFormat: "openai_chat" | "openai_responses" | "anthropic";
  /** 宿主建议的额外请求头（如 anthropic-beta、自定义鉴权）。 */
  readonly headers?: Readonly<Record<string, string>>;
  /** 是否过期。true 表示调用方应在 401 后重新 resolve，而非长期缓存。 */
  readonly expiring: boolean;
}

/**
 * 模型句柄 —— 能力代理的核心。
 *
 * 调用方拿到的是句柄而非明文；真正的凭证解析发生在宿主侧。
 */
export interface WorkspaceAppModelHandle {
  readonly id: string;
  readonly label: string;
  readonly platform: WorkspaceAppModelPlatform;
  readonly accessMode: WorkspaceAppModelAccessMode;
  /**
   * 解析出**本次调用**所需的上游信息。
   *
   * 宿主可在此做：令牌刷新、限流、审计、协议代理改写。
   * 调用方**不应**缓存返回值中的 `apiKey`（尤其当 `expiring` 为 true）。
   */
  resolve(): Promise<WorkspaceAppModelResolvedEndpoint>;
}

/** 凭证注入不可用的原因。 */
export type WorkspaceAppModelInjectionBlockReason =
  | "not_supported"
  | "manages_own_auth"
  | "unknown_provider";

/**
 * 注入能力查询结果 —— 把 ACP 的边界显式化。
 *
 * 事实依据：`packages/server/src/server/agent/provider-config/launch-config.ts:345-350`
 * 的白名单只含 `claude-acp` / `codex-acp`；ACP catalog 36 个条目中仅 2 个带
 * `endpointCredentialType`。其余（cursor / cline …）运行时拿不到宿主凭证。
 *
 * 暴露本查询可避免「用户配了 Key 却无效」的误判。
 */
export interface WorkspaceAppModelInjectionCapability {
  /** 该智能体能否接收宿主注入的凭证。 */
  readonly canInject: boolean;
  /** 不能注入时的原因，供 UI 文案使用。 */
  readonly reason?: WorkspaceAppModelInjectionBlockReason;
}

/**
 * 模型源能力（L3）。
 *
 * 宿主未提供时 {@link WorkspaceAppHostApi.model} 为 undefined，调用方需降级。
 */
export interface WorkspaceAppModelApi {
  /**
   * 列出可用凭证。**不返回任何 secret**。
   *
   * **按凭证 `id` 去重**：同一凭证可被多个智能体引用
   * （实测 `config.json` 中 37 条凭证产生 282 次引用），
   * 调用方期望的是「有哪些账号可用」，不是引用关系。
   *
   * 调用方据此渲染选择器；要实际调用模型需 `get(id).resolve()`。
   */
  list(): Promise<readonly WorkspaceAppModelCredentialSummary[]>;

  /** 取单个句柄。id 不存在返回 null。 */
  get(id: string): Promise<WorkspaceAppModelHandle | null>;

  /**
   * 该智能体能否接收宿主注入的凭证。
   *
   * 用于在 UI 上区分「可注入」与「自管认证」，
   * 避免 ACP 凭证白名单外时用户误以为配置已生效。
   *
   * @param providerId 智能体 / 供应商 id（如 "codex-acp"、"cursor"）
   */
  canInject(providerId: string): Promise<WorkspaceAppModelInjectionCapability>;

  /**
   * 订阅凭证变更（新增 / 编辑 / 删除 / 令牌刷新）。
   *
   * 返回 unsubscribe；App deactivate 时应调用。
   */
  subscribe(listener: () => void): () => void;
}
