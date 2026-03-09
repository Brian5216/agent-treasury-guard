import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createTreasuryGuardHandler, isSettledSettlement } from "../src/server.js";
import { paidFetch, readResponsePayload, renderPaidResult } from "../src/client.js";
import { MockX402Adapter } from "../src/payments/mock.js";
import {
  buildPaymentRequirements,
  buildPaymentRequiredResponse,
  buildPaymentRequirementsSet,
  encodePaymentHeader,
  matchPaymentRequirement,
  selectPaymentRequirement
} from "../src/payments/catalog.js";
import { createPaymentAdapter } from "../src/payments/index.js";
import {
  OkxX402ApiAdapter,
  normalizeSettlementResponse,
  normalizeSupportedResponse,
  normalizeVerifyResponse
} from "../src/payments/okx-api.js";
import { createPayer } from "../src/payers/index.js";
import { CommandPayer } from "../src/payers/command.js";
import { RealWalletPayer } from "../src/payers/real-wallet.js";

async function invokeHandler(handler, { method, url, headers = {}, body = null }) {
  const payload =
    typeof body === "string"
      ? body
      : body
        ? JSON.stringify(body)
        : null;
  const request = Readable.from(payload ? [Buffer.from(payload)] : []);
  request.method = method;
  request.url = url;
  request.headers = headers;

  const chunks = [];
  const response = {
    statusCode: 200,
    headers: {},
    writeHead(statusCode, headersToSet) {
      this.statusCode = statusCode;
      this.headers = headersToSet;
    },
    end(payload) {
      if (payload) {
        chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
      }
    }
  };

  await handler(request, response);
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null
  };
}

test("mock x402 adapter verifies and settles a payment", async () => {
  const adapter = new MockX402Adapter();
  const requirement = buildPaymentRequirements({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3
  });

  const paymentPayload = await adapter.preparePayment({
    paymentRequirements: requirement,
    payer: "0xdead00000000000000000000000000000000beef"
  });
  const verification = await adapter.verify({
    paymentPayload,
    paymentRequirements: requirement
  });
  const settlement = await adapter.settle({
    paymentPayload,
    paymentRequirements: requirement,
    verification
  });

  assert.equal(verification.valid, true);
  assert.ok(paymentPayload.payload.signature.startsWith("0xmocksig"));
  assert.equal(paymentPayload.payload.authorization.from, "0xdead00000000000000000000000000000000beef");
  assert.equal(paymentPayload.payload.authorization.to, requirement.payTo);
  assert.equal(paymentPayload.payload.authorization.value, requirement.maxAmountRequired);
  assert.equal(settlement.status, "settled");
  assert.ok(settlement.txHash.startsWith("0xpay"));
});

test("live verify response is normalized into strict boolean validity", async () => {
  const normalized = normalizeVerifyResponse({
    code: "0",
    msg: "success",
    data: [
      {
        isValid: true,
        invalidReason: null,
        payer: "0xcb30ed083ad246b126a3aa1f414b44346e83e67d"
      }
    ]
  });

  assert.equal(normalized.valid, true);
  assert.equal(normalized.status, "verified");
  assert.equal(normalized.payer, "0xcb30ed083ad246b126a3aa1f414b44346e83e67d");
});

test("live settlement response is normalized into treasury summary shape", async () => {
  const requirement = buildPaymentRequirements({
    skuId: "tradePlan",
    requestUrl: "http://127.0.0.1:8788/premium/trade-plan",
    method: "POST",
    requestBody: { side: "buy", symbol: "BRETT" },
    amountUsd: 0.8
  });

  const normalized = normalizeSettlementResponse(
    {
      code: "0",
      msg: "success",
      data: [
        {
          success: true,
          errorReason: null,
          payer: "0xcb30ed083ad246b126a3aa1f414b44346e83e67d",
          txHash: "0x4f46ed8eac92ddbccfb56a88ff827db3616c7beb191adabbeeded901340bd7d5",
          chainIndex: "196",
          chainName: "X Layer"
        }
      ]
    },
    requirement
  );

  assert.equal(normalized.status, "settled");
  assert.equal(normalized.success, true);
  assert.equal(normalized.asset, requirement.asset);
  assert.equal(normalized.amount, requirement.maxAmountRequired);
  assert.equal(
    normalized.txHash,
    "0x4f46ed8eac92ddbccfb56a88ff827db3616c7beb191adabbeeded901340bd7d5"
  );
});

