#!/usr/bin/env node

import { Readable } from "node:stream";
import { createTreasuryGuardHandler } from "./server.js";
import { createPayer } from "./payers/index.js";
import {
  buildPaymentHeaderEnvelope,
  encodePaymentHeader,
  PAYMENT_DEFAULTS,
  selectPaymentRequirement
} from "./payments/catalog.js";

function readLiveEnv(name, fallback = "") {
  return (
    process.env[`TREASURY_GUARD_LIVE_${name}`] ||
    process.env[`TREASURY_GUARD_CHAMPION_${name}`] ||
    fallback
  );
}

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
    const providerPayoutAddress = readLiveEnv("PROVIDER_PAYOUT_ADDRESS");
    const providerFields = providerPayoutAddress
      ? {
          providerId: readLiveEnv("PROVIDER_ID", "provider-brett"),
          providerName: readLiveEnv("PROVIDER_NAME", "Brett Signal AI"),
          providerKind: readLiveEnv("PROVIDER_KIND", "external"),
          providerPayoutAddress
        }
      : {};
    return {
      title: "Thesis",
      method: "POST",
      url: "/premium/thesis-plan",
      body: {
        side: readLiveEnv("SIDE", "buy"),
        symbol: readLiveEnv("SYMBOL", "BRETT"),
        chain: readLiveEnv("CHAIN", "base"),
        budgetUsd: Number(readLiveEnv("BUDGET_USD", "1000")),
        riskProfile: readLiveEnv("RISK_PROFILE", "balanced"),
        stable: readLiveEnv("STABLE", "USDC"),
        thesis: readLiveEnv(
          "THESIS",
          "Whale support and routing quality still justify a guarded entry."
        ),
        thesisSource: readLiveEnv("THESIS_SOURCE", "external-ai"),
        ...providerFields
      }
    };
  }

  if (mode === "exit") {
    return {
      title: "Exit",
      method: "POST",
      url: "/premium/trade-plan",
      body: {
        side: "sell",
        symbol: readLiveEnv("SYMBOL", "PEPE"),
        chain: readLiveEnv("CHAIN", "ethereum"),
        budgetUsd: Number(readLiveEnv("BUDGET_USD", "1000")),
        riskProfile: readLiveEnv("RISK_PROFILE", "balanced"),
        stable: readLiveEnv("STABLE", "USDC")
      }
    };
  }

  return {
    title: "Trade",
    method: "POST",
    url: "/premium/trade-plan",
    body: {
      side: "buy",
      symbol: readLiveEnv("SYMBOL", "BRETT"),
      chain: readLiveEnv("CHAIN", "base"),
      budgetUsd: Number(readLiveEnv("BUDGET_USD", "1000")),
      riskProfile: readLiveEnv("RISK_PROFILE", "balanced"),
      stable: readLiveEnv("STABLE", "USDC")
    }
  };
}

function renderSummary({ mode, analysisAdapter, selectedAsset, invoice, paid }) {
  const acceptedAssets = (invoice.paymentRequirements || [])
    .map((item) => item?.extra?.assetSymbol)
    .filter(Boolean)
    .join(", ");
  const result = paid.body.data;
  const policyIssues = (result.machineView?.policy?.failingChecks || [])
    .map((item) => `${item.id}:${item.status}`)
    .join(", ");
  const triggerSummary = (result.watch?.triggers || [])
    .slice(0, 3)
    .map((item) => `${item.signal} -> ${item.action}`)
    .join(" | ");
  const thesisVerdict = result.thesis?.verdict
    ? `${result.thesis.verdict} / ${result.thesis.operationalVerdict}`
    : null;

  return [
    "# Treasury Guard Live Demo",
    "",
    `- Mode: ${mode}`,
    `- Analysis adapter: ${analysisAdapter}`,
    `- Settlement asset: ${selectedAsset}`,
    `- Accepted assets: ${acceptedAssets}`,
    `- Settlement tx: ${paid.body.payment.settlement.txHash}`,
    `- Result adapter: ${result.adapter}`,
    "",
    `## ${mode} Result`,
    `- Asset: ${result.asset.symbol} on ${result.asset.chain}`,
    `- Provider: ${result.provider?.name || "Treasury Guard"} (${result.provider?.kind || "house"})`,
    `- Revenue split: platform ${result.commercialTerms?.platformTakeRateBps / 100 || 0}% / provider ${result.commercialTerms?.providerPayoutBps / 100 || 0}%`,
    `- Decision: ${result.execution.decision}`,
    `- Policy: ${result.policy.status}`,
    `- Risk: ${result.risk.score}/100 (${result.risk.label})`,
    `- Route: ${result.execution.quote.routeSummary}`,
    `- Gas: ${result.execution.quote.gasUsd}`,
    thesisVerdict ? `- Thesis verdict: ${thesisVerdict}` : null,
    policyIssues ? `- Policy issues: ${policyIssues}` : null,
    triggerSummary ? `- Watch triggers: ${triggerSummary}` : null,
    `- machineView intent: ${result.machineView.intent}`
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const mode = String(readLiveEnv("MODE", "trade")).toLowerCase();
  const analysisAdapter = readLiveEnv("ANALYSIS_ADAPTER", "okx-http");
  const requestConfig = buildRequest(mode);
  const payer = createPayer("real-wallet");
  const merchantAddress =
    process.env.TREASURY_GUARD_MERCHANT_ADDRESS || payer.account.address;
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: analysisAdapter,
    paymentAdapterName: "okx-api",
    merchantAddress,
    paymentChain: "xlayer"
  });

  const first = await invokeHandler(handler, {
    method: requestConfig.method,
    url: requestConfig.url,
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body: requestConfig.body
  });

  if (first.statusCode !== 402) {
    throw new Error(`Expected 402 invoice, received ${first.statusCode}`);
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
      "content-type": "application/json",
      "x-payment": encodePaymentHeader(
        buildPaymentHeaderEnvelope({
          paymentPayload,
          paymentRequirements: requirement
        })
      )
    },
    body: requestConfig.body
  });

  if (second.statusCode !== 200) {
    throw new Error(`Expected paid unlock, received ${second.statusCode}`);
  }

  console.log(
    renderSummary({
      mode: requestConfig.title,
      analysisAdapter,
      selectedAsset: requirement.extra?.assetSymbol || "unknown",
      invoice: first.body,
      paid: second
    })
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
