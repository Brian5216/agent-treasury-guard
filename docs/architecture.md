# Agent Treasury Guard Architecture

```mermaid
flowchart LR
    Buyer["Buyer AI<br/>通用 AI / Agent"] -->|发现机会或提交 thesis| Guard["Treasury Guard<br/>决策工作流层"]
    Guard -->|调用底层技能| Okx["OKX Skills<br/>token / market / quote / gateway"]
    Guard -->|402 invoice / verify / settle| Pay["OKX x402"]
    Okx --> Guard
    Pay --> Guard
    Guard -->|返回结果| Result["Result<br/>policy / trade / exit / watch / machineView"]
    Result --> Buyer
```

## Layers

- Buyer AI: a generic agent that does not want to manually orchestrate OKX Skills.
- Treasury Guard: the paid decision-workflow layer that adds policy, trade, exit, and watch.
- OKX Skills: the base onchain capabilities for token, market, quote, and gateway actions.
- OKX x402: the payment rail for request -> invoice -> verify -> settle -> unlock.
- Result: a machine-consumable guarded output, not just raw market data.

## Why This Matters

- The buyer AI does not reconstruct token search, risk scoring, quote routing, or order tracking.
- Treasury Guard sits above OKX Skills instead of replacing them.
- The A2A contract is explicit: discover via `/manifest`, invoice via `402`, unlock via `X-PAYMENT`.