test("live supported response is normalized into a cached network summary", async () => {
  const normalized = normalizeSupportedResponse(
    {
      code: "0",
      msg: "success",
      data: [
        {
          x402Version: "1",
          chainIndex: "196",
          scheme: "exact",
          chainName: "X Layer"
        }
      ]
    },
    {
      cachedAt: "2026-03-09T00:00:00.000Z",
      ttlMs: 300000
    }
  );

  assert.equal(normalized.networks.length, 1);
  assert.equal(normalized.networks[0].chainIndex, "196");
  assert.equal(normalized.networks[0].assets[0].symbol, "USDG");
  assert.equal(normalized.protocol.retryHeader, "X-PAYMENT");
});

test("live adapter falls back across override paths and does not require OKX project id", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    OKX_API_KEY: process.env.OKX_API_KEY,
    OKX_SECRET_KEY: process.env.OKX_SECRET_KEY,
    OKX_API_PASSPHRASE: process.env.OKX_API_PASSPHRASE,
    OKX_PROJECT_ID: process.env.OKX_PROJECT_ID,
    OKX_PAYMENT_BASE_PATH: process.env.OKX_PAYMENT_BASE_PATH
  };
  const calls = [];

  process.env.OKX_API_KEY = "demo-key";
  process.env.OKX_SECRET_KEY = "demo-secret";
  process.env.OKX_API_PASSPHRASE = "demo-passphrase";
  delete process.env.OKX_PROJECT_ID;
  process.env.OKX_PAYMENT_BASE_PATH = "/bad,/api/v6/x402";

  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      headers: options.headers || {}
    });

    if (String(url).includes("/bad/supported")) {
      return new Response("<html>404</html>", {
        status: 404,
        headers: {
          "Content-Type": "text/html"
        }
      });
    }

    return new Response(
      JSON.stringify({
        code: "0",
        msg: "success",
        data: [
          {
            x402Version: "1",
            chainIndex: "196",
            scheme: "exact",
            chainName: "X Layer"
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  try {
    const adapter = new OkxX402ApiAdapter();
    const payload = await adapter.getSupported();

    assert.equal(payload.provider, "okx-x402-api");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://web3.okx.com/bad/supported");
    assert.equal(calls[1].url, "https://web3.okx.com/api/v6/x402/supported");
    assert.equal(Boolean(calls[1].headers["OK-ACCESS-PROJECT"]), false);
    assert.equal(payload.cache.hit, false);

    const second = await adapter.getSupported();
    assert.equal(second.cache.hit, true);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("payment required response publishes the x402 retry protocol", () => {
  const requirements = buildPaymentRequirementsSet({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer"
  });

  const response = buildPaymentRequiredResponse({
    paymentRequirements: requirements
  });

  assert.equal(response.protocol.retryHeader, "X-PAYMENT");
  assert.equal(response.machineView.retry.flow.includes("unlock_premium_result"), true);
  assert.equal(response.paymentRequirements.length, 3);
  assert.deepEqual(
    response.machineView.accepted.map((item) => item.assetSymbol),
    ["USDG", "USDT", "USDC"]
  );
});

test("payment adapter and payer support runtime aliases", () => {
  assert.equal(createPaymentAdapter("okx-x402-api").name, "okx-x402-api");
  assert.equal(createPayer("command-payer", { command: "node -e \"process.stdout.write('{}')\"" }).name, "command-payer");
  assert.equal(
    createPayer("real-wallet", {
      privateKey:
        "0x1111111111111111111111111111111111111111111111111111111111111111"
    }).name,
    "real-wallet-payer"
  );
});

test("payment requirements include token domain metadata for live wallet signing", () => {
  const requirement = buildPaymentRequirements({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer",
    assetSymbol: "USDT"
  });

  assert.equal(requirement.chainIndex, "196");
  assert.equal(requirement.extra.network, "xlayer");
  assert.equal(requirement.extra.name, "USD₮0");
  assert.equal(requirement.extra.version, "1");
});

test("usdg payment requirement includes the verified live signing profile", () => {
  const requirement = buildPaymentRequirements({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer",
    assetSymbol: "USDG"
  });

  assert.equal(requirement.extra.name, "Global Dollar");
  assert.equal(requirement.extra.version, "1");
});

test("buyer selects the preferred settlement asset from a multi-asset invoice", () => {
  const requirements = buildPaymentRequirementsSet({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer"
  });

  const picked = selectPaymentRequirement(requirements, {
    assetSymbol: "USDT"
  });

  assert.equal(picked.extra.assetSymbol, "USDT");
});

test("provider matches the selected payment requirement from the payment payload", async () => {
  const requirements = buildPaymentRequirementsSet({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer"
  });
  const selected = selectPaymentRequirement(requirements, {
    assetSymbol: "USDT"
  });
  const paymentPayload = await new MockX402Adapter().preparePayment({
    paymentRequirements: selected,
    payer: "0xdead00000000000000000000000000000000beef"
  });

  const matched = matchPaymentRequirement(requirements, paymentPayload);

  assert.equal(matched.extra.assetSymbol, "USDT");
});

test("client render picks the settled asset from a multi-asset invoice", () => {
  const requirements = buildPaymentRequirementsSet({
    skuId: "opportunities",
    requestUrl: "http://127.0.0.1:8788/premium/opportunities?chain=base",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3,
    chain: "xlayer"
  });
  const markdown = renderPaidResult(
    {
      status: 200,
      invoice: {
        paymentRequirements: requirements
      },
      result: {
        payment: {
          settlement: {
            provider: "okx-x402-api",
            chainIndex: "196",
            asset: requirements[1].asset,
            amount: requirements[1].maxAmountRequired
          }
        },
        data: {
          kind: "opportunities",
          input: {
            chain: "base"
          },
          opportunities: []
        }
      }
    },
    "markdown"
  );

  assert.match(markdown, /Invoice: Opportunities for 0.3 USDT on chain 196/);
});

test("manifest advertises all accepted settlement assets by default", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });

  const response = await invokeHandler(handler, {
    method: "GET",
    url: "/manifest",
    headers: {
      host: "127.0.0.1:8788"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.payment.acceptedAssets, ["USDG", "USDT", "USDC"]);
});

test("real wallet payer can sign a live-style x402 payment payload", async () => {
  const requirement = buildPaymentRequirements({
    skuId: "tradePlan",
    requestUrl: "http://127.0.0.1:8788/premium/trade-plan",
    method: "POST",
    requestBody: { side: "buy", symbol: "BRETT" },
    amountUsd: 0.8,
    chain: "xlayer",
    assetSymbol: "USDT",
    merchantAddress: "0x1234567890abcdef1234567890abcdef12345678"
  });
  const payer = new RealWalletPayer({
    privateKey:
      "0x1111111111111111111111111111111111111111111111111111111111111111"
  });

  const payload = await payer.preparePayment({
    paymentRequirements: requirement,
    invoice: {
      paymentRequirements: [requirement]
    }
  });

  assert.equal(payload.chainIndex, "196");
  assert.ok(payload.payload.signature.startsWith("0x"));
  assert.equal(payload.payload.authorization.to, "0x1234567890AbcdEF1234567890aBcdef12345678");
  assert.equal(payload.payload.authorization.value, "800000");
});

test("command payer can prepare a payment through an external signer contract", async () => {
  const requirement = buildPaymentRequirements({
    skuId: "tradePlan",
    requestUrl: "http://127.0.0.1:8788/premium/trade-plan",
    method: "POST",
    requestBody: { side: "buy", symbol: "BRETT" },
    amountUsd: 0.8
  });
  const scriptPath = fileURLToPath(new URL("../examples/mock-command-payer.js", import.meta.url));
  const payer = new CommandPayer({
    command: `node ${JSON.stringify(scriptPath)}`
  });

  const payload = await payer.preparePayment({
    paymentRequirements: requirement,
    payer: "0xdead00000000000000000000000000000000beef",
    invoice: {
      paymentRequirements: [requirement]
    }
  });

  assert.equal(payload.chainIndex, requirement.chainIndex);
  assert.equal(payload.payload.authorization.to, requirement.payTo);
});

test("client reads non-json responses without crashing", async () => {
  const payload = await readResponsePayload(
    new Response("<html>bad gateway</html>", {
      status: 502,
      headers: {
        "Content-Type": "text/html"
      }
    })
  );

  assert.equal(payload.kind, "non-json-response");
  assert.equal(payload.status, 502);
});

test("paid fetch returns a uniform shape when no invoice is required", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, alreadyUnlocked: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });

  try {
    const payload = await paidFetch({
      method: "GET",
      url: "https://example.com/premium/opportunities",
      payerClient: {
        async preparePayment() {
          throw new Error("should not be called");
        }
      },
      payerAddress: "0xdead"
    });

    assert.equal(payload.status, 200);
    assert.equal(payload.invoice, null);
    assert.equal(payload.result.alreadyUnlocked, true);
    assert.match(renderPaidResult(payload, "markdown"), /## Response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("premium trade endpoint rejects malformed JSON with 400", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });

  const response = await invokeHandler(handler, {
    method: "POST",
    url: "/premium/trade-plan",
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body: "{"
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.kind, "invalid-json");
});

test("premium server requires payment then unlocks opportunities", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });
  const url = "/premium/opportunities?chain=base&budgetUsd=1000";
  const first = await invokeHandler(handler, {
    method: "GET",
    url,
    headers: {
      host: "127.0.0.1:8788"
    }
  });
  assert.equal(first.statusCode, 402);
  assert.equal(first.body.paymentRequirements.length, 3);
  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: "USDT"
  });
  assert.equal(requirement.outputSchema.properties.skuId.const, "opportunities");

  const paymentAdapter = new MockX402Adapter();
  const paymentPayload = await paymentAdapter.preparePayment({
    paymentRequirements: requirement,
    payer: "0xdead00000000000000000000000000000000beef"
  });

  const second = await invokeHandler(handler, {
    method: "GET",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "x-payment": encodePaymentHeader(paymentPayload)
    }
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.kind, "premium-access");
  assert.equal(second.body.data.kind, "opportunities");
  assert.equal(second.body.data.opportunities[0].symbol, "BRETT");
});

