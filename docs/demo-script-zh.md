# Agent Treasury Guard 视频脚本

## 版本 A：60 秒快节奏版

### 0-5 秒

画面：标题页  
字幕：`Agent Treasury Guard | 基于 OKX Skills 的 AI 决策工作流`

旁白：
“OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。”

### 5-15 秒

画面：展示通用 AI / Buyer Agent 的提问，以及外部 Provider thesis  
示例问题：
`这个外部 AI 认为 BRETT 还能继续走强，请帮我验证并给出执行方案。`

旁白：
“外部 AI 可以负责判断，但最终能不能上链、怎么收费、怎么退出，要交给 Treasury Guard。”

### 15-25 秒

画面：运行 `npm run premium:live-demo-thesis`  
重点停留在：
- `Mode: Thesis`
- `Analysis adapter: okx-http`
- `Settlement asset: USDT`
- `Settlement tx`
- `Provider: Brett Signal AI (external)`
- `Revenue split: platform 20% / provider 80%`

旁白：
“Treasury Guard 先用 OKX live 数据验证外部 Provider thesis，再通过 x402 在 X Layer 上完成真实收费和结算。”

录制说明：
如果要展示 Provider `20/80` 分成，需要先设置 `TREASURY_GUARD_LIVE_PROVIDER_ID / NAME / KIND / PAYOUT_ADDRESS`。不设置时，这个命令默认展示的是普通 BYO Thesis 直购模式。

### 25-35 秒

画面：展示发票字段和支付结果  
重点标红：
- `chainIndex: 196`
- `acceptedAssets: USDG / USDT / USDC`
- `settlement tx`
- `providerId: provider-brett`
- `platformTakeRateBps: 2000`
- `providerPayoutBps: 8000`
- 可补一行最近一次 live tx：`0x06c9591...bf7be0`

旁白：
“支付跑在 OKX 支持的 X Layer 上，同一张 invoice 支持三种稳定币；如果这是白名单 Provider thesis，还会公开 20% 平台抽成和 80% Provider 分成。”

### 35-45 秒

画面：显示支付后返回的 premium thesis result  
展示：
- `decision`
- `policy`
- `risk`
- `thesis verdict`
- `watch triggers`

旁白：
“付费成功后，Treasury Guard 返回的不是原始数据，而是带 Treasury Policy、thesis verdict 和 Watch Plan 的可执行结果。”

### 45-55 秒

画面：补一帧 `npm run premium:live-demo-trade` 或 `prepare-trade --adapter okx-http`  
展示：
- `decision: proceed`
- `policy: pass`
- `route`
- `nextCalls`
- 可补一行最近一次 live tx：`0x79e11a...33b8`

旁白：
“所以这不是只会分析的 Agent，而是一个既有自营判断层、又支持外部 Provider 接入的决策执行层。”

### 55-60 秒

画面：展示 `openapi.yaml` 与 `/manifest`

旁白：
“所以这不是单个 Demo，而是一个基于 OKX Skills、可被其他 AI 一键接入并按次购买的决策工作流平台。”

## 版本 B：90 秒完整讲解版

### 第一段：问题

“今天大多数 AI 不缺对话能力，缺的是可执行的链上工作流。它们不会自己做 token 分析、持仓风险判断、最佳报价路由和执行跟踪。”

### 第二段：解决方案

“Agent Treasury Guard 把 OKX 的 token、market、swap、gateway 和 x402 封装成四个高阶能力：免费机会扫描、自营交易计划、BYO Thesis 验证、风险退出。”

### 第三段：商业模式

“更关键的是，它不是直接开放底层链上技能，而是让自营判断层和外部 thesis 都能通过 x402 被按次付费调用；只有白名单 Provider workflow 才进入 20% 平台抽成。”

### 第四段：演示

1. Buyer Agent 提交外部 Provider 的 thesis  
2. Treasury Guard 用 live OKX 数据完成验证  
3. 返回 `402 Payment Required`  
4. Buyer Agent 在 X Layer 完成支付  
5. Treasury Guard 执行 verify / settle  
6. 返回带 `provider + commercialTerms + Treasury Policy + Watch Plan + machineView.nextCalls` 的结果

### 第五段：总结

“这让任意 AI 都可以快速获得可靠的 OKX 链上能力，同时让 Treasury Guard 成为 AI Provider 平台的风控、执行与结算层。OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。”
