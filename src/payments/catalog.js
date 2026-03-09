import crypto from "node:crypto";
import { CHAIN_DEFAULTS, MARKETPLACE_DEFAULTS } from "../core/constants.js";
import { nowIso, titleCase, toMinimalUnits } from "../core/utils.js";
import {
  exitPlanResultSchema,
  opportunityResultSchema,
  premiumAccessEnvelopeSchema,
  thesisPlanResultSchema,
  tradePlanResultSchema
} from "../contracts/schemas.js";

export const X402_VERSION = 1;

export const PAYMENT_DEFAULTS = {
  adapter: process.env.TREASURY_GUARD_PAYMENT_ADAPTER || "mock",
  payer: process.env.TREASURY_GUARD_PAYER || "mock",
  payerCommand: process.env.TREASURY_GUARD_PAYER_COMMAND || "",
  chain: process.env.TREASURY_GUARD_PAYMENT_CHAIN || "xlayer",
  asset: process.env.TREASURY_GUARD_PAYMENT_ASSET || "USDC",
  assets: process.env.TREASURY_GUARD_PAYMENT_ASSETS || "",
  merchantAddress:
    process.env.TREASURY_GUARD_MERCHANT_ADDRESS ||
    "0x1234567890abcdef1234567890abcdef12345678",
  demoPayer:
    process.env.TREASURY_GUARD_DEMO_PAYER ||
    "0xdead00000000000000000000000000000000beef",
  serverPort: Number(process.env.TREASURY_GUARD_SERVER_PORT || "8788"),
  serverUrl: process.env.TREASURY_GUARD_SERVER_URL || "http://127.0.0.1:8788",
  supportedTtlMs: Number(process.env.TREASURY_GUARD_PAYMENT_SUPPORTED_TTL_MS || "300000"),
  prices: {
    opportunities: Number(process.env.TREASURY_GUARD_PREMIUM_OPPORTUNITIES_PRICE_USD || "0.30"),
    tradePlan: Number(process.env.TREASURY_GUARD_PREMIUM_TRADE_PLAN_PRICE_USD || "0.80"),
    exitPlan: Number(process.env.TREASURY_GUARD_PREMIUM_EXIT_PLAN_PRICE_USD || "0.65"),
    thesisPlan: Number(process.env.TREASURY_GUARD_PREMIUM_THESIS_PLAN_PRICE_USD || "0.95")
  }
};

export const MONETIZATION_DEFAULTS = {
  model: MARKETPLACE_DEFAULTS.model,
  providerProgram: MARKETPLACE_DEFAULTS.providerProgram,
  platformTakeRateBps: MARKETPLACE_DEFAULTS.platformTakeRateBps,
  defaultProviderPayoutBps: Math.max(0, 10000 - MARKETPLACE_DEFAULTS.platformTakeRateBps),
  settlementMode: MARKETPLACE_DEFAULTS.settlementMode
};

export const X402_PROTOCOL = {
  scheme: "x402",
  version: X402_VERSION,
  paymentRequiredStatus: 402,
  retryHeader: "X-PAYMENT",
  headerEncoding: "json-or-base64url-json",
  flow: [
    "request_protected_resource",
    "receive_402_invoice",
    "sign_payment_payload",
    "retry_with_x_payment",
    "provider_verify",
    "provider_settle",
    "unlock_premium_result"
  ]
};

export const PAYMENT_ASSETS = {
  xlayer: {
    USDG: {
      symbol: "USDG",
      address: "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8",
      decimals: 6,
      network: "xlayer",
      domainName: "Global Dollar",
      domainVersion: "1"
    },
    USDT: {
      symbol: "USDT",
      address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
      decimals: 6,
      network: "xlayer",
      domainName: "USD\u20ae0",
      domainVersion: "1"
    },
    USDC: {
      symbol: "USDC",
      address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
      decimals: 6,
      network: "xlayer",
      domainName: "USD Coin",
      domainVersion: "2"
    }
  }
};

