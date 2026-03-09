#!/usr/bin/env node

import http from "node:http";
import { parseArgs } from "./core/args.js";
import { writeJson, readJsonBody, getRequestOrigin } from "./core/http.js";
import { MARKETPLACE_DEFAULTS } from "./core/constants.js";
import {
  buildCommercialTerms,
  buildProviderProfile,
  findOpportunities,
  prepareThesisPlan,
  prepareTradePlan
} from "./core/planner.js";
import { MockOkxAdapter } from "./adapters/mock.js";
import { OnchainosCliAdapter } from "./adapters/onchainos-cli.js";
import { OkxHttpAdapter } from "./adapters/okx-http.js";
import { createPaymentAdapter } from "./payments/index.js";
import {
  MONETIZATION_DEFAULTS,
  PAYMENT_DEFAULTS,
  PREMIUM_SKUS,
  X402_PROTOCOL,
  buildPremiumEnvelopeSchemaForSku,
  buildPaymentRequiredResponse,
  buildPaymentRequirementsSet,
  buildSettlementSummary,
  decodePaymentHeader,
  matchPaymentRequirement,
  normalizePaymentAssetSymbols,
  unwrapPaymentHeader
} from "./payments/catalog.js";
import { buildPaymentErrorPayload, humanizePaymentError } from "./payments/errors.js";

function createAnalysisAdapter(name) {
  if (name === "onchainos-cli") {
    return new OnchainosCliAdapter();
  }
  if (name === "okx-http") {
    return new OkxHttpAdapter();
  }
  return new MockOkxAdapter();
}

function pickSkuFromTradeBody(body) {
  return String(body?.side || "buy").toLowerCase() === "sell" ? "exitPlan" : "tradePlan";
}

function buildProviderTerms(body = {}, workflow = "direct") {
  const provider = buildProviderProfile({
    options: body,
    workflow,
    thesisInput:
      workflow === "thesis"
        ? {
            source: String(body.thesisSource || body.providerName || body.providerId || "external-ai")
          }
        : null
  });
  const commercialTerms = buildCommercialTerms(provider);

  return {
    provider,
    commercialTerms
  };
}

function buildServiceManifest({
  origin,
  analysisAdapter,
  paymentAdapter,
  merchantAddress,
  paymentChain,
  paymentAsset,
  paymentAssets,
  supportedPayments
}) {
  const acceptedAssets = normalizePaymentAssetSymbols({
    chain: paymentChain || PAYMENT_DEFAULTS.chain,
    assetSymbol: paymentAsset || undefined,
    assetSymbols: paymentAssets || PAYMENT_DEFAULTS.assets
  });
  const capabilities = Object.values(PREMIUM_SKUS).map((sku) => ({
    skuId: sku.id,
    path: sku.path,
    method: sku.path.endsWith("opportunities") ? "GET" : "POST",
    access: "premium",
    priceUsd:
      sku.id === "opportunities"
        ? PAYMENT_DEFAULTS.prices.opportunities
        : sku.id === "tradePlan"
          ? PAYMENT_DEFAULTS.prices.tradePlan
          : sku.id === "exitPlan"
            ? PAYMENT_DEFAULTS.prices.exitPlan
            : PAYMENT_DEFAULTS.prices.thesisPlan,
    description: sku.description
  }));

  return {
    name: "Agent Treasury Guard",
    version: "0.1.0",
    description:
      "A guarded OKX workflow service that offers free discovery plus paid trade, thesis-validation, and exit workflows over x402.",
    serviceUrl: origin,
    discovery: {
      health: `${origin}/health`,
      supported: `${origin}/supported`,
      freeOpportunityScan: `${origin}/opportunities`,
      premiumOpportunityScan: `${origin}/premium/opportunities`,
      premiumTradePlan: `${origin}/premium/trade-plan`,
      premiumExitPlan: `${origin}/premium/trade-plan?side=sell`,
      premiumThesisPlan: `${origin}/premium/thesis-plan`
    },
    adapters: {
      analysis: analysisAdapter.name,
      payment: paymentAdapter.name
    },
    payment: {
      protocol: X402_PROTOCOL,
      merchantAddress: merchantAddress || PAYMENT_DEFAULTS.merchantAddress,
      chain: paymentChain || PAYMENT_DEFAULTS.chain,
      acceptedAssets,
      preferredAsset:
        paymentAsset || acceptedAssets[0] || PAYMENT_DEFAULTS.asset,
      supported: supportedPayments || null
    },
    marketplace: {
      model: MARKETPLACE_DEFAULTS.model,
      providerProgram: MARKETPLACE_DEFAULTS.providerProgram,
      houseLayer: true,
      externalProviders: true,
      callerThesisMode: true,
      platformTakeRateBps: MONETIZATION_DEFAULTS.platformTakeRateBps,
      defaultProviderPayoutBps: MONETIZATION_DEFAULTS.defaultProviderPayoutBps,
      settlementMode: MONETIZATION_DEFAULTS.settlementMode,
      splitRule:
        "20/80 revenue share only applies to approved provider theses with a payout address. Plain BYO-thesis calls are monetized directly by Treasury Guard."
    },
    capabilities: [
      {
        skuId: "freeOpportunityScan",
        path: "/opportunities",
        method: "GET",
        access: "free",
        description:
          "Free preview layer for opportunity discovery. Use this to shortlist candidates before buying a guarded workflow."
      },
      ...capabilities
    ]
  };
}

