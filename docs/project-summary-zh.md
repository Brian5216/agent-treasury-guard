# Agent Treasury Guard 项目简介

## 一句话定义

Agent Treasury Guard 是一个可被任意 AI 按次付费调用的 OKX 专家 Skill。OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能直接获得免费机会扫描，并按次购买带 Treasury Policy 的交易计划、BYO Thesis 验证、风险退出方案与后续监控规则。

需要特别说明的是：普通 AI 自带 thesis 来调用 `BYO Thesis`，默认是直接向 Treasury Guard 购买验证与执行工作流；只有带完整 Provider 身份和收款地址的白名单 thesis，才会进入 `20% / 80%` 分成模式。

它卖的不是“行情接口”，而是“带风控约束的 AI 决策工作流”。

技术上说，Treasury Guard 是基于 OKX Skills，把底层链上能力封装成 AI 可直接购买的决策工作流。

它同时支持两种供给：

- `House Layer`：Treasury Guard 自营判断层
- `Provider Layer`：白名单外部 AI 提交 thesis，由 Treasury Guard 验证并按 `20% / 80%` 分成

## 用户真实需求

当前大多数 AI 虽然会聊天、会检索，但并不具备完整的链上执行能力。它们通常面临三类真实问题：

1. 不知道该调用哪些链上工具，无法把 `token search / market / quote / gateway` 组织成一个可靠流程。
2. 就算拿到了行情和报价，也缺少风险约束，容易给出“能买但不该买”的建议。
3. 即使有强 Agent，也没有简单的按次付费方式让其他 AI 调用，能力无法商品化。

Agent Treasury Guard 的价值就是同时解决这三件事。

## 核心能力

### 1. Free Opportunity Scan

输入：目标链、预算、风险偏好  
输出：按机会分排序的候选标的、风险分、简明解释、可供 AI 下一步调用的 `machineView` 与后续 premium call 提示

### 2. Premium Trade Plan

输入：代币、方向、预算、风险偏好  
输出：是否建议执行、Treasury Policy 检查、风险标记、最优报价、执行步骤、Watch Plan、下一步 OKX 调用建议

### 3. Premium BYO Thesis Plan

输入：外部 AI 已经生成的 thesis、代币、方向、预算、风险偏好  
输出：thesis 是否与 live OKX 数据一致、能否执行、是否要缩仓、如何退出、如何监控

### 4. Premium Exit Plan

输入：持仓代币、卖出方向、预算或仓位规模  
输出：减仓/清仓建议、Treasury Policy 检查、分批退出路径、Watch Plan

## 为什么 AI 不直接调用 OKX 免费能力

OKX 已经把很多底层链上技能开放出来了，比如 token、market、swap、gateway 和 x402。  
这很好，但它们解决的是“能做什么”，不是“该不该做、怎么做、什么时候停”。

Agent Treasury Guard 解决的是另一层问题：

1. 把 `token search / market / quote / gateway` 编排成一个可复用工作流。
2. 在执行前做 `Treasury Policy` 判断，避免“能买但不该买”。
3. 给出 `entry / exit / watch` 三段式决策，而不是一次性数据。
4. 支持 `BYO Thesis`，让更强的 AI 保留自己的推理层，再把判断交给 Treasury Guard 落地。
5. 输出稳定的 `machineView`，让其他 AI 可以直接续接下一步动作。
6. 用 `House + Provider + Guard` 结构兼顾自营能力和平台化增长。

所以调用方 AI 不是为“原始数据”付费，而是为“带约束的决策结果”付费。

## 为什么适合 OKX OnchainOS

- `结合度`: 直接建立在 OKX 的 token、market、swap、gateway、x402 上。
- `实用性`: 任何通用 AI 都可以调用它获得真实可执行的链上建议。
- `创新性`: 不是一个面向人类的聊天机器人，而是一个面向 AI 的付费专家服务。
- `可复制性`: 已提供 Skill、manifest、OpenAPI、buyer/provider prompts，其他 AI 可直接接入。

## 典型 A2A 场景

1. 用户问通用 AI：“给我一个 Base 链 1000U 的机会。”
2. 通用 AI 发现自己没有完整的链上决策和执行逻辑。
3. 通用 AI 先调用免费机会扫描，或直接提交自己的 thesis。
4. 当它需要高价值工作流时，调用 Agent Treasury Guard 的 premium API。
5. Treasury Guard 返回 `402 Payment Required`。
6. 通用 AI 用 x402 在 X Layer 上完成支付。
7. Treasury Guard 返回交易方案、BYO Thesis 验证结果或退出方案。
8. 通用 AI 将结果翻译成用户可读建议，或继续调用后续链上工具。

## 全 Live 验证状态

项目目前已经跑通完整 live 链路：

1. `okx-http` 直接调用 OKX live token / market / swap HTTP API 完成分析。
2. `okx-x402-api` 调 OKX x402 `supported / verify / settle`。
3. `real-wallet` payer 在 X Layer 上完成真实签名和支付。
4. 支持 `USDG / USDT / USDC` 三种稳定币支付。

最近一次全 live 演示命令：

- `npm run premium:live-demo-trade`
- `npm run premium:live-demo-exit`

最近一次 live settlement 证明：

- trade: `0x79e11af955c5f1cb62187c921b679464a0536d516f724b732281aa30034e33b8`
- exit: `0x4fb62e16e0625a6c8a448d35a640b4bab7835de6c81863a877d132fa35fa94db`

## 当前实现状态

- 已完成高阶工作流封装
- 已完成 mock OKX 数据层
- 已完成 mock x402 支付链路
- 已完成 premium paywall
- 已完成 Treasury Policy / Exit Plan / Watch Plan
- 已完成 `/manifest` 与 `openapi.yaml`
- 已完成真实 OKX x402 `verify/settle` 与真实支付闭环验证
- 已完成 `okx-http + x402 + real-wallet` 的全 live trade / exit 演示