export const PREMIUM_SKUS = {
  opportunities: {
    id: "opportunities",
    path: "/premium/opportunities",
    description: "Premium guarded opportunity scan with OKX signal enrichment and risk ranking.",
    mimeType: "application/json",
    resultSchema: opportunityResultSchema
  },
  tradePlan: {
    id: "tradePlan",
    path: "/premium/trade-plan",
    description:
      "Premium guarded trade plan with treasury policy checks, watch triggers, and machine-readable next calls.",
    mimeType: "application/json",
    resultSchema: tradePlanResultSchema
  },
  exitPlan: {
    id: "exitPlan",
    path: "/premium/trade-plan",
    description:
      "Premium guarded exit plan with treasury policy checks, staged de-risk clips, and watch triggers.",
    mimeType: "application/json",
    resultSchema: exitPlanResultSchema
  },
  thesisPlan: {
    id: "thesisPlan",
    path: "/premium/thesis-plan",
    description:
      "Premium BYO-thesis workflow that validates an external AI thesis and turns it into a guarded OKX execution plan.",
    mimeType: "application/json",
    resultSchema: thesisPlanResultSchema
  }
};

export function getPaymentAsset(chain = PAYMENT_DEFAULTS.chain, symbol = PAYMENT_DEFAULTS.asset) {
  const assets = PAYMENT_ASSETS[String(chain).toLowerCase()];
  if (!assets) {
    throw new Error(`Unsupported x402 chain for Treasury Guard: ${chain}`);
  }

  const asset = assets[String(symbol).toUpperCase()];
  if (!asset) {
    throw new Error(`Unsupported x402 settlement asset: ${symbol} on ${chain}`);
  }

  return {
    ...asset,
    chain: String(chain).toLowerCase(),
    chainIndex: CHAIN_DEFAULTS[String(chain).toLowerCase()]?.chainIndex
  };
}

export function listPaymentAssetSymbols(chain = PAYMENT_DEFAULTS.chain) {
  return Object.keys(PAYMENT_ASSETS[String(chain).toLowerCase()] || {});
}

export function normalizePaymentAssetSymbols({
  chain = PAYMENT_DEFAULTS.chain,
  assetSymbol,
  assetSymbols = PAYMENT_DEFAULTS.assets
} = {}) {
  const requested = assetSymbol || assetSymbols;
  const symbols = Array.isArray(requested)
    ? requested
    : String(requested || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
  const finalSymbols =
    symbols.length > 0 ? symbols : listPaymentAssetSymbols(chain);

  return [...new Set(finalSymbols.map((value) => String(value).toUpperCase()))];
}

export function getSku(skuId) {
  const sku = PREMIUM_SKUS[skuId];
  if (!sku) {
    throw new Error(`Unknown premium sku: ${skuId}`);
  }
  return sku;
}

export function getKnownAssetsForChainIndex(chainIndex) {
  const match = Object.entries(PAYMENT_ASSETS).find(([chain, assets]) => {
    const firstAsset = assets[Object.keys(assets)[0]];
    return String(CHAIN_DEFAULTS[chain]?.chainIndex || "") === String(chainIndex || firstAsset?.chainIndex || "");
  });

  if (!match) {
    return [];
  }

  const [chain, assets] = match;
  return Object.values(assets).map((asset) => ({
    ...asset,
    chain,
    chainIndex: CHAIN_DEFAULTS[chain]?.chainIndex || null
  }));
}

export function listKnownPaymentNetworks() {
  return Object.entries(PAYMENT_ASSETS).map(([chain, assets]) => ({
    chain,
    chainIndex: CHAIN_DEFAULTS[chain]?.chainIndex || null,
    chainName: chain === "xlayer" ? "X Layer" : titleCase(chain),
    schemes: ["exact"],
    assets: Object.values(assets).map((asset) => ({
      ...asset,
      chain,
      chainIndex: CHAIN_DEFAULTS[chain]?.chainIndex || null
    }))
  }));
}

export function hashRequest({ method, url, body }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ method, url, body: body || null }))
    .digest("hex");
}