test("manifest exposes premium capabilities and pricing", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });

  const response = await invokeHandler(handler, {
    method: "GET",
    url: "/manifest",
    headers: {
      host: "127.0.0.1:8788"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.name, "Agent Treasury Guard");
  assert.equal(response.body.adapters.analysis, "mock");
  assert.equal(response.body.capabilities.length, 5);
  assert.equal(response.body.discovery.freeOpportunityScan, "http://127.0.0.1:8788/opportunities");
  assert.equal(response.body.discovery.premiumThesisPlan, "http://127.0.0.1:8788/premium/thesis-plan");
  assert.equal(response.body.marketplace.model, "hybrid");
  assert.equal(response.body.marketplace.platformTakeRateBps, 2000);
  assert.equal(response.body.marketplace.callerThesisMode, true);
  assert.equal(
    response.body.discovery.premiumExitPlan,
    "http://127.0.0.1:8788/premium/trade-plan?side=sell"
  );
});

test("free opportunity route returns results without payment", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });

  const response = await invokeHandler(handler, {
    method: "GET",
    url: "/opportunities?chain=base&budgetUsd=1000",
    headers: {
      host: "127.0.0.1:8788"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.kind, "opportunities");
  assert.equal(response.body.machineView.tier, "free");
  assert.equal(response.body.machineView.nextCalls.premiumThesisPlan.path, "/premium/thesis-plan");
});

