import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPreflightSnapshot,
  inspectProviderConfig,
  renderPreflightMarkdown
} from "../src/preflight.js";

test("inspectProviderConfig treats missing payout as direct BYO-thesis", () => {
  const result = inspectProviderConfig(
    {
      TREASURY_GUARD_LIVE_PROVIDER_ID: "provider-brett",
      TREASURY_GUARD_LIVE_PROVIDER_NAME: "Brett Signal AI",
      TREASURY_GUARD_LIVE_PROVIDER_KIND: "external"
    },
    "TREASURY_GUARD_LIVE"
  );

  assert.equal(result.mode, "direct-byo-thesis");
  assert.equal(result.splitReady, false);
  assert.equal(result.providerKind, "external");
  assert.equal(result.warnings.length, 1);
});

test("inspectProviderConfig enables provider split when payout metadata exists", () => {
  const result = inspectProviderConfig(
    {
      TREASURY_GUARD_LIVE_PROVIDER_ID: "provider-brett",
      TREASURY_GUARD_LIVE_PROVIDER_NAME: "Brett Signal AI",
      TREASURY_GUARD_LIVE_PROVIDER_KIND: "external",
      TREASURY_GUARD_LIVE_PROVIDER_PAYOUT_ADDRESS:
        "0xd5677a880f08f7e6ff31d6bfaf5edc8b05d95ad4"
    },
    "TREASURY_GUARD_LIVE"
  );

  assert.equal(result.mode, "approved-provider");
  assert.equal(result.splitReady, true);
  assert.equal(result.warnings.length, 0);
});

test("buildPreflightSnapshot summarizes live readiness", () => {
  const snapshot = buildPreflightSnapshot({
    OKX_API_KEY: "key",
    OKX_SECRET_KEY: "secret",
    OKX_API_PASSPHRASE: "pass",
    X402_TEST_PRIVATE_KEY:
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    TREASURY_GUARD_PAYMENT_ADAPTER: "okx-api",
    TREASURY_GUARD_PAYMENT_ASSET: "USDT",
    TREASURY_GUARD_LIVE_PROVIDER_ID: "provider-brett",
    TREASURY_GUARD_LIVE_PROVIDER_NAME: "Brett Signal AI",
    TREASURY_GUARD_LIVE_PROVIDER_KIND: "external",
    TREASURY_GUARD_LIVE_PROVIDER_PAYOUT_ADDRESS:
      "0xd5677a880f08f7e6ff31d6bfaf5edc8b05d95ad4"
  });

  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.runtime.paymentAdapter, "okx-api");
  assert.deepEqual(snapshot.runtime.acceptedAssets, ["USDT"]);
  assert.equal(snapshot.providerModes.live.mode, "approved-provider");
});

test("renderPreflightMarkdown includes key sections", () => {
  const markdown = renderPreflightMarkdown({
    generatedAt: "2026-03-09T00:00:00.000Z",
    ready: true,
    runtime: {
      analysisAdapter: "okx-http",
      paymentAdapter: "okx-api",
      paymentChain: "xlayer",
      paymentAsset: "USDC",
      acceptedAssets: ["USDC"],
      merchantAddress: "0x1234",
      payerMode: "mock"
    },
    checks: [
      { label: "Node >= 20", status: "PASS", detail: "Detected 22.0.0" }
    ],
    providerModes: {
      live: { mode: "approved-provider", providerKind: "external" },
      realSmoke: { mode: "direct-byo-thesis", providerKind: "caller" }
    },
    supportedProbe: {
      status: "pass",
      networks: [{ chainName: "X Layer", assets: ["USDG", "USDT", "USDC"] }]
    },
    warnings: []
  });

  assert.match(markdown, /# Treasury Guard Preflight/);
  assert.match(markdown, /## Runtime/);
  assert.match(markdown, /## Live x402 Probe/);
  assert.match(markdown, /X Layer: USDG, USDT, USDC/);
});
