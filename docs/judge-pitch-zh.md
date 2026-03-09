# 评委讲法

## 15 秒版本

`Agent Treasury Guard` 不是一个聊天机器人，而是一个基于 OKX Skills 的 AI 决策工作流产品。  
OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。

## 30 秒版本

OKX 已经把很多底层链上技能开放了，但其他 AI 仍然要自己拼 `token / market / quote / gateway`，而且缺少风控判断。  
`Agent Treasury Guard` 解决的是这层问题：它先用 OKX live 数据完成分析，再用 `Treasury Policy + Watch Plan` 生成可执行的 entry/exit 决策；如果别的 AI 已经有自己的 thesis，还可以直接走 `BYO Thesis` 模式，再通过 x402 在 X Layer 上按次收费。普通 BYO Thesis 是直接服务，只有白名单 Provider thesis 才会进入 `20% / 80%` 分成。  
所以我们卖的不是数据，而是可复用、可付费、可直接被其他 AI 调用的决策工作流。

## 60 秒版本

今天大多数 AI 不缺对话能力，缺的是完整的链上执行工作流。  
它们不会自己做 token 搜索、机会排序、风险判断、最佳报价、退出策略，也没有一套标准方式去购买另一个 AI 的高价值结果。

`Agent Treasury Guard` 的做法不是重复造一个行情机器人，而是站在 OKX OnchainOS 之上，把 `token + market + swap + gateway + x402` 封装成四个高阶能力：

1. `Free Opportunity Scan`
2. `Premium Trade Plan`
3. `Premium BYO Thesis Plan`
4. `Premium Exit Plan`

调用流程是标准 A2A：

1. Buyer Agent 先拿免费 shortlist，或直接提交自己的 thesis
2. Treasury Guard 用 OKX live analysis 完成验证
3. 返回 `402 Payment Required`
4. Buyer Agent 在 X Layer 上用 `USDG / USDT / USDC` 支付
5. Treasury Guard 调用 OKX x402 `verify / settle`
6. 解锁带 `Treasury Policy + Watch Plan + machineView` 的结果

所以我们的核心创新不是“接了 OKX”，而是把 OKX 的底层链上技能做成了 AI 愿意按次付费购买的决策工作流。

而且这个工作流不是只有 Treasury Guard 自己能卖。  
它也支持外部 Provider 提交 thesis，由 Treasury Guard 验证后上架，平台抽成 20%。

## 对应评选标准

### 结合度

直接建立在 OKX live token、market、swap、gateway 和 x402 之上，且已跑通真实分析与真实支付闭环。

### 实用性

调用方 AI 不需要再自己拼底层工具，可以直接买到机会扫描、入场计划、退出计划和后续监控规则。

### 创新性

不是面向人的聊天机器人，而是面向 AI 的可收费专家 Skill，把 A2A 与 x402 真正落地成产品。

### 可复制性

已提供 Skill、Premium API、`/manifest`、`openapi.yaml`、Buyer/Provider prompts，其他 AI 可以直接接入。