test("settlement success helper is strict", () => {
  assert.equal(isSettledSettlement({ status: "settled" }), true);
  assert.equal(isSettledSettlement({ success: true }), true);
  assert.equal(isSettledSettlement({ status: "failed", success: false }), false);
  assert.equal(isSettledSettlement(null), false);
});

test("premium server unlocks trade plan after payment", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });
  const url = "/premium/trade-plan";
  const body = {
    side: "buy",
    symbol: "BRETT",
    chain: "base",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC"
  };

  const first = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body
  });
  assert.equal(first.statusCode, 402);
  assert.equal(first.body.paymentRequirements.length, 3);
  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: "USDT"
  });

  const paymentAdapter = new MockX402Adapter();
  const paymentPayload = await paymentAdapter.preparePayment({
    paymentRequirements: requirement
  });

  const second = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json",
      "x-payment": encodePaymentHeader(paymentPayload)
    },
    body
  });

  assert.equal(second.statusCode, 200);
  assert.equal(second.body.data.kind, "trade-plan");
  assert.equal(second.body.data.asset.symbol, "BRETT");
  assert.equal(second.body.data.execution.decision, "proceed");
});

test("premium server unlocks exit plan after payment", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });
  const url = "/premium/trade-plan";
  const body = {
    side: "sell",
    symbol: "PEPE",
    chain: "ethereum",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC"
  };

  const first = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body
  });
  assert.equal(first.statusCode, 402);
  assert.equal(first.body.paymentRequirements.length, 3);
  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: "USDC"
  });

  const paymentAdapter = new MockX402Adapter();
  const paymentPayload = await paymentAdapter.preparePayment({
    paymentRequirements: requirement
  });

  const second = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json",
      "x-payment": encodePaymentHeader(paymentPayload)
    },
    body
  });

  assert.equal(second.statusCode, 200);
  assert.equal(second.body.data.kind, "exit-plan");
  assert.equal(second.body.data.asset.symbol, "PEPE");
  assert.equal(second.body.data.execution.decision, "de-risk-fast");
  assert.equal(second.body.data.policy.status, "block");
});

