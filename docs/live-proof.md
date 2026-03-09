# Live Proof

## Purpose

This page is the shortest proof set for judges and collaborators.
It records the live payment and analysis runs that demonstrate Treasury Guard is not a mock-only project.

For the machine-readable ledger, see:

- [`workflow-evidence.json`](./workflow-evidence.json)
- [`workflow-evidence.md`](./workflow-evidence.md)

## Re-run Proofs Captured On March 9, 2026

### 1. Direct BYO Thesis Purchase

- Flow: direct caller thesis -> x402 payment -> unlock thesis plan
- Verification level: `rerun-today`
- Command shape: `npm run premium:real-payment-thesis-smoke`
- Analysis adapter: `mock`
- Selected asset: `USDT`
- Settlement tx: `0x3d3e7f34bb235343d12d4194da36dadf71ab86c2822ca746ab22d97ecfbc2f98`
- What it proves:
  - Plain BYO-thesis calls do not require provider split
  - `402 -> verify -> settle -> unlock` still works with a real wallet signer

### 2. Live Provider Thesis Demo

- Flow: approved provider thesis -> live OKX analysis -> x402 payment -> unlock result
- Verification level: `rerun-today`
- Command shape: `npm run premium:live-demo-thesis`
- Analysis adapter: `okx-http`
- Selected asset: `USDT`
- Revenue split: `platform 20% / provider 80%`
- Settlement tx: `0x06c9591628e80336d06de69c38f5ee3b9d53c030476a947f6d1a24a6fdbf7be0`
- What it proves:
  - Provider payout metadata still activates `20/80` split mode
  - `okx-http + okx-x402-api + real-wallet payer` is live on the current thesis demo path

## Historical Supporting Proofs

These were validated in earlier local live runs and remain part of the workspace evidence ledger.

### 3. Trade Plan

- Verification level: `historical-workspace-record`
- Settlement tx: `0x79e11af955c5f1cb62187c921b679464a0536d516f724b732281aa30034e33b8`
- Coverage: premium trade workflow

### 4. Exit Plan

- Verification level: `historical-workspace-record`
- Settlement tx: `0x4fb62e16e0625a6c8a448d35a640b4bab7835de6c81863a877d132fa35fa94db`
- Coverage: premium exit workflow

## What This Does Not Claim

- Provider split is currently documented as `offchain-ledger`, not onchain auto-split.
- Trade and exit are preserved as historical live records until they are re-run again.

## Reproduction Commands

Run the preflight first:

```bash
npm run preflight
```

Then re-run the main live proofs:

```bash
npm run premium:real-payment-thesis-smoke

TREASURY_GUARD_LIVE_PROVIDER_ID=provider-brett \
TREASURY_GUARD_LIVE_PROVIDER_NAME="Brett Signal AI" \
TREASURY_GUARD_LIVE_PROVIDER_KIND=external \
TREASURY_GUARD_LIVE_PROVIDER_PAYOUT_ADDRESS=0x... \
TREASURY_GUARD_LIVE_ANALYSIS_ADAPTER=okx-http \
npm run premium:live-demo-thesis
```