export function isSettledSettlement(settlement) {
  return settlement?.status === "settled" || settlement?.success === true;
}

async function unlockPremiumResource({
  request,
  response,
  paymentAdapter,
  paymentRequirements,
  compute
}) {
  const paymentHeader = request.headers["x-payment"];
  if (!paymentHeader) {
    writeJson(
      response,
      402,
      buildPaymentRequiredResponse({
        paymentRequirements
      })
    );
    return;
  }

  let paymentHeaderPayload;
  try {
    paymentHeaderPayload = decodePaymentHeader(paymentHeader);
  } catch (error) {
    writeJson(response, 400, {
      kind: "payment-error",
      error: String(error.message || error)
    });
    return;
  }

  const requirement = matchPaymentRequirement(
    paymentRequirements,
    paymentHeaderPayload
  );
  if (!requirement) {
    writeJson(
      response,
      402,
      buildPaymentRequiredResponse({
        paymentRequirements,
        message: humanizePaymentError({
          reason: "unsupported_asset",
          fallback:
            "The payment payload does not match any supported settlement option for this invoice."
        })
      })
    );
    return;
  }
  const { paymentPayload } = unwrapPaymentHeader(paymentHeaderPayload);

  let verification;
  try {
    verification = await paymentAdapter.verify({
      paymentPayload,
      paymentRequirements: requirement
    });
  } catch (error) {
    writeJson(response, 502, buildPaymentErrorPayload(error, "Payment verification request failed."));
    return;
  }

  if (verification?.valid !== true) {
    writeJson(
      response,
      402,
      buildPaymentRequiredResponse({
        paymentRequirements,
        message:
          humanizePaymentError({
            reason: verification?.reason || verification?.invalidReason,
            fallback:
              verification?.reason ||
              verification?.invalidReason ||
              "Payment verification failed."
          }) ||
          "Payment verification failed."
      })
    );
    return;
  }

  let settlement;
  try {
    settlement = await paymentAdapter.settle({
      paymentPayload,
      paymentRequirements: requirement,
      verification
    });
  } catch (error) {
    writeJson(response, 502, buildPaymentErrorPayload(error, "Payment settlement request failed."));
    return;
  }
  if (!isSettledSettlement(settlement)) {
    writeJson(
      response,
      402,
      buildPaymentRequiredResponse({
        paymentRequirements,
        message: humanizePaymentError({
          reason: settlement?.errorReason,
          fallback: settlement?.errorReason || "Payment settlement failed."
        })
      })
    );
    return;
  }
  const data = await compute();

  writeJson(response, 200, {
    kind: "premium-access",
    skuId: requirement.extra?.skuId,
    payment: {
      verification,
      settlement: buildSettlementSummary(settlement)
    },
    data
  });
}

