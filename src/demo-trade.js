#!/usr/bin/env node

import { Readable } from "node:stream";
import { createTreasuryGuardHandler } from "./server.js";
import { createPayer } from "./payers/index.js";
import {
  buildPaymentHeaderEnvelope,
  PAYMENT_DEFAULTS,
  describePaymentRequirements,
  encodePaymentHeader,
  selectPaymentRequirement
} from "./payments/catalog.js";

async function invokeHandler(handler, { method, url, headers = {}, body = null }) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
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
    body: chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null
  };
}

function renderDemoOutput({ invoice, paid }) {
  const requirement = selectPaymentRequirement(invoice.paymentRequirements, {
    assetSymbol: PAYMENT_DEFAULTS.asset
  });
  const acceptedAssets = invoice.paymentRequirements
    .map((item) => item?.extra?.assetSymbol)
    .filter(Boolean)
    .join(", ");
  const plan = paid.data;
  const lines = [
    "# Treasury Guard x402 Trade Demo",
    "",
    `- Invoice: ${describePaymentRequirements(requirement)}`,
    `- Merchant: ${requirement.payTo}`,
    `- Resource: ${requirement.resource}`,
    acceptedAssets ? `- Accepted assets: ${acceptedAssets}` : null,
    `- 402 Flow: ${invoice.protocol?.flow?.join(" -> ") || "request -> pay -> verify -> settle -> unlock"}`,
    "",
    "## Paid Trade Plan",
    `- Asset: ${plan.asset.symbol} on ${plan.asset.chain}`,
    `- Decision: ${plan.execution.decision}`,
    `- Risk: ${plan.risk.score}/100 (${plan.risk.label})`,
    `- Expected output: ${plan.execution.quote.expectedOutput} ${plan.execution.quote.toSymbol}`,
    `- Route: ${plan.execution.quote.routeSummary}`,
    "",
    "```json",
    JSON.stringify(paid, null, 2),
    "```"
  ];

  return lines.join("\n");
}

async function main() {
  const handler = createTreasuryGuardHandler({
    analysisAdapterName: "mock",
    paymentAdapterName: PAYMENT_DEFAULTS.adapter
  });
  const payerClient = createPayer(PAYMENT_DEFAULTS.payer, {
    command: PAYMENT_DEFAULTS.payerCommand
  });
  const body = {
    side: "buy",
    symbol: "BRETT",
    chain: "base",
    budgetUsd: 1000,
    riskProfile: "balanced",
    stable: "USDC",
    walletAddress: "0xdead00000000000000000000000000000000beef"
  };

  const first = await invokeHandler(handler, {
    method: "POST",
    url: "/premium/trade-plan",
    headers: {
      host: "127.0.0.1:8788",
      "content-type": "application/json"
    },
    body
  });

  if (first.statusCode !== 402) {
    throw new Error("Expected the first trade-plan request to return 402.");
  }

  const requirement = selectPaymentRequirement(first.body.paymentRequirements, {
    assetSymbol: PAYMENT_DEFAULTS.asset
  });
  const paymentPayload = await payerClient.preparePayment({
    paymentRequirements: requirement,
    payer: PAYMENT_DEFAULTS.demoPayer,
    invoice: first.body
  });

  const second = await invokeHandler(handler, {
    method: "POST",
    url: "/premium/trade-plan",
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
    body
  });

  if (second.statusCode !== 200) {
    throw new Error("Expected the paid premium trade request to unlock the resource.");
  }

  console.log(
    renderDemoOutput({
      invoice: first.body,
      paid: second.body
    })
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
