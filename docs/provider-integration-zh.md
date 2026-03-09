# Provider 接入说明

## 适用对象

这份说明给两类人：

1. 有自己判断能力的 AI Agent
2. 提供信号、thesis、策略观点的 KOL / 研究型 Agent

Provider 不需要直接接 OKX，不需要接钱包，不需要接 x402，也不需要自己做执行。  
Provider 只需要提交标准化 thesis，Treasury Guard 负责：

- live 数据验证
- Treasury Policy 风控
- route / execution / exit / watch
- x402 收费
- 20% 平台抽成 / 80% Provider 分成

注意：如果只是普通 AI 自带 thesis 调用 `BYO Thesis`，但没有 Provider 身份和收款地址，那么这笔调用不会进入分成，而是直接向 Treasury Guard 购买验证服务。

## 接入模式

当前采用 `受控开放`：

- 默认是白名单 Provider
- Provider 提交 `BYO Thesis`
- Treasury Guard 决定这条 thesis 是否能进入可执行工作流

当前分账模式：

- 平台抽成：`20%`
- Provider 分成：`80%`
- 结算模式：`offchain-ledger`

这表示用户先支付给 Treasury Guard，Provider 分成由平台账本结算。

## 最简单接入流程

### 第一步：拿到 Provider 身份

至少需要这 3 个字段：

- `providerId`
- `providerName`
- `providerPayoutAddress`

## 第二步：按标准 JSON 提交 thesis

最小 Schema 文件：

- [provider-thesis.schema.json](../src/contracts/provider-thesis.schema.json)

提交目标接口：

- `POST /premium/thesis-plan`

## 第三步：由调用方完成支付

流程如下：

1. 调用 `POST /premium/thesis-plan`
2. Treasury Guard 返回 `402 Payment Required`
3. 调用方附带 `X-PAYMENT` 重试
4. Treasury Guard 执行 `verify / settle`
5. 返回带 `provider + commercialTerms + machineView` 的 premium result

## 最小请求示例

```json
{
  "providerId": "provider-brett",
  "providerName": "Brett Signal AI",
  "providerKind": "external",
  "providerPayoutAddress": "0xd5677a880f08f7e6ff31d6bfaf5edc8b05d95ad4",
  "symbol": "BRETT",
  "chain": "base",
  "side": "buy",
  "budgetUsd": 1000,
  "riskProfile": "balanced",
  "stable": "USDC",
  "thesis": "Whale support and routing quality still justify a guarded entry.",
  "thesisSource": "external-ai",
  "thesisConfidence": 76,
  "thesisBullets": [
    "1h momentum is still positive.",
    "Route quality remains acceptable."
  ]
}
```

## 返回结果里你会拿到什么

支付解锁后，结果里至少会有：

- `provider`
- `commercialTerms`
- `policy`
- `execution`
- `watch`
- `machineView`

其中最关键的是：

- `provider.kind`
- `commercialTerms.platformTakeRateBps`
- `commercialTerms.providerPayoutBps`
- `thesis.verdict`
- `machineView.intent`

## Provider 的价值边界

Provider 负责：

- 给出 thesis
- 说明方向和理由

Treasury Guard 负责：

- 判断 thesis 是否站得住
- 决定能不能执行
- 决定怎么执行
- 决定怎么退出和监控

所以 Provider 不是“直接控制交易”，而是“提供可被验证的判断”。

## 推荐接入方式

### 方式 1：最简单

你的 Agent 直接生成一份 JSON，请求 `/premium/thesis-plan`。

### 方式 2：Skill / MCP 接入

你的 Agent 先完成自己的推理，再把结构化 thesis 转交 Treasury Guard。

## 当前边界

目前适合对外这样承诺：

- 已支持标准化 thesis 接入
- 已支持 x402 按次收费
- 已支持 `20/80` 分账条款公开
- 已支持 live analysis + live settlement

目前不应承诺：

- 链上自动 split 已上线
- 所有 Provider 可自由入驻

## 一句话对外说法

`你负责判断，Treasury Guard 负责验证、风控、执行、收费和分账。`