test("premium server unlocks thesis plan after payment", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });
  const url = "/premium/thesis-plan";
  const body = {
    side: "buy",
    symbol: "BRETT",
    chain: "base",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    thesis: "Whale support still justifies a guarded entry.",
    thesisSource: "external-ai"
  };

  const first = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body
  });
  assert.equal(first.statusCode, 402);
  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: "USDT"
  });
  assert.equal(requirement.outputSchema.properties.skuId.const, "thesisPlan");
  assert.equal(requirement.extra.providerKind, "caller");
  assert.equal(requirement.extra.platformTakeRateBps, 10000);
  assert.equal(requirement.extra.providerPayoutBps, 0);

  const paymentAdapter = new MockX402Adapter();
  const paymentPayload = await paymentAdapter.preparePayment({
    paymentRequirements: requirement
  });

  const second = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json",
      "x-payment": encodePaymentHeader(paymentPayload)
    },
    body
  });

  assert.equal(second.statusCode, 200);
  assert.equal(second.body.data.kind, "thesis-plan");
  assert.equal(second.body.data.provider.kind, "caller");
  assert.equal(second.body.data.commercialTerms.providerPayoutBps, 0);
  assert.equal(second.body.data.thesis.source, "external-ai");
  assert.ok(["aligned", "mixed"].includes(second.body.data.thesis.verdict));
});

test("premium server applies 20/80 split only for approved provider theses", async () => {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: "mock"
  });
  const url = "/premium/thesis-plan";
  const body = {
    side: "buy",
    symbol: "BRETT",
    chain: "base",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    thesis: "Whale support still justifies a guarded entry.",
    thesisSource: "brett-signal-ai",
    providerId: "provider-brett",
    providerName: "Brett Signal AI",
    providerPayoutAddress: "0xd5677a880f08f7e6ff31d6bfaf5edc8b05d95ad4"
  };

  const first = await invokeHandler(handler, {
    method: "POST",
    url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body
  });
  assert.equal(first.statusCode, 402);
  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: "USDT"
  });
  assert.equal(requirement.extra.providerKind, "external");
  assert.equal(requirement.extra.platformTakeRateBps, 2000);
  assert.equal(requirement.extra.providerPayoutBps, 8000);
});
