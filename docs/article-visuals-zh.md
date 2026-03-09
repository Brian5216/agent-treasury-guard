# 长文插图

这页给长文、路演稿、公众号或 X 长帖直接复用。
两张图都尽量压成一屏，读者一眼就能看懂 Treasury Guard 到底做了什么。

## 图 1：总架构图

建议标题：
`Treasury Guard 在 AI 与 OKX Skills 之间加了一层可付费的决策工作流`

```mermaid
flowchart LR
    Buyer["Buyer AI<br/>通用 AI / 调用方 Agent"] -->|提问 / thesis / premium 请求| Guard["Treasury Guard<br/>决策工作流层"]
    Guard -->|底层链上能力| Okx["OKX Skills<br/>token / market / quote / gateway"]
    Guard -->|按次收费| Pay["OKX x402<br/>402 / verify / settle"]
    Okx --> Guard
    Pay --> Guard
    Guard -->|返回带风控结果| Result["Result<br/>policy / trade / exit / watch / machineView"]
    Result --> Buyer
```

建议图注：
`OKX 提供底层链上技能，Treasury Guard 把它们封装成 AI 可直接购买的决策工作流。`

配文可直接使用：

- Buyer AI 不需要自己拼 token、market、quote、gateway。
- Treasury Guard 负责 policy、trade、exit、watch 和 machineView。
- 支付通过 x402 完成，结果在验证和结算后再解锁。

## 图 2：为什么不直接拼 OKX Skills

建议标题：
`为什么其他 AI 不直接自己拼 OKX Skills，而要购买 Treasury Guard`

```mermaid
flowchart LR
    subgraph Left["直接拼 OKX Skills"]
        L1["token<br/>找币"]
        L2["market<br/>看行情"]
        L3["quote<br/>拿报价"]
        L4["gateway<br/>查订单"]
    end

    subgraph Right["购买 Treasury Guard"]
        R1["policy<br/>该不该做"]
        R2["trade<br/>怎么入场"]
        R3["exit<br/>怎么退场"]
        R4["watch<br/>后续怎么盯"]
    end

    Left --> LeftOutcome["需要自己编排<br/>自己补风控"]
    Right --> RightOutcome["直接拿结果<br/>直接按次购买"]
```

建议图注：
`OKX Skills 解决“能做什么”，Treasury Guard 解决“该不该做、怎么做、什么时候退出”。`

配文可直接使用：

- 左边是底层技能，强但分散。
- 右边是决策工作流，直接给 AI 可执行结果。
- 调用方 AI 不是为原始数据付费，而是为带约束的决策结果付费。

## 用法建议

长文里建议这样插：

1. 开头先放“图 1：总架构图”
2. 讲到“为什么不用直接拼 OKX Skills”时放“图 2：对照图”
3. 后面再接真实支付、真实结算和 `live-proof.md`

相关材料：

- [architecture.md](./architecture.md)
- [live-proof.md](./live-proof.md)
- [project-summary-zh.md](./project-summary-zh.md)
