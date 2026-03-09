import test from "node:test";
import assert from "node:assert/strict";
import { MockOkxAdapter } from "../src/adapters/mock.js";
import {
  findOpportunities,
  prepareExitPlan,
  prepareThesisPlan,
  prepareTradePlan,
  trackExecution
} from "../src/core/planner.js";

test("find-opportunities ranks the strongest token first", async () => {
  const adapter = new MockOkxAdapter();
  const result = await findOpportunities(adapter, {
    chain: "base",
    budgetUsd: 1000,
    limit: 1,
    riskProfile: "balanced",
    stable: "USDC"
  });

  assert.equal(result.kind, "opportunities");
  assert.equal(result.opportunities[0].symbol, "BRETT");
  assert.ok(result.opportunities[0].opportunityScore >= 70);
  assert.equal(result.machineView.tier, "free");
  assert.equal(result.machineView.nextCalls.premiumThesisPlan.path, "/premium/thesis-plan");
});

test("prepare-trade produces a guarded buy plan", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareTradePlan(adapter, {
    chain: "base",
    side: "buy",
    symbol: "BRETT",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    walletAddress: "0xdead00000000000000000000000000000000beef"
  });

  assert.equal(result.kind, "trade-plan");
  assert.equal(result.asset.symbol, "BRETT");
  assert.equal(result.execution.decision, "proceed");
  assert.ok(result.execution.quote.expectedOutput > 0);
  assert.equal(result.policy.status, "pass");
  assert.equal(result.provider.kind, "house");
  assert.equal(result.commercialTerms.platformTakeRateBps, 10000);
  assert.ok(result.watch.triggers.length >= 4);
  assert.ok(result.execution.clips.length >= 1);
  assert.ok(result.machineView.nextCalls.swap.args.includes("--wallet"));
});

test("prepare-exit-plan surfaces elevated sell risk and staged clips", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareExitPlan(adapter, {
    chain: "ethereum",
    symbol: "PEPE",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC"
  });

  assert.equal(result.kind, "exit-plan");
  assert.equal(result.asset.symbol, "PEPE");
  assert.ok(["trim", "de-risk-fast"].includes(result.execution.decision));
  assert.ok(result.risk.score >= 50);
  assert.ok(result.execution.clips.length >= 1);
  assert.ok(result.watch.triggers.some((item) => item.action.includes("exit") || item.action.includes("sell")));
});

test("prepare-trade can downgrade a buy into reduce-size when treasury policy is stretched", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareTradePlan(adapter, {
    chain: "base",
    side: "buy",
    symbol: "BRETT",
    budgetUsd: 1100,
    walletSizeUsd: 12000,
    currentAssetExposureUsd: 1200,
    riskProfile: "balanced",
    stable: "USDC"
  });

  assert.equal(result.kind, "trade-plan");
  assert.equal(result.policy.status, "review");
  assert.equal(result.execution.decision, "reduce-size");
});

test("prepare-trade preserves distinct stop and take thresholds for low-price assets", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareTradePlan(adapter, {
    chain: "ethereum",
    side: "buy",
    symbol: "PEPE",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC"
  });

  const stopLoss = result.watch.triggers.find((item) => item.signal === "price_usd_below");
  const takeProfit = result.watch.triggers.find((item) => item.signal === "price_usd_above");

  assert.ok(stopLoss.threshold > 0);
  assert.ok(takeProfit.threshold > stopLoss.threshold);
  assert.notEqual(stopLoss.threshold, takeProfit.threshold);
});

test("prepare-thesis-plan validates a caller thesis without forcing provider revenue share", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareThesisPlan(adapter, {
    chain: "base",
    side: "buy",
    symbol: "BRETT",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    thesis: "Whale support and manageable routing still justify a guarded entry.",
    thesisSource: "external-ai",
    thesisConfidence: 77,
    thesisBullets: [
      "Momentum is still positive.",
      "Whale buyers remain active."
    ]
  });

  assert.equal(result.kind, "thesis-plan");
  assert.equal(result.asset.symbol, "BRETT");
  assert.equal(result.provider.kind, "caller");
  assert.equal(result.commercialTerms.platformTakeRateBps, 10000);
  assert.equal(result.commercialTerms.providerPayoutBps, 0);
  assert.equal(result.commercialTerms.providerEligibleForPayout, false);
  assert.equal(result.thesis.source, "external-ai");
  assert.ok(["aligned", "mixed"].includes(result.thesis.verdict));
  assert.ok(result.thesis.evidenceFor.length >= 1);
  assert.equal(result.machineView.thesis.source, "external-ai");
});

test("prepare-thesis-plan enables provider split only for approved provider theses", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareThesisPlan(adapter, {
    chain: "base",
    side: "buy",
    symbol: "BRETT",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    thesis: "Whale support and manageable routing still justify a guarded entry.",
    thesisSource: "brett-signal-ai",
    providerId: "provider-brett",
    providerName: "Brett Signal AI",
    providerPayoutAddress: "0xd5677a880f08f7e6ff31d6bfaf5edc8b05d95ad4"
  });

  assert.equal(result.provider.kind, "external");
  assert.equal(result.provider.thesisOrigin, "provider-thesis");
  assert.equal(result.commercialTerms.platformTakeRateBps, 2000);
  assert.equal(result.commercialTerms.providerPayoutBps, 8000);
  assert.equal(result.commercialTerms.providerEligibleForPayout, true);
});

test("prepare-thesis-plan downgrades incomplete provider metadata to caller mode", async () => {
  const adapter = new MockOkxAdapter();
  const result = await prepareThesisPlan(adapter, {
    chain: "base",
    side: "buy",
    symbol: "BRETT",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    thesis: "Whale support and manageable routing still justify a guarded entry.",
    thesisSource: "brett-signal-ai",
    providerId: "provider-brett",
    providerName: "Brett Signal AI",
    providerKind: "external"
  });

  assert.equal(result.provider.kind, "caller");
  assert.equal(result.provider.thesisOrigin, "caller-thesis");
  assert.equal(result.commercialTerms.model, "guard-service");
  assert.equal(result.commercialTerms.platformTakeRateBps, 10000);
  assert.equal(result.commercialTerms.providerPayoutBps, 0);
});

test("track-execution returns normalized status", async () => {
  const adapter = new MockOkxAdapter();
  const result = await trackExecution(adapter, {
    chain: "base",
    orderId: "demo-order-1"
  });

  assert.equal(result.status, "success");
  assert.equal(result.txHash, "0xmocksuccess1");
});
