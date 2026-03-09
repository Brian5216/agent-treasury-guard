# Workflow Evidence Ledger

This page is the human-readable companion to [`workflow-evidence.json`](./workflow-evidence.json).

## How We Use It

- We use this ledger to bind a workflow label to a tx hash.
- We only claim what the workspace can support.
- We separate today's re-run proofs from older historical records.

## Verification Levels

### `rerun-today`

- Re-run on **March 9, 2026**
- Command output and tx hash were observed together during the latest proof pass

### `historical-workspace-record`

- Preserved in the current workspace documentation
- Still linked to a valid OKX X Layer explorer tx
- Kept as supporting proof until it is re-run again

## Current Headline Proofs

### 1. Direct BYO Thesis

- Tx: `0x3d3e7f34bb235343d12d4194da36dadf71ab86c2822ca746ab22d97ecfbc2f98`
- Level: `rerun-today`
- Command: `npm run premium:real-payment-thesis-smoke`
- Key observed fields:
  - mode: `thesis`
  - analysis adapter: `mock`
  - selected asset: `USDT`
  - provider kind: `caller`
  - split: `platform 100% / provider 0%`

### 2. Live Provider Thesis 20/80

- Tx: `0x06c9591628e80336d06de69c38f5ee3b9d53c030476a947f6d1a24a6fdbf7be0`
- Level: `rerun-today`
- Command: `npm run premium:live-demo-thesis`
- Key observed fields:
  - mode: `thesis`
  - analysis adapter: `okx-http`
  - selected asset: `USDT`
  - provider: `Brett Signal AI`
  - split: `platform 20% / provider 80%`

## Historical Supporting Proofs

### 3. Trade Plan

- Tx: `0x79e11af955c5f1cb62187c921b679464a0536d516f724b732281aa30034e33b8`
- Level: `historical-workspace-record`
- Command shape: `npm run premium:real-payment-trade-smoke`

### 4. Exit Plan

- Tx: `0x4fb62e16e0625a6c8a448d35a640b4bab7835de6c81863a877d132fa35fa94db`
- Level: `historical-workspace-record`
- Command shape: `npm run premium:real-payment-exit-smoke`
