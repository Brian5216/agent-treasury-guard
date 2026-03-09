#!/usr/bin/env node

import { parseArgs } from "./core/args.js";
import { renderResult } from "./core/render.js";
import { titleCase } from "./core/utils.js";
import { createPayer } from "./payers/index.js";
import {
  buildPaymentHeaderEnvelope,
  matchPaymentRequirement,
  PAYMENT_DEFAULTS,
  describePaymentRequirements,
  encodePaymentHeader,
  selectPaymentRequirement
} from "./payments/catalog.js";

export async function readResponsePayload(response) {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      kind: "non-json-response",
      status: response.status,
      body: text
    };
  }
}

function buildUrl(baseUrl, pathname, params) {
  const url = new URL(pathname, baseUrl);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

export async function paidFetch({
  method,
  url,
  body,
  payerClient,
  payerAddress,
  paymentAsset
}) {
  const first = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const firstPayload = await readResponsePayload(first);

  if (first.status !== 402) {
    return {
      invoice: null,
      result: firstPayload,
      status: first.status
    };
  }

  const requirement = selectPaymentRequirement(firstPayload.paymentRequirements, {
    assetSymbol: paymentAsset
  });
  const paymentPayload = await payerClient.preparePayment({
    paymentRequirements: requirement,
    payer: payerAddress,
    invoice: firstPayload
  });

  const second = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": encodePaymentHeader(
        buildPaymentHeaderEnvelope({
          paymentPayload,
          paymentRequirements: requirement
        })
      )
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const secondPayload = await readResponsePayload(second);
  if (!second.ok) {
    return {
      invoice: firstPayload,
      result: secondPayload,
      status: second.status
    };
  }
  return {
    invoice: firstPayload,
    result: secondPayload,
    status: second.status
  };
}

export async function freeFetch({ url }) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
  return {
    status: response.status,
    result: await readResponsePayload(response)
  };
}