export function buildPaymentRequirements({
  skuId,
  requestUrl,
  method,
  requestBody,
  amountUsd,
  outputSchema,
  extra = {},
  merchantAddress = PAYMENT_DEFAULTS.merchantAddress,
  chain = PAYMENT_DEFAULTS.chain,
  assetSymbol = PAYMENT_DEFAULTS.asset
}) {
  const sku = getSku(skuId);
  const asset = getPaymentAsset(chain, assetSymbol);
  const requestHash = hashRequest({
    method: String(method || "GET").toUpperCase(),
    url: requestUrl,
    body: requestBody
  });

  return {
    scheme: "exact",
    chainIndex: asset.chainIndex,
    maxAmountRequired: toMinimalUnits(String(amountUsd), asset.decimals),
    resource: requestUrl,
    description: sku.description,
    mimeType: sku.mimeType,
    outputSchema: outputSchema || sku.resultSchema,
    payTo: merchantAddress,
    maxTimeoutSeconds: 300,
    asset: asset.address,
    extra: {
      skuId,
      amountUsd,
      assetSymbol: asset.symbol,
      chain: asset.chain,
      network: asset.network || asset.chain,
      name: asset.domainName || undefined,
      version: asset.domainVersion || undefined,
      requestHash,
      issuedAt: nowIso(),
      ...extra
    }
  };
}

export function buildPaymentRequirementsSet({
  assetSymbol,
  assetSymbols,
  ...options
}) {
  return normalizePaymentAssetSymbols({
    chain: options.chain,
    assetSymbol,
    assetSymbols
  }).map((symbol) =>
    buildPaymentRequirements({
      ...options,
      assetSymbol: symbol
    })
  );
}

export function buildPaymentRequiredResponse({ paymentRequirements, message }) {
  const requirements = (Array.isArray(paymentRequirements)
    ? paymentRequirements
    : [paymentRequirements]
  ).filter(Boolean);

  return {
    kind: "payment-required",
    x402Version: X402_VERSION,
    error: "payment_required",
    message: message || "Payment required. Resend the request with X-PAYMENT.",
    paymentRequirements: requirements,
    protocol: X402_PROTOCOL,
    machineView: {
      intent: "payment_required",
      retry: {
        header: X402_PROTOCOL.retryHeader,
        encoding: X402_PROTOCOL.headerEncoding,
        flow: X402_PROTOCOL.flow
      },
      accepted: requirements.map((requirement) => ({
        chainIndex: requirement.chainIndex,
        asset: requirement.asset,
        assetSymbol: requirement.extra?.assetSymbol || null,
        maxAmountRequired: requirement.maxAmountRequired
      }))
    }
  };
}

