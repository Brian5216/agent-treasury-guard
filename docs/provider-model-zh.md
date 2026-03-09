# Provider 模式

## 一句话

Treasury Guard 采用 `House + Provider + Guard` 三层结构：

- `House Layer`：Treasury Guard 自营判断层
- `Provider Layer`：外部 AI / KOL / 策略提供方提交 thesis
- `Guard Layer`：Treasury Guard 统一做 policy、execution、exit、watch、收费与分账

## 为什么这样设计

这让我们不需要证明“自己永远是最强分析模型”。  
更强的 AI 可以继续做判断，我们负责把判断变成安全、标准、可收费的链上工作流。

## 当前分账设计

- 平台抽成：`20%`
- Provider 分成：`80%`

注意：这套分成只适用于白名单 Provider。普通 AI 的 `BYO Thesis` 调用，不会自动进入分成，而是直接购买 Treasury Guard 的验证与执行服务。

当前实现是：

- 合同级 / API 级公开分账条款
- 结果里返回 `provider` 与 `commercialTerms`
- x402 invoice 会带 `platformTakeRateBps / providerPayoutBps`

当前还没有实现链上自动 split，结算模式明确标为：

- `offchain-ledger`

这表示：

1. 用户先向 Treasury Guard 支付
2. Treasury Guard 按账本给 Provider 结算

## 为什么 20% 合理

因为平台不是只做代收款，而是提供：

1. 用户分发
2. x402 收费
3. Treasury Policy 风控
4. 执行路径与路由
5. Exit / Watch
6. 标准化 `machineView`

如果只是代收款，20% 会偏高；  
如果是完整的风控与执行层，20% 是有依据的。

## 当前边界

我们当前采用的是 `受控开放`，不是完全开放市场：

- 默认使用 House Layer
- 外部 Provider 通过 `BYO Thesis` 接入
- 最终是否允许执行，永远由 Treasury Guard 决定

## 比赛里怎么讲

不要把它讲成“策略市场已经完全上线”。  
更好的讲法是：

`Treasury Guard ships with house research, accepts external theses, and monetizes approved provider workflows with a 20% platform take rate.`

## 相关文件

- 接入说明：[provider-integration-zh.md](./provider-integration-zh.md)
- 最小 Schema：[provider-thesis.schema.json](../src/contracts/provider-thesis.schema.json)
