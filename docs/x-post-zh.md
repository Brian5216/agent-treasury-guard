# X / 星球 发布文案

## 版本 A：比赛提交版

首届 OKX OnchainOS「AI松」，我们做了 `Agent Treasury Guard`。

副标题：`Built on OKX Skills, sold as AI decision workflows`

它不是一个普通聊天机器人，而是一个可被任意 AI 按次付费调用的 OKX 专家 Skill。  
OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。

其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。

我们基于 OKX Skills，把底层链上能力封装成 AI 可直接购买的决策工作流，让其他 AI 不用自己拼底层细节，也能先免费发现候选，再按次购买：

- Free Opportunity Scan
- Premium Trade Plan
- Premium BYO Thesis Plan
- Premium Exit Plan

核心亮点：

1. A2A / M2M：通用 AI 遇到链上任务时，可直接调用 Treasury Guard
2. x402 Monetization：高价值工作流先返回 `402 Payment Required`，支付后再解锁结果
3. Treasury Policy Engine：每个计划都先做 mandate 检查，不只是“能买”，而是“该不该买/该怎么退”
4. Watch Plan：交易后自动附带监控触发条件和复查节奏
5. AI-ready Output：不仅给人类解释，也返回 AI 可继续消费的 `machineView`
6. Reusable Skill：已提供 Skill、manifest、OpenAPI，可被其他 AI 一键接入
7. Standard x402 Flow：`request -> 402 invoice -> X-PAYMENT -> verify -> settle -> unlock`
8. Full Live Demo：已跑通 `okx-http live analysis + x402 live payment + real wallet signing`
9. Provider Revenue Share：支持外部 AI 接入；普通 BYO Thesis 直接向 Treasury Guard 付费，只有白名单 Provider thesis 才进入平台 `20%` / Provider `80%` 分成

演示链路：

1. Buyer Agent 先调用免费机会扫描，或直接提交自己的 thesis
2. Treasury Guard 返回 premium invoice
3. Buyer Agent 在 X Layer 完成支付并附带 `X-PAYMENT`
4. Treasury Guard 执行 verify / settle
5. Treasury Guard 返回带 Treasury Policy 的交易/退出方案，或 BYO Thesis 验证结果与 Watch Plan
6. 如果是外部 Provider thesis，结果里同步返回 `provider + commercialTerms`

实测 live settlement：

- trade: `0x79e11af955c5f1cb62187c921b679464a0536d516f724b732281aa30034e33b8`
- exit: `0x4fb62e16e0625a6c8a448d35a640b4bab7835de6c81863a877d132fa35fa94db`
- thesis: `0x06c9591628e80336d06de69c38f5ee3b9d53c030476a947f6d1a24a6fdbf7be0`

参赛环境信息：
- Claw 型号：按实际参赛型号填写
- 大模型版本：按实际参赛版本填写

#OKX #OnchainOS #A2A #M2M #x402 #AIagent #Web3

## 版本 B：更偏传播版

如果 AI 能自己付钱，它就不只是助手，而是经济体的一部分。

我们做了一个叫 `Agent Treasury Guard` 的 OKX 专家 Skill：  
任何 AI 都可以按次付费调用它，获得带 Treasury Policy 的交易计划、BYO Thesis 验证、退出方案和 Watch Plan。

如果它是外部 Provider，Treasury Guard 还负责：

- 验证 thesis
- 统一风控
- 标准化输出
- 按次收费
- 白名单 Provider 的 `20/80` 分账

底层用的是 OKX 的：
- token
- market
- swap
- gateway
- x402

而且这不是 mock。  
我们已经跑通：

- OKX live analysis
- x402 live verify / settle
- X Layer real payment

所以我们的重点不是“再做一个会聊天的交易 bot”，而是让 AI 之间真的能完成：

`发现需求 -> 请求专家 -> 支付 -> 获取执行方案`

这才是我们理解的 Web3 原生 AI 工作流。

参赛环境信息：
- Claw 型号：按实际参赛型号填写
- 大模型版本：按实际参赛版本填写

## 配图建议

1. 一张总览图：Buyer Agent -> 402 invoice -> Payment -> Treasury Guard result
2. 一张 free opportunity scan 截图
3. 一张 premium trade plan 截图
4. 一张 `openapi.yaml` 或 `/manifest` 截图
