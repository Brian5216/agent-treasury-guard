# 录屏清单

## 目标

只录 60 秒，证明三件事：

1. 这不是聊天机器人，而是可被其他 AI 调用的专家 Skill。
2. 它不是 mock，而是 `OKX live analysis + x402 live payment`。
3. 它卖的不是底层链上技能，而是 `Policy + BYO Thesis + Entry/Exit + Watch` 决策工作流；白名单 Provider 还支持平台分成。

## 录屏前准备

先跑一次：

```bash
npm run preflight
```

需要环境变量：

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_API_PASSPHRASE`
- `X402_TEST_PRIVATE_KEY`
- `TREASURY_GUARD_PAYMENT_ASSET=USDT`

建议终端窗口宽度固定，使用等宽字体，放大到能清楚看见：

- `Analysis adapter`
- `Settlement asset`
- `Settlement tx`
- `Provider`
- `Revenue split`
- `Decision`
- `Policy`
- `Risk`
- `Watch`

## 推荐录屏顺序

### 1. 标题页，3 秒

展示：

- 项目名 `Agent Treasury Guard`
- 副标题 `Built on OKX Skills, sold as AI decision workflows`

口播：

“OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。”

### 2. Thesis live demo，20 秒

命令：

```bash
npm run premium:live-demo-thesis
```

如果要录制 Provider 分成版，请先设置：

```bash
export TREASURY_GUARD_LIVE_PROVIDER_ID=provider-brett
export TREASURY_GUARD_LIVE_PROVIDER_NAME="Brett Signal AI"
export TREASURY_GUARD_LIVE_PROVIDER_KIND=external
export TREASURY_GUARD_LIVE_PROVIDER_PAYOUT_ADDRESS=0x...
```

停留重点：

- `Mode: Thesis`
- `Analysis adapter: okx-http`
- `Settlement asset: USDT`
- `Settlement tx`
- `Provider: Brett Signal AI (external)`
- `Revenue split: platform 20% / provider 80%`
- `Decision`
- `Policy`
- `Risk`

口播：

“这里 Treasury Guard 先验证外部 Provider 的 thesis，再通过 x402 在 X Layer 上完成真实收费和结算，并公开 20% 平台抽成。”

### 3. Accepted assets，8 秒

展示 invoice 或 manifest 中的：

- `acceptedAssets: USDG / USDT / USDC`
- `chainIndex: 196`
- `providerId: provider-brett`
- `platformTakeRateBps: 2000`
- `providerPayoutBps: 8000`

口播：

“同一个 premium 资源支持三种稳定币；如果是 Provider thesis，也会公开 Provider 元数据和 20/80 分账条款。”

### 4. Trade live demo，12 秒

命令：

```bash
npm run premium:live-demo-trade
```

停留重点：

- `Mode: Trade`
- `Decision: proceed`
- `Policy: pass`
- `Risk`
- `Route`
- `Watch`

口播：

“付费成功后返回的不是原始行情，而是带 Treasury Policy、路由建议和 Watch Plan 的执行结果。外部 AI 可以保留自己的判断层，我们负责落地和守门。”

### 5. 协议资产，8 秒

展示：

- `/manifest`
- `openapi.yaml`

口播：

“这不是单次 Demo，而是任何 AI 都能发现、接入、并按次购买的标准化决策工作流，而且支持 Provider 分成。”

### 6. 收尾，8 秒

口播：

“OKX 提供底层链上技能，Treasury Guard 把它们封装成 AI 愿意付费、也愿意入驻的平台化决策工作流。”

## 最终一句话

`Agent Treasury Guard = OKX Skills + x402 monetization + AI decision workflows`