export function renderPaidResult(payload, format) {
  if (format === "json") {
    return JSON.stringify(payload, null, 2);
  }

  const invoice = matchPaymentRequirement(
    payload.invoice?.paymentRequirements || [],
    payload.result?.payment?.settlement
      ? {
          paymentRequirement: {
            chainIndex: payload.result.payment.settlement.chainIndex,
            asset: payload.result.payment.settlement.asset,
            maxAmountRequired: payload.result.payment.settlement.amount
          }
        }
      : selectPaymentRequirement(payload.invoice?.paymentRequirements || [], {
          assetSymbol: PAYMENT_DEFAULTS.asset
        })
  ) || payload.invoice?.paymentRequirements?.[0];
  const acceptedAssets = (payload.invoice?.paymentRequirements || [])
    .map((requirement) => requirement?.extra?.assetSymbol)
    .filter(Boolean)
    .join(", ");
  const paid = payload.result || {};
  const lines = [
    "# Treasury Guard Premium Purchase",
    "",
    `- Payment adapter: ${paid.payment?.settlement?.provider || "mock-x402"}`,
    invoice ? `- Invoice: ${describePaymentRequirements(invoice)}` : null,
    acceptedAssets ? `- Accepted settlement assets: ${acceptedAssets}` : null,
    paid.payment?.settlement?.amount
      ? `- Settled amount: ${paid.payment.settlement.amount} base units`
      : null,
    paid.payment?.settlement?.txHash ? `- Settlement tx: ${paid.payment.settlement.txHash}` : null,
    ""
  ].filter(Boolean);

  if (payload.status && payload.status !== 200) {
    lines.push(`## Payment Retry Result (${payload.status})`);
    lines.push(
      paid?.message || paid?.error || paid?.kind || "Premium access was not unlocked."
    );
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(payload, null, 2));
    lines.push("```");
    return lines.join("\n");
  }

  if (!paid?.data) {
    lines.push("## Response");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(payload, null, 2));
    lines.push("```");
    return lines.join("\n");
  }

  if (paid.data?.kind === "opportunities") {
    lines.push(`## Paid Scan (${titleCase(paid.data.input.chain)})`);
    paid.data.opportunities.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.symbol} | score ${item.opportunityScore}/100 | risk ${item.risk.score}/100`
      );
    });
  } else if (["trade-plan", "exit-plan", "thesis-plan"].includes(paid.data?.kind)) {
    lines.push(
      paid.data.kind === "exit-plan"
        ? "## Paid Exit Plan"
        : paid.data.kind === "thesis-plan"
          ? "## Paid BYO Thesis Plan"
          : "## Paid Trade Plan"
    );
    lines.push(`${paid.data.asset.symbol} | ${paid.data.execution.decision} | risk ${paid.data.risk.score}/100`);
    lines.push(`Quote: ${paid.data.execution.quote.expectedOutput} ${paid.data.execution.quote.toSymbol}`);
    lines.push(`Decision note: ${paid.data.execution.summary}`);
    if (paid.data.policy?.status) {
      lines.push(`Policy: ${paid.data.policy.status}`);
    }
    if (paid.data.thesis?.verdict) {
      lines.push(`Thesis verdict: ${paid.data.thesis.verdict}`);
    }
  }

  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(paid, null, 2));
  lines.push("```");
  return lines.join("\n");
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  const payerClient = createPayer(options.payerAdapter || PAYMENT_DEFAULTS.payer, {
    command: options.payerCommand
  });
  const server = options.server || PAYMENT_DEFAULTS.serverUrl;
  const payerAddress = options.payer || PAYMENT_DEFAULTS.demoPayer;
  const paymentAsset = options.paymentAsset || PAYMENT_DEFAULTS.asset;

  let payload;
  switch (command) {
    case "request-free-opportunities": {
      const url = buildUrl(server, "/opportunities", {
        chain: options.chain,
        budgetUsd: options.budgetUsd,
        riskProfile: options.riskProfile,
        stable: options.stable,
        limit: options.limit
      });
      payload = await freeFetch({ url });
      break;
    }
    case "request-opportunities": {
      const url = buildUrl(server, "/premium/opportunities", {
        chain: options.chain,
        budgetUsd: options.budgetUsd,
        riskProfile: options.riskProfile,
        stable: options.stable,
        limit: options.limit
      });
      payload = await paidFetch({
        method: "GET",
        url,
        payerClient,
        payerAddress,
        paymentAsset
      });
      break;
    }
    case "request-trade-plan":
    case "request-exit-plan":
    case "request-thesis-plan": {
      const path =
        command === "request-thesis-plan" ? "/premium/thesis-plan" : "/premium/trade-plan";
      const body = {
        side: command === "request-exit-plan" ? "sell" : options.side,
        symbol: options.symbol,
        address: options.address,
        chain: options.chain,
        budgetUsd: Number(options.budgetUsd || "1000"),
        riskProfile: options.riskProfile,
        stable: options.stable,
        walletAddress: options.walletAddress || null,
        thesis: options.thesis || options.thesisSummary || "",
        thesisSource: options.thesisSource || options.sourceAgent || "",
        thesisConfidence: options.thesisConfidence || options.confidence || "",
        thesisBullets:
          options.thesisBullets || options.thesisPoints || options.rationalePoints || "",
        providerId: options.providerId || "",
        providerName: options.providerName || "",
        providerKind: options.providerKind || "",
        providerPayoutAddress: options.providerPayoutAddress || "",
        providerUrl: options.providerUrl || ""
      };
      payload = await paidFetch({
        method: "POST",
        url: buildUrl(server, path),
        body,
        payerClient,
        payerAddress,
        paymentAsset
      });
      break;
    }
    default:
      throw new Error(
        "Unknown client command. Use request-free-opportunities, request-opportunities, request-trade-plan, request-exit-plan, or request-thesis-plan."
      );
  }

  if (command === "request-free-opportunities") {
    console.log(
      String(options.format || "markdown") === "json"
        ? JSON.stringify(payload.result, null, 2)
        : renderResult(payload.result, String(options.format || "markdown"))
    );
    return;
  }

  console.log(renderPaidResult(payload, String(options.format || "markdown")));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
