# 最终提交清单

## 1. 提交前冻结

- 不再增加新功能
- 不再改动产品定位
- 不再调整主要演示命令
- 只允许修复阻塞录屏或提交的问题

## 2. 赛前检查

按顺序执行：

```bash
npm test
npm run preflight
```

通过标准：

- `npm test` 全绿
- `preflight` 中：
  - `Node >= 20` 为 `PASS`
  - `OKX credentials` 为 `PASS`
  - `Real wallet signer` 为 `PASS`
  - `Settlement assets` 为 `PASS`
  - `x402 /supported probe` 为 `PASS` 或至少不是 `FAIL`

## 3. 录屏环境

录屏前确认这些环境变量已经设置：

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_API_PASSPHRASE`
- `X402_TEST_PRIVATE_KEY`
- `TREASURY_GUARD_PAYMENT_ASSET=USDT`

如果录制 Provider 分成版 thesis，再额外设置：

- `TREASURY_GUARD_LIVE_PROVIDER_ID`
- `TREASURY_GUARD_LIVE_PROVIDER_NAME`
- `TREASURY_GUARD_LIVE_PROVIDER_KIND=external`
- `TREASURY_GUARD_LIVE_PROVIDER_PAYOUT_ADDRESS`

## 4. 最终录屏顺序

先录这 3 段：

```bash
npm run premium:live-demo-thesis
npm run premium:live-demo-trade
```

然后展示：

- `/manifest`
- `openapi.yaml`
- [live-proof.md](./live-proof.md)

录屏重点：

- `Analysis adapter: okx-http`
- `Settlement asset`
- `Settlement tx`
- `Provider`
- `Revenue split`
- `Decision`
- `Policy`
- `Watch triggers`

## 5. 文案补位

提交前补齐：

- `Claw 型号`
- `大模型版本`

优先检查这些文件：

- [x-post-zh.md](./x-post-zh.md)
- [form-answers-zh.md](./form-answers-zh.md)

## 6. 对外统一说法

统一使用这三句：

- `Built on OKX Skills, sold as AI decision workflows`
- `OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。`
- `其他 AI 不必自己拼 OKX Skills，就能直接购买带风控的链上决策与执行结果。`

## 7. 证据页

提交前确认 [live-proof.md](./live-proof.md) 中至少包含：

- 直购 BYO Thesis live tx
- Provider Thesis 20/80 live tx
- Live thesis 命令 live tx
- trade / exit 的历史 live tx

## 8. 最终验收

提交前最后问自己 4 个问题：

1. 评委能否在 10 秒内听懂我们和 OKX Skills 的关系？
2. 评委能否在 30 秒内看懂为什么 AI 不直接自己拼 OKX？
3. 评委能否看到真实支付、真实结算、真实结果？
4. 评委能否看懂普通 BYO Thesis 和 Provider 分成 Thesis 的区别？

如果 4 个答案都是“能”，就提交。