export function createTreasuryGuardHandler({
  analysisAdapterName,
  paymentAdapterName,
  merchantAddress,
  paymentChain,
  paymentAsset,
  paymentAssets
} = {}) {
  const analysisAdapter = createAnalysisAdapter(analysisAdapterName);
  const paymentAdapter = createPaymentAdapter(paymentAdapterName);
  void paymentAdapter.getSupported?.().catch(() => {});

  return async (request, response) => {
    try {
      const origin = getRequestOrigin(request);
      const url = new URL(request.url || "/", origin);

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, {
          ok: true,
          analysisAdapter: analysisAdapter.name,
          paymentAdapter: paymentAdapter.name
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/supported") {
        const forceRefresh = ["1", "true", "yes"].includes(
          String(url.searchParams.get("refresh") || "").toLowerCase()
        );
        const supported = await paymentAdapter.getSupported({
          forceRefresh
        });
        writeJson(response, 200, supported);
        return;
      }

      if (request.method === "GET" && url.pathname === "/manifest") {
        const supportedPayments = await paymentAdapter.getSupported();
        writeJson(
          response,
          200,
          buildServiceManifest({
            origin,
            analysisAdapter,
            paymentAdapter,
            merchantAddress,
            paymentChain,
            paymentAsset,
            paymentAssets,
            supportedPayments
          })
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/opportunities") {
        const options = {
          chain: url.searchParams.get("chain") || "base",
          budgetUsd: Number(url.searchParams.get("budgetUsd") || "1000"),
          riskProfile: url.searchParams.get("riskProfile") || "balanced",
          stable: url.searchParams.get("stable") || "USDC",
          limit: Number(url.searchParams.get("limit") || "3")
        };
        writeJson(response, 200, await findOpportunities(analysisAdapter, options));
        return;
      }

      if (request.method === "GET" && url.pathname === "/premium/opportunities") {
        const options = {
          chain: url.searchParams.get("chain") || "base",
          budgetUsd: Number(url.searchParams.get("budgetUsd") || "1000"),
          riskProfile: url.searchParams.get("riskProfile") || "balanced",
          stable: url.searchParams.get("stable") || "USDC",
          limit: Number(url.searchParams.get("limit") || "3")
        };
        const paymentRequirements = buildPaymentRequirementsSet({
          skuId: "opportunities",
          requestUrl: url.toString(),
          method: request.method,
          requestBody: null,
          amountUsd: PAYMENT_DEFAULTS.prices.opportunities,
          extra: {
            monetizationModel: MONETIZATION_DEFAULTS.model,
            providerProgram: MONETIZATION_DEFAULTS.providerProgram
          },
          merchantAddress: merchantAddress || PAYMENT_DEFAULTS.merchantAddress,
          chain: paymentChain || PAYMENT_DEFAULTS.chain,
          assetSymbol: paymentAsset || undefined,
          assetSymbols: paymentAssets || PAYMENT_DEFAULTS.assets,
          outputSchema: buildPremiumEnvelopeSchemaForSku("opportunities")
        });

        await unlockPremiumResource({
          request,
          response,
          paymentAdapter,
          paymentRequirements,
          compute: () => findOpportunities(analysisAdapter, options)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/premium/thesis-plan") {
        let body;
        try {
          body = (await readJsonBody(request)) || {};
        } catch (error) {
          writeJson(response, 400, {
            kind: "invalid-json",
            message: String(error.message || error)
          });
          return;
        }
        const providerTerms = buildProviderTerms(body, "thesis");
        const paymentRequirements = buildPaymentRequirementsSet({
          skuId: "thesisPlan",
          requestUrl: url.toString(),
          method: request.method,
          requestBody: body,
          amountUsd: PAYMENT_DEFAULTS.prices.thesisPlan,
          extra: {
            providerId: providerTerms.provider.id,
            providerName: providerTerms.provider.name,
            providerKind: providerTerms.provider.kind,
            providerPayoutAddress: providerTerms.provider.payoutAddress,
            platformTakeRateBps: providerTerms.commercialTerms.platformTakeRateBps,
            providerPayoutBps: providerTerms.commercialTerms.providerPayoutBps,
            settlementMode: providerTerms.commercialTerms.settlementMode
          },
          merchantAddress: merchantAddress || PAYMENT_DEFAULTS.merchantAddress,
          chain: paymentChain || PAYMENT_DEFAULTS.chain,
          assetSymbol: paymentAsset || undefined,
          assetSymbols: paymentAssets || PAYMENT_DEFAULTS.assets,
          outputSchema: buildPremiumEnvelopeSchemaForSku("thesisPlan")
        });

        await unlockPremiumResource({
          request,
          response,
          paymentAdapter,
          paymentRequirements,
          compute: () => prepareThesisPlan(analysisAdapter, body)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/premium/trade-plan") {
        let body;
        try {
          body = (await readJsonBody(request)) || {};
        } catch (error) {
          writeJson(response, 400, {
            kind: "invalid-json",
            message: String(error.message || error)
          });
          return;
        }
        const skuId = pickSkuFromTradeBody(body);
        const providerTerms = buildProviderTerms(body, "house");
        const paymentRequirements = buildPaymentRequirementsSet({
          skuId,
          requestUrl: url.toString(),
          method: request.method,
          requestBody: body,
          amountUsd: PAYMENT_DEFAULTS.prices[skuId],
          extra: {
            providerId: providerTerms.provider.id,
            providerName: providerTerms.provider.name,
            providerKind: providerTerms.provider.kind,
            platformTakeRateBps: providerTerms.commercialTerms.platformTakeRateBps,
            providerPayoutBps: providerTerms.commercialTerms.providerPayoutBps,
            settlementMode: providerTerms.commercialTerms.settlementMode
          },
          merchantAddress: merchantAddress || PAYMENT_DEFAULTS.merchantAddress,
          chain: paymentChain || PAYMENT_DEFAULTS.chain,
          assetSymbol: paymentAsset || undefined,
          assetSymbols: paymentAssets || PAYMENT_DEFAULTS.assets,
          outputSchema: buildPremiumEnvelopeSchemaForSku(skuId)
        });

        await unlockPremiumResource({
          request,
          response,
          paymentAdapter,
          paymentRequirements,
          compute: () => prepareTradePlan(analysisAdapter, body)
        });
        return;
      }

      writeJson(response, 404, {
        error: "not_found",
        path: url.pathname
      });
    } catch (error) {
      writeJson(response, 500, {
        error: "server_error",
        message: String(error.message || error)
      });
    }
  };
}

export function createTreasuryGuardServer(options = {}) {
  return http.createServer(createTreasuryGuardHandler(options));
}

async function main() {
  const { options } = parseArgs(process.argv);
  const server = createTreasuryGuardServer({
    analysisAdapterName: options.adapter,
    paymentAdapterName: options.paymentAdapter || PAYMENT_DEFAULTS.adapter,
    merchantAddress: options.merchantAddress,
    paymentChain: options.paymentChain,
    paymentAsset: options.paymentAsset,
    paymentAssets: options.paymentAssets
  });

  const port = Number(options.port || PAYMENT_DEFAULTS.serverPort);
  const host = options.host || "127.0.0.1";
  await new Promise((resolve) => server.listen(port, host, resolve));
  console.log(
    JSON.stringify(
      {
        ok: true,
        server: `http://${host}:${port}`,
        analysisAdapter: options.adapter,
        paymentAdapter: options.paymentAdapter || PAYMENT_DEFAULTS.adapter
      },
      null,
      2
    )
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
