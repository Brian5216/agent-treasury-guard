# Agent Treasury Guard

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Built on OKX Skills, sold as AI decision workflows**

Agent Treasury Guard 是一个建立在 OKX Skills 之上的 AI 决策工作流产品。  
OKX 提供底层链上技能，Treasury Guard 把它们组织成 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。

## 快速入口

- [工作流能力层](./SKILL.md)
- [接口契约](./openapi.yaml)
- [总架构图](./docs/architecture.md)
- [叙事插图](./docs/article-visuals-zh.md)
- [价值主张](./docs/longform-intro-zh.md)
- [Live 证明](./docs/live-proof.md)
- [证据台账](./docs/workflow-evidence.md)
- [最终提交清单](./docs/final-submission-checklist-zh.md)

## 一句话理解

如果把 OKX Skills 看成底层链上积木，那么 Treasury Guard 就是把这些积木组织成 AI 可直接购买的成品工作流。

它卖的不是单点数据接口，而是：

- `policy`: 该不该做
- `trade`: 怎么入场
- `exit`: 怎么退场
- `watch`: 后续怎么盯
- `machineView`: 其他 AI 如何继续调用

## 为什么不是直接拼 OKX Skills

OKX Skills 已经让其他 AI 可以直接使用 `token / market / quote / gateway`。  
但问题是，调用方 AI 仍然需要自己：

- 手工编排多个技能
- 自己补风险约束
- 自己决定入场和退出
- 自己定义监控条件
- 自己处理支付与结果解锁

Treasury Guard 解决的是这一层问题：把底层链上技能升级成可直接购买的决策工作流。

## 核心能力

- `Free Opportunity Scan`
  先免费给 shortlist 和下一步 premium call 提示
- `Premium Trade Plan`
  带 Treasury Policy 的入场计划
- `Premium BYO Thesis Plan`
  让其他 AI 带着自己的 thesis 来买验证与执行方案
- `Premium Exit Plan`
  带分批减仓、清仓和 watch 规则的退出方案

## 商业模式

- `House workflows`
  Treasury Guard 自营判断层直接收费
- `Direct BYO Thesis`
  普通 AI 自带 thesis，直接购买 Treasury Guard 的验证服务
- `Provider workflows`
  白名单 Provider thesis 才进入 `20% / 80%` 分成

## 技术与支付

- 分析层支持：
  - `mock`
  - `onchainos-cli`
  - `okx-http`
- x402 支付层支持：
  - `mock-x402`
  - `okx-x402-api`
- 目前支持 `X Layer` 上的：
  - `USDG`
  - `USDT`
  - `USDC`

## 快速开始

```bash
cd agent-treasury-guard
npm test
npm run preflight
npm run premium:demo
npm run premium:live-demo-thesis
```

## 关键命令

```bash
npm run preflight
npm run premium:live-smoke
npm run premium:real-payment-thesis-smoke
npm run premium:live-demo-thesis
npm run premium:live-demo-trade
```

## 最适合先看的材料

如果你第一次看这个项目，建议按这个顺序：

1. [长文介绍](./docs/longform-intro-zh.md)
2. [长文插图](./docs/article-visuals-zh.md)
3. [Live 证明](./docs/live-proof.md)
4. [证据台账](./docs/workflow-evidence.md)
5. [技能说明](./SKILL.md)
6. [OpenAPI 契约](./openapi.yaml)

## 当前边界

- `offchain-ledger` 仍是 Provider 分成的当前结算方式，不是链上自动 split
- 比赛主链路已经验证完成，当前更适合冻结核心功能，专注录屏与提交
