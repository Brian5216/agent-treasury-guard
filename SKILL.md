---
name: agent-treasury-guard
description: Turn OKX OnchainOS token, market, swap, and gateway primitives into higher-level AI workflows for guarded opportunity scans, treasury-policy entry plans, staged exit plans, and execution tracking. Use when an AI needs to research a token, score risk, prepare an entry or exit plan, or follow execution without manually stitching together token search, price-info, holders, signal-list, quote, and gateway orders.
---

# Agent Treasury Guard

## Overview
Use this skill when the caller wants one of these high-level intents:

- `find_opportunities`: rank tokens worth entering based on OKX signals, token analytics, holder concentration, and quote quality.
- `check_risk_and_prepare_trade`: convert a token request into a guarded entry plan with treasury policy checks, rationale, risk flags, watch triggers, and machine-readable next calls.
- `prepare_exit_plan`: convert a sell request into a staged exit plan with treasury policy checks, de-risk clips, watch triggers, and machine-readable next calls.
- `track_execution_status`: normalize OKX gateway order status for another AI.
- `buy_premium_research`: pay with x402 and unlock premium Treasury Guard output from another Agent.

This skill is designed to sit one layer above the official OKX skills. Its job is not to replace OKX primitives. Its job is to package them into AI-consumable workflows.

## Project Layout
- Core planner: `src/core/planner.js`
- Risk model: `src/core/risk.js`
- CLI entrypoint: `src/cli.js`
- Premium paywall server: `src/server.js`
- Premium buyer client: `src/client.js`
- In-process x402 demo: `src/demo.js`
- OpenAPI contract: `openapi.yaml`
- Demo and submission notes: `docs/`
- Buyer/provider prompts: `prompts/`
- Mock demo fixtures: `data/mock/`
- Tests: `test/planner.test.js`

## Runtime Modes
1. `mock` mode
- Default.
- Uses fixture data in `data/mock/`.
- Best for local demo videos, screenshots, and regression tests.

2. `onchainos-cli` mode
- Uses the official `onchainos` CLI if it is already installed.
- Requires OKX credentials and CLI setup from the official docs.

3. `mock-x402` payment mode
- Default payment mode.
- Issues deterministic invoices and accepts deterministic payment payloads.
- Best for hackathon demos and screenshots.

4. `okx-api` payment mode
- Calls the live OKX x402 API.
- Intended for real `supported`, `verify`, and `settle` calls once credentials are present.

## Command Shortcuts

Opportunity scan:
```bash
node src/cli.js find-opportunities \
  --chain base \
  --budget-usd 1000 \
  --risk-profile balanced \
  --format markdown
```

Prepare guarded entry:
```bash
node src/cli.js prepare-trade \
  --side buy \
  --symbol BRETT \
  --chain base \
  --budget-usd 1000 \
  --risk-profile balanced \
  --wallet-address 0xdead00000000000000000000000000000000beef \
  --format markdown
```

Prepare guarded exit:
```bash
node src/cli.js prepare-exit-plan \
  --symbol PEPE \
  --chain ethereum \
  --budget-usd 1000 \
  --risk-profile balanced \
  --format markdown
```

Track execution:
```bash
node src/cli.js track-execution \
  --chain base \
  --order-id demo-order-1 \
  --format markdown
```

Run the in-process premium x402 demo:
```bash
npm run premium:demo
```

Run the local premium paywall server:
```bash
npm run premium:server
```

Request a paid premium opportunity scan:
```bash
npm run premium:scan
```

## Workflow Rules
1. If the caller only knows a symbol or token name, resolve it first.
2. Always combine signal, token price-info, holder concentration, and swap quote before recommending a buy.
3. Always return treasury policy status (`pass`, `review`, or `block`) before recommending an action.
4. Block or downgrade the recommendation when honeypot, excessive concentration, large price impact, or mandate breaches appear.
5. Every entry or exit plan should include a watch plan with explicit checkpoints and triggers.
6. Return both:
- Human explanation
- `machineView` JSON for the next AI/tool call
7. For premium endpoints, return `402 Payment Required` until a valid x402 payment is attached in `X-PAYMENT`.
8. Once payment clears, verify and settle before revealing the protected result.

## Notes
- Wallet portfolio and payment skills are not assumed here. This skill stays grounded in the currently mature OKX layers: token, market, swap, and gateway.
- The output is intentionally compact so another AI can route it directly into a UI, approval flow, or x402 paywall.
- Current OKX docs indicate live x402 support on X Layer with USDG/USDT/USDC; this skill defaults to that settlement path.
