#!/usr/bin/env node

import { Readable } from "node:stream";
import { createTreasuryGuardHandler } from "./server.js";
import { createPayer } from "./payers/index.js";
import {
  buildPaymentHeaderEnvelope,
  PAYMENT_DEFAULTS,
  encodePaymentHeader,
  selectPaymentRequirement
} from "./payments/catalog.js";

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
    end(chunk) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
    }
  };

  await handler(request, response);
  return {
    statusCode: response.statusCode,
    body: chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null
  };
}

function buildRequest(mode) {
  if (mode === "thesis") {
    const providerPayoutAddress =
      process.env.TREASURY_GUARD_REAL_SMOKE_PROVIDER_PAYOUT_ADDRESS || "";
    const providerFields = providerPayoutAddress
      ? {
          providerId:
            process.env.TREASURY_GUARD_REAL_SMOKE_PROVIDER_ID || "provider-brett",
          providerName:
            process.env.TREASURY_GUARD_REAL_SMOKE_PROVIDER_NAME ||
            "Brett Signal AI",
          providerKind:
            process.env.TREASURY_GUARD_REAL_SMOKE_PROVIDER_KIND || "external",
          providerPayoutAddress
        }
      : {};
    return {
      skuId: "thesisPlan",
      method: "POST",
      url: "/premium/thesis-plan",
      body: {
        side: process.env.TREASURY_GUARD_REAL_SMOKE_SIDE || "buy",
        symbol: process.env.TREASURY_GUARD_REAL_SMOKE_SYMBOL || "BRETT",
        chain: process.env.TREASURY_GUARD_REAL_SMOKE_CHAIN || "base",
        budgetUsd: Number(
          process.env.TREASURY_GUARD_REAL_SMOKE_BUDGET_USD || "1000"
        ),
        riskProfile:
          process.env.TREASURY_GUARD_REAL_SMOKE_RISK_PROFILE || "balanced",
        stable: process.env.TREASURY_GUARD_REAL_SMOKE_STABLE || "USDC",
        thesis:
          process.env.TREASURY_GUARD_REAL_SMOKE_THESIS ||
          "Whale support and routing quality still justify a guarded entry.",
        thesisSource:
          process.env.TREASURY_GUARD_REAL_SMOKE_THESIS_SOURCE ||
          "external-ai",
        ...providerFields
      }
    };
  }

  if (mode === "trade") {
    return {
      skuId: "tradePlan",
      method: "POST",
      url: "/premium/trade-plan",
      body: {
        side: "buy",
        symbol: process.env.TREASURY_GUARD_REAL_SMOKE_SYMBOL || "BRETT",
        chain: process.env.TREASURY_GUARD_REAL_SMOKE_CHAIN || "base",
        budgetUsd: Number(
          process.env.TREASURY_GUARD_REAL_SMOKE_BUDGET_USD || "1000"
        ),
        riskProfile:
          process.env.TREASURY_GUARD_REAL_SMOKE_RISK_PROFILE || "balanced",
        stable: process.env.TREASURY_GUARD_REAL_SMOKE_STABLE || "USDC"
      }
    };
  }

  if (mode === "exit") {
    return {
      skuId: "exitPlan",
      method: "POST",
      url: "/premium/trade-plan",
      body: {
        side: "sell",
        symbol: process.env.TREASURY_GUARD_REAL_SMOKE_SYMBOL || "PEPE",
        chain: process.env.TREASURY_GUARD_REAL_SMOKE_CHAIN || "ethereum",
        budgetUsd: Number(
          process.env.TREASURY_GUARD_REAL_SMOKE_BUDGET_USD || "1000"
        ),
        riskProfile:
          process.env.TREASURY_GUARD_REAL_SMOKE_RISK_PROFILE || "balanced",
        stable: process.env.TREASURY_GUARD_REAL_SMOKE_STABLE || "USDC"
      }
    };
  }

  return {
    skuId: "opportunities",
    method: "GET",
    url: `/premium/opportunities?chain=${
      process.env.TREASURY_GUARD_REAL_SMOKE_CHAIN || "base"
    }&budgetUsd=${
      process.env.TREASURY_GUARD_REAL_SMOKE_BUDGET_USD || "1000"
    }&limit=${process.env.TREASURY_GUARD_REAL_SMOKE_LIMIT || "2"}`,
    body: null
  };
}

async function main() {
  const mode = String(
    process.env.TREASURY_GUARD_REAL_SMOKE_MODE || "opportunities"
  ).toLowerCase();
  const analysisAdapterName =
    process.env.TREASURY_GUARD_REAL_SMOKE_ANALYSIS_ADAPTER || "mock";
  const payer = createPayer("real-wallet");
  const merchantAddress =
    process.env.TREASURY_GUARD_MERCHANT_ADDRESS || payer.account.address;
  const requestConfig = buildRequest(mode);
  const handler = createTreasuryGuardHandler({
    analysisAdapterName,
    paymentAdapterName: "okx-api",
    merchantAddress,
    paymentChain: "xlayer",
    paymentAsset: process.env.TREASURY_GUARD_REAL_SMOKE_SERVER_PAYMENT_ASSET,
    paymentAssets: process.env.TREASURY_GUARD_REAL_SMOKE_SERVER_PAYMENT_ASSETS
  });
  const first = await invokeHandler(handler, {
    method: requestConfig.method,
    url: requestConfig.url,
    headers: {
      host: "127.0.0.1:8788",
      ...(requestConfig.body
        ? {
            "content-type": "application/json"
          }
        : {})
    },
    body: requestConfig.body
  });

  if (first.statusCode !== 402) {
    throw new Error(`Expected 402 invoice, received ${first.statusCode}.`);
  }

  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: process.env.TREASURY_GUARD_PAYMENT_ASSET || PAYMENT_DEFAULTS.asset
  });
  const paymentPayload = await payer.preparePayment({
    paymentRequirements: requirement,
    invoice: first.body
  });
  const second = await invokeHandler(handler, {
    method: requestConfig.method,
    url: requestConfig.url,
    headers: {
      host: "127.0.0.1:8788",
      ...(requestConfig.body
        ? {
            "content-type": "application/json"
          }
        : {}),
      "x-payment": encodePaymentHeader(
        buildPaymentHeaderEnvelope({
          paymentPayload,
          paymentRequirements: requirement
        })
      )
    },
    body: requestConfig.body
  });

  console.log(
    JSON.stringify(
      {
        ok: second.statusCode === 200,
        mode,
        analysisAdapter: analysisAdapterName,
        skuId: requestConfig.skuId,
        selectedAsset: requirement?.extra?.assetSymbol || null,
        providerId: requirement?.extra?.providerId ?? null,
        providerKind: requirement?.extra?.providerKind ?? null,
        platformTakeRateBps: requirement?.extra?.platformTakeRateBps ?? null,
        providerPayoutBps: requirement?.extra?.providerPayoutBps ?? null,
        acceptedAssets: (first.body.paymentRequirements || [])
          .map((item) => item?.extra?.assetSymbol)
          .filter(Boolean),
        merchantAddress,
        invoice: first.body,
        paid: second
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error.message || error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