export function encodePaymentHeader(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePaymentHeader(headerValue) {
  const raw = String(headerValue || "").trim();
  if (!raw) {
    return null;
  }

  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    // Ignore invalid base64url input and keep raw JSON parsing path.
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  throw new Error("Invalid X-PAYMENT header. Expected JSON or base64url JSON.");
}

export function buildPaymentHeaderEnvelope({
  paymentPayload,
  paymentRequirements
}) {
  return {
    paymentPayload,
    paymentRequirement: paymentRequirements
      ? {
          chainIndex: paymentRequirements.chainIndex,
          asset: paymentRequirements.asset,
          assetSymbol: paymentRequirements.extra?.assetSymbol || null,
          requestHash: paymentRequirements.extra?.requestHash || null,
          resource: paymentRequirements.resource,
          payTo: paymentRequirements.payTo,
          maxAmountRequired: paymentRequirements.maxAmountRequired
        }
      : null
  };
}

export function unwrapPaymentHeader(headerPayload) {
  if (headerPayload?.paymentPayload || headerPayload?.paymentRequirement || headerPayload?.requirement) {
    return {
      paymentPayload: headerPayload.paymentPayload || null,
      paymentRequirement:
        headerPayload.paymentRequirement || headerPayload.requirement || null
    };
  }

  return {
    paymentPayload: headerPayload,
    paymentRequirement: null
  };
}

export function buildSettlementSummary(settlement) {
  if (!settlement) {
    return null;
  }

  return {
    provider: settlement.provider,
    status: settlement.status,
    settlementId: settlement.settlementId,
    txHash: settlement.txHash || null,
    chainIndex: settlement.chainIndex,
    asset: settlement.asset,
    amount: settlement.amount
  };
}

function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

export function selectPaymentRequirement(
  paymentRequirements,
  { assetSymbol = PAYMENT_DEFAULTS.asset } = {}
) {
  const requirements = (Array.isArray(paymentRequirements)
    ? paymentRequirements
    : [paymentRequirements]
  ).filter(Boolean);
  if (requirements.length === 0) {
    return null;
  }

  const preferred = String(assetSymbol || "").toUpperCase();
  if (preferred) {
    const match = requirements.find(
      (requirement) =>
        String(requirement?.extra?.assetSymbol || "").toUpperCase() === preferred
    );
    if (match) {
      return match;
    }
  }

  return requirements[0];
}

export function matchPaymentRequirement(paymentRequirements, paymentHeaderPayload) {
  const requirements = (Array.isArray(paymentRequirements)
    ? paymentRequirements
    : [paymentRequirements]
  ).filter(Boolean);
  const { paymentPayload, paymentRequirement } = unwrapPaymentHeader(
    paymentHeaderPayload
  );
  const authorization =
    paymentPayload?.payload?.authorization || paymentPayload?.authorization || {};
  const payloadChainIndex = String(
    paymentRequirement?.chainIndex ||
      paymentPayload?.chainIndex ||
      authorization?.chainIndex ||
      ""
  );
  const payloadAsset = normalizeAddress(
    paymentRequirement?.asset || authorization?.asset || paymentPayload?.asset
  );
  const payloadAssetSymbol = String(
    paymentRequirement?.assetSymbol || ""
  ).toUpperCase();
  const payloadTo = normalizeAddress(authorization?.to);
  const payloadPayTo = normalizeAddress(paymentRequirement?.payTo);
  const payloadResource = String(
    paymentRequirement?.resource || authorization?.resource || ""
  );
  const payloadRequestHash = String(
    paymentRequirement?.requestHash || authorization?.requestHash || ""
  );
  const payloadValue =
    paymentRequirement?.maxAmountRequired || authorization?.value;

  return (
    requirements.find((requirement) => {
      if (
        payloadChainIndex &&
        String(requirement?.chainIndex || "") !== payloadChainIndex
      ) {
        return false;
      }
      if (
        payloadAsset &&
        normalizeAddress(requirement?.asset) !== payloadAsset
      ) {
        return false;
      }
      if (
        payloadAssetSymbol &&
        String(requirement?.extra?.assetSymbol || "").toUpperCase() !==
          payloadAssetSymbol
      ) {
        return false;
      }
      if (
        payloadTo &&
        normalizeAddress(requirement?.payTo) !== payloadTo
      ) {
        return false;
      }
      if (
        payloadPayTo &&
        normalizeAddress(requirement?.payTo) !== payloadPayTo
      ) {
        return false;
      }
      if (
        payloadResource &&
        String(requirement?.resource || "") !== payloadResource
      ) {
        return false;
      }
      if (
        payloadRequestHash &&
        String(requirement?.extra?.requestHash || "") !== payloadRequestHash
      ) {
        return false;
      }
      if (
        payloadValue !== undefined &&
        BigInt(String(payloadValue || "0")) <
          BigInt(String(requirement?.maxAmountRequired || "0"))
      ) {
        return false;
      }
      return true;
    }) || null
  );
}

export function describePaymentRequirements(requirement) {
  return `${titleCase(requirement.extra?.skuId || "premium")} for ${requirement.extra?.amountUsd} ${requirement.extra?.assetSymbol} on chain ${requirement.chainIndex}`;
}

export function buildPremiumEnvelopeSchemaForSku(skuId) {
  const sku = getSku(skuId);
  return {
    ...premiumAccessEnvelopeSchema,
    properties: {
      ...premiumAccessEnvelopeSchema.properties,
      skuId: { const: skuId },
      data: sku.resultSchema
    }
  };
}
