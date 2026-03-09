# Hackathon Kit

## One-Line Product

OKX provides the base onchain skills, and Agent Treasury Guard turns them into paid AI decision workflows that any AI can call for a free shortlist, then buy when it needs treasury-policy entry plans, BYO-thesis validation, staged exit plans, or de-risking logic.

Suggested cover subtitle: `Built on OKX Skills, sold as AI decision workflows`

## 60-Second Demo Flow

1. Buyer Agent asks for a free shortlist or submits its own thesis.
2. Treasury Guard runs live OKX market/trade analysis through `okx-http`.
3. Treasury Guard returns `402 Payment Required` for the high-value workflow.
4. Buyer Agent pays with x402 on X Layer.
5. Treasury Guard verifies and settles the payment onchain.
6. Treasury Guard returns a policy-gated result with `provider`, `commercialTerms`, `watch` triggers, and machine-readable next calls.

Reference proof ledger:

- [live-proof.md](./live-proof.md)
- [workflow-evidence.md](./workflow-evidence.md)
- [final-submission-checklist-zh.md](./final-submission-checklist-zh.md)
- [article-visuals-zh.md](./article-visuals-zh.md)
- [longform-intro-zh.md](./longform-intro-zh.md)

## What To Show On Screen

1. `npm run premium:live-demo-thesis`
   Set `TREASURY_GUARD_LIVE_PROVIDER_*` with a payout address first if you want to show the provider-split version.
2. The live `Analysis adapter: okx-http`
3. The invoice payload with `acceptedAssets` and `chainIndex: 196`
4. The `providerId`, `platformTakeRateBps: 2000`, and `providerPayoutBps: 8000` on an approved provider thesis
5. The explicit `request -> 402 -> X-PAYMENT -> verify -> settle -> unlock` flow
6. The unlocked `policy`, `watch`, `provider`, and `machineView.nextCalls`
7. `npm run premium:live-demo-trade`
8. `openapi.yaml` or `/manifest` to prove other AIs can integrate directly

## Contest Talking Points

- `结合度`: built directly on OKX token, market, swap, gateway, and x402.
- `实用性`: solves a real problem for general AIs that want onchain execution help or need a stronger control layer for their own thesis.
- `创新性`: not another chat bot, but an AI-to-AI paid expert service with provider onboarding and revenue share for approved provider theses.
- `可复制性`: ships as a skill, service manifest, and OpenAPI contract.

## X Post Draft

### Short Version

我们做了 `Agent Treasury Guard`：一个基于 OKX Skills 的 AI 决策工作流产品。  
OKX 提供底层链上技能，Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不用自己拼 OKX Skills，就能先拿免费机会扫描，再购买带 Treasury Policy 的交易方案、BYO Thesis 验证，以及退出与监控方案。

### Technical Bullets

- Claw 型号：按你的实际参赛型号填写
- 大模型版本：按你的实际参赛版本填写
- 核心能力：`free opportunity scan` / `premium trade plan` / `premium thesis plan` / `premium exit plan`
- 结算方式：x402 on X Layer
- 分账方式：approved provider theses use platform 20% / provider 80%
- 输出：人类可读 explanation + AI 可读 `machineView`
- 协议流：`402 -> verify -> settle -> unlock`

## Prompt Checklist

- 明确资金规模、目标链、风险偏好
- 要求返回风险说明，不只给结论
- 需要时要求返回 `machineView`
- 付费调用时强调“先拿 invoice，再支付，再重试”
