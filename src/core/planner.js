import {
  CHAIN_DEFAULTS,
  DEFAULTS,
  MARKETPLACE_DEFAULTS,
  POLICY_PROFILES,
  STATUS_LABELS
} from "./constants.js";
import { decideAction, evaluateRisk, scoreOpportunity } from "./risk.js";
import {
  clamp,
  formatUsd,
  fromMinimalUnits,
  nowIso,
  titleCase,
  toMinimalUnits,
  toNumber,
  uniqueBy
} from "./utils.js";

function quoteRouteSummary(quote) {
  const route = quote?.dexRouterList || [];
  if (route.length === 0) {
    return quote?.router || "OKX smart route";
  }

  const names = [];
  for (const item of route) {
    const name = item.dexName || "OKX route";
    if (!names.includes(name)) {
      names.push(name);
    }
  }

  const summary = names.slice(0, 3).join(" + ");
  if (names.length <= 3) {
    return summary;
  }

  return `${summary} + ${names.length - 3} more`;
}

function buildRationale({ side, priceInfo, holders, signal, quote }) {
  const rationale = [];
  const change1H = toNumber(priceInfo?.priceChange1H);
  const buyPressure = toNumber(holders?.whaleBuy1HUsd) - toNumber(holders?.whaleSell1HUsd);

  if (side === "buy" && change1H > 0) {
    rationale.push(`1h momentum is positive at ${change1H.toFixed(2)}%.`);
  }
  if (side === "sell" && change1H < 0) {
    rationale.push(`1h momentum has rolled over to ${change1H.toFixed(2)}%.`);
  }
  if (buyPressure > 0) {
    rationale.push(`Net whale flow is supportive by ${formatUsd(buyPressure)} in the last hour.`);
  } else if (buyPressure < 0) {
    rationale.push(`Net whale flow is negative by ${formatUsd(Math.abs(buyPressure))} in the last hour.`);
  }
  if (signal) {
    rationale.push(
      `${signal.walletType} wallets triggered ${signal.triggerWalletCount} fresh buys totaling ${formatUsd(signal.amountUsd)}.`
    );
  }
  if (quote) {
    rationale.push(
      `Current route price impact is ${toNumber(quote.priceImpactPercent).toFixed(2)}%, with gas near ${formatUsd(quote.gasUsd)}.`
    );
  }

  return rationale;
}

function normalizeToken(raw) {
  return {
    ...raw,
    symbol: raw.tokenSymbol,
    name: raw.tokenName,
    address: raw.tokenContractAddress,
    chain: raw.chain,
    decimals: Number(raw.decimal),
    tagList: {
      communityRecognized: Boolean(raw.communityRecognized ?? raw.tagList?.communityRecognized)
    }
  };
}

async function resolveToken(adapter, { symbol, address, chain }) {
  if (address) {
    const matches = await adapter.searchTokens({ query: address, chain });
    if (matches.length === 0) {
      throw new Error(`Token not found for address ${address} on ${chain}`);
    }
    return normalizeToken(matches[0]);
  }

  if (!symbol) {
    throw new Error("Missing --symbol or --address");
  }

  const matches = await adapter.searchTokens({ query: symbol, chain });
  if (matches.length === 0) {
    throw new Error(`Token ${symbol} not found on ${chain}`);
  }
  return normalizeToken(matches[0]);
}

async function resolveStableToken(adapter, { stable, chain }) {
  const matches = await adapter.searchTokens({ query: stable, chain });
  if (matches.length === 0) {
    throw new Error(`Stable token ${stable} not found on ${chain}`);
  }
  return normalizeToken(matches[0]);
}

function buildExecutionSteps({ side, chain, needsApproval, decision, walletAddress }) {
  const steps = ["Review the route, price impact, and risk flags."];

  if (decision === "block") {
    steps.push("Stop here. Do not request a transaction.");
    return steps;
  }

  if (decision === "reduce-size") {
    steps.push("Cut the requested size down to the policy-approved starter clip before quoting.");
  }

  if (decision === "manual-exit") {
    steps.push("Escalate to manual supervision before broadcasting any exit transaction.");
  }

  if (side === "buy") {
    steps.push("Generate swap calldata through OKX swap.");
  } else if (needsApproval) {
    steps.push("Generate approval calldata for the sell token.");
    steps.push("Broadcast approval via OKX gateway.");
    steps.push("Generate sell swap calldata through OKX swap.");
  } else {
    steps.push("Generate sell swap calldata through OKX swap.");
  }

  if (walletAddress) {
    steps.push("Simulate or broadcast through OKX gateway with the signed transaction.");
    steps.push("Track the order status until finality.");
  } else {
    steps.push("Return calldata to the caller for signing and broadcast.");
  }

  return steps;
}

function numberOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMetric(value) {
  return Math.round(Number(value) * 100) / 100;
}

function roundPriceValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 0;
  }
  const precision = Math.min(
    8,
    Math.max(2, Math.ceil(-Math.log10(Math.abs(numeric))) + 2)
  );
  return Number(numeric.toFixed(precision));
}

function parseCsvOption(value, fallback = []) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parseListOption(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusRank(status) {
  switch (status) {
    case "block":
      return 3;
    case "review":
      return 2;
    case "pass":
      return 1;
    default:
      return 0;
  }
}

function buildPolicyCheck({ id, label, status, actual, threshold, summary }) {
  return {
    id,
    label,
    status,
    actual,
    threshold,
    summary
  };
}

function buildThesisInput(options) {
  const summary = String(
    options.thesis ||
      options.thesisSummary ||
      options.hypothesis ||
      options.memo ||
      ""
  ).trim();
  const bullets = parseListOption(
    options.thesisBullets || options.thesisPoints || options.rationalePoints
  );
  const confidenceRaw =
    options.thesisConfidence ?? options.confidence ?? options.conviction ?? "";
  const horizonRaw =
    options.thesisHorizonMinutes ??
    options.horizonMinutes ??
    options.timeHorizonMinutes ??
    "";
  const confidence =
    confidenceRaw === ""
      ? null
      : clamp(Number(confidenceRaw), 0, 100);
  const horizonMinutes =
    horizonRaw === "" ? null : Math.max(1, Number(horizonRaw));

  if (!summary && bullets.length === 0) {
    return null;
  }

  return {
    mode: "byo-thesis",
    source: String(
      options.thesisSource ||
        options.sourceAgent ||
        options.sourceModel ||
        "external-ai"
    ).trim(),
    summary: summary || bullets[0],
    confidence: Number.isFinite(confidence) ? confidence : null,
    horizonMinutes: Number.isFinite(horizonMinutes) ? horizonMinutes : null,
    bullets
  };
}

function slugifyId(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function buildProviderProfile({ options, workflow, thesisInput }) {
  const explicitKind = String(options.providerKind || "").trim().toLowerCase();
  const explicitId = String(options.providerId || "").trim();
  const explicitName = String(options.providerName || "").trim();
  const sourceLabel = thesisInput?.source || explicitName || explicitId || "external-ai";
  const hasProviderIdentity =
    Boolean(explicitId) ||
    Boolean(explicitName) ||
    Boolean(options.providerPayoutAddress) ||
    Boolean(options.providerUrl);
  const hasPayoutAddress = Boolean(String(options.providerPayoutAddress || "").trim());
  let kind = "house";
  if (workflow === "thesis") {
    if (explicitKind === "house") {
      kind = "house";
    } else if (explicitKind === "external") {
      kind = hasPayoutAddress ? "external" : "caller";
    } else if (explicitKind === "caller") {
      kind = "caller";
    } else {
      kind = hasProviderIdentity ? (hasPayoutAddress ? "external" : "caller") : "caller";
    }
  }
  const payoutAddress =
    kind === "external" ? String(options.providerPayoutAddress || "").trim() || null : null;
  const thesisOrigin =
    workflow === "thesis"
      ? kind === "external"
        ? "provider-thesis"
        : "caller-thesis"
      : "house-research";

  return {
    id:
      kind === "house"
        ? MARKETPLACE_DEFAULTS.houseProviderId
        : explicitId ||
          slugifyId(
            sourceLabel,
            kind === "external" ? "external-provider" : "caller-thesis"
          ),
    name:
      kind === "house"
        ? MARKETPLACE_DEFAULTS.houseProviderName
        : explicitName || sourceLabel,
    kind,
    thesisOrigin,
    payoutAddress,
    profileUrl: String(options.providerUrl || "").trim() || null
  };
}

export function buildCommercialTerms(provider) {
  if (provider.kind === "house") {
    return {
      model: "house-direct",
      providerProgram: MARKETPLACE_DEFAULTS.providerProgram,
      settlementMode: "platform-owned",
      platformTakeRateBps: 10000,
      providerPayoutBps: 0,
      providerEligibleForPayout: false,
      summary: "House research is monetized directly by Treasury Guard."
    };
  }

  if (provider.kind === "external" && provider.payoutAddress) {
    const platformTakeRateBps = MARKETPLACE_DEFAULTS.platformTakeRateBps;
    const providerPayoutBps = Math.max(0, 10000 - platformTakeRateBps);

    return {
      model: "platform-split",
      providerProgram: MARKETPLACE_DEFAULTS.providerProgram,
      settlementMode: MARKETPLACE_DEFAULTS.settlementMode,
      platformTakeRateBps,
      providerPayoutBps,
      providerEligibleForPayout: true,
      summary: `Treasury Guard keeps ${platformTakeRateBps / 100}% and routes ${
        providerPayoutBps / 100
      }% to the approved provider ledger.`
    };
  }

  return {
    model: "guard-service",
    providerProgram: MARKETPLACE_DEFAULTS.providerProgram,
    settlementMode: "platform-owned",
    platformTakeRateBps: 10000,
    providerPayoutBps: 0,
    providerEligibleForPayout: false,
    summary:
      "The caller supplied the thesis, but Treasury Guard monetizes the guarded validation workflow directly until an approved provider payout profile is attached."
  };
}

function buildThesisReview({
  side,
  thesis,
  token,
  signal,
  priceInfo,
  holders,
  quote,
  risk,
  policy,
  executionDecision
}) {
  if (!thesis) {
    return null;
  }

  const evidenceFor = [];
  const evidenceAgainst = [];
  const change1H = toNumber(priceInfo?.priceChange1H);
  const whaleDelta =
    toNumber(holders?.whaleBuy1HUsd) - toNumber(holders?.whaleSell1HUsd);
  const holderConcentration = roundMetric(toNumber(holders?.top10HolderPercent));
  const priceImpact = roundMetric(toNumber(quote?.priceImpactPercent));
  const liquidityUsd = roundMetric(toNumber(priceInfo?.liquidity));
  const signalAmount = toNumber(signal?.amountUsd);
  const soldRatio = roundMetric(toNumber(signal?.soldRatioPercent));

  if (side === "buy") {
    if (change1H >= 0.75) {
      evidenceFor.push(`1h momentum is positive at ${change1H.toFixed(2)}%.`);
    } else if (change1H <= -1.5) {
      evidenceAgainst.push(`1h momentum is negative at ${change1H.toFixed(2)}%.`);
    }

    if (whaleDelta > 0) {
      evidenceFor.push(`Net whale flow is positive by ${formatUsd(whaleDelta)}.`);
    } else if (whaleDelta < 0) {
      evidenceAgainst.push(`Net whale flow is negative by ${formatUsd(Math.abs(whaleDelta))}.`);
    }

    if (signalAmount > 0 && soldRatio < 30) {
      evidenceFor.push(
        `${titleCase(signal?.walletType || "signal")} wallets are still net buyers.`
      );
    } else if (soldRatio >= 30) {
      evidenceAgainst.push(`Signal wallets already sold ${soldRatio}% of the move.`);
    }

    if (policy.status === "pass") {
      evidenceFor.push("Treasury policy allows the entry without mandate breaches.");
    } else if (policy.status === "review") {
      evidenceAgainst.push("Treasury policy requires a smaller starter clip or more confirmation.");
    } else {
      evidenceAgainst.push("Treasury policy blocks this entry.");
    }
  } else {
    if (change1H <= -0.75) {
      evidenceFor.push(`1h momentum has weakened to ${change1H.toFixed(2)}%.`);
    } else if (change1H >= 1.5) {
      evidenceAgainst.push(`1h momentum is still positive at ${change1H.toFixed(2)}%.`);
    }

    if (whaleDelta < 0) {
      evidenceFor.push(`Net whale flow is negative by ${formatUsd(Math.abs(whaleDelta))}.`);
    } else if (whaleDelta > 0) {
      evidenceAgainst.push(`Net whale flow remains supportive by ${formatUsd(whaleDelta)}.`);
    }

    if (risk.score >= 50) {
      evidenceFor.push(`Risk is elevated at ${risk.score}/100, which supports de-risking.`);
    } else {
      evidenceAgainst.push(`Risk is only ${risk.score}/100, so urgency is limited.`);
    }

    if (policy.status === "block") {
      evidenceAgainst.push("Treasury policy requires manual supervision for this exit.");
    } else if (policy.status === "review") {
      evidenceFor.push("Treasury policy supports a staged reduction with supervision.");
    } else {
      evidenceFor.push("Treasury policy allows the exit workflow.");
    }
  }

  if (priceImpact <= policy.mandate.maxPriceImpactPercent) {
    evidenceFor.push(`Route impact at ${priceImpact}% is inside mandate.`);
  } else {
    evidenceAgainst.push(`Route impact at ${priceImpact}% is above mandate.`);
  }

  if (liquidityUsd >= policy.mandate.minLiquidityUsd) {
    evidenceFor.push(`Liquidity at ${formatUsd(liquidityUsd)} is workable.`);
  } else {
    evidenceAgainst.push(`Liquidity at ${formatUsd(liquidityUsd)} is below the preferred floor.`);
  }

  if (holderConcentration > policy.mandate.maxHolderConcentrationPercent) {
    evidenceAgainst.push(`Top holders control ${holderConcentration}% of supply.`);
  }

  const netScore = evidenceFor.length - evidenceAgainst.length;
  const verdict =
    policy.status === "block" && side === "buy"
      ? "rejected"
      : netScore >= 2 && evidenceAgainst.length <= 1
        ? "aligned"
        : netScore >= 0
          ? "mixed"
          : "weak";

  const operationalVerdict =
    executionDecision.decision === "proceed" || executionDecision.decision === "de-risk-fast"
      ? "ready"
      : ["reduce-size", "trim"].includes(executionDecision.decision)
        ? "guarded"
        : ["watch", "hold"].includes(executionDecision.decision)
          ? "watch-only"
          : "manual-only";

  const reviewSummary =
    verdict === "aligned"
      ? "The external thesis is supported by live data and can be operationalized inside Treasury Guard."
      : verdict === "mixed"
        ? "The external thesis is directionally plausible, but policy or live conditions require tighter guardrails."
        : verdict === "weak"
          ? "Live data only partially supports the external thesis, so this should stay small or remain on watch."
          : "The external thesis does not clear the current treasury mandate.";

  return {
    ...thesis,
    evidenceFor,
    evidenceAgainst,
    verdict,
    operationalVerdict,
    reviewSummary,
    token: {
      symbol: token.symbol,
      chain: token.chain || token.network || token.address
    }
  };
}

function getPolicyProfile(riskProfile) {
  return POLICY_PROFILES[riskProfile] || POLICY_PROFILES.balanced;
}

function buildTreasuryPolicy({
  side,
  chain,
  riskProfile,
  budgetUsd,
  options,
  token,
  risk,
  quote,
  holders,
  priceInfo
}) {
  const profile = getPolicyProfile(riskProfile);
  const walletSizeUsd = Math.max(1, numberOption(options.walletSizeUsd, 10000));
  const tradeNotionalUsd = Math.max(
    0,
    numberOption(options.positionUsd, budgetUsd)
  );
  const currentAssetExposureUsd = Math.max(
    0,
    numberOption(
      options.currentAssetExposureUsd,
      side === "sell" ? tradeNotionalUsd : 0
    )
  );
  const postTradeAssetExposureUsd =
    side === "buy"
      ? currentAssetExposureUsd + tradeNotionalUsd
      : Math.max(0, currentAssetExposureUsd - tradeNotionalUsd);
  const allowedChains = parseCsvOption(
    options.allowedChains,
    Object.keys(CHAIN_DEFAULTS)
  );
  const tradePercent = roundMetric((tradeNotionalUsd / walletSizeUsd) * 100);
  const assetExposurePercent = roundMetric(
    (postTradeAssetExposureUsd / walletSizeUsd) * 100
  );
  const holderConcentration = roundMetric(toNumber(holders?.top10HolderPercent));
  const liquidityUsd = roundMetric(toNumber(priceInfo?.liquidity));
  const priceImpactPercent = roundMetric(toNumber(quote?.priceImpactPercent));
  const maxTaxPercent = numberOption(
    options.maxTaxPercent,
    profile.maxTaxPercent
  );
  const taxPercent = roundMetric(
    Math.max(
      toNumber(quote?.fromToken?.taxRate),
      toNumber(quote?.toToken?.taxRate)
    )
  );
  const hasHoneypot =
    Boolean(quote?.fromToken?.isHoneyPot) || Boolean(quote?.toToken?.isHoneyPot);
  const contractFlags = holders?.contractRiskFlags || [];
  const checks = [];

  checks.push(
    buildPolicyCheck({
      id: "chain_scope",
      label: "Chain Scope",
      status: allowedChains.includes(chain) ? "pass" : side === "buy" ? "block" : "review",
      actual: chain,
      threshold: allowedChains,
      summary: allowedChains.includes(chain)
        ? `${chain} is inside the treasury mandate.`
        : side === "buy"
          ? `${chain} is outside the treasury mandate for new entries.`
          : `${chain} is outside the preferred mandate, so exits should be supervised.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "position_size",
      label: "Position Size",
      status:
        side === "sell"
          ? "pass"
          : tradePercent > profile.maxTradePercent * 1.25
            ? "block"
            : tradePercent > profile.maxTradePercent
              ? "review"
              : "pass",
      actual: tradePercent,
      threshold: profile.maxTradePercent,
      summary:
        side === "sell"
          ? "This action reduces exposure rather than adding new size."
          : tradePercent > profile.maxTradePercent * 1.25
            ? `Requested size uses ${tradePercent}% of treasury, which breaches the mandate.`
            : tradePercent > profile.maxTradePercent
              ? `Requested size uses ${tradePercent}% of treasury, so a smaller starter clip is safer.`
              : `Requested size uses ${tradePercent}% of treasury and stays inside the mandate.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "asset_exposure",
      label: "Asset Exposure",
      status:
        side === "sell"
          ? "pass"
          : assetExposurePercent > profile.maxAssetExposurePercent * 1.25
            ? "block"
            : assetExposurePercent > profile.maxAssetExposurePercent
              ? "review"
              : "pass",
      actual: assetExposurePercent,
      threshold: profile.maxAssetExposurePercent,
      summary:
        side === "sell"
          ? `Post-exit exposure falls to ${assetExposurePercent}% of treasury.`
          : assetExposurePercent > profile.maxAssetExposurePercent * 1.25
            ? `Post-trade exposure would rise to ${assetExposurePercent}% and breach concentration rules.`
            : assetExposurePercent > profile.maxAssetExposurePercent
              ? `Post-trade exposure would reach ${assetExposurePercent}%, so entry size should be reduced.`
              : `Post-trade exposure remains at ${assetExposurePercent}% and is acceptable.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "risk_score",
      label: "Risk Score",
      status:
        risk.score > profile.maxRiskScore + 12
          ? side === "buy"
            ? "block"
            : "review"
          : risk.score > profile.maxRiskScore
            ? "review"
            : "pass",
      actual: risk.score,
      threshold: profile.maxRiskScore,
      summary:
        risk.score > profile.maxRiskScore + 12
          ? `Risk score ${risk.score} is materially outside mandate tolerance.`
          : risk.score > profile.maxRiskScore
            ? `Risk score ${risk.score} is above the treasury comfort zone.`
            : `Risk score ${risk.score} is inside the treasury mandate.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "price_impact",
      label: "Price Impact",
      status:
        priceImpactPercent > profile.maxPriceImpactPercent + 1.5
          ? side === "buy"
            ? "block"
            : "review"
          : priceImpactPercent > profile.maxPriceImpactPercent
            ? "review"
            : "pass",
      actual: priceImpactPercent,
      threshold: profile.maxPriceImpactPercent,
      summary:
        priceImpactPercent > profile.maxPriceImpactPercent + 1.5
          ? `Quote impact at ${priceImpactPercent}% is too high for unattended execution.`
          : priceImpactPercent > profile.maxPriceImpactPercent
            ? `Quote impact at ${priceImpactPercent}% suggests smaller clips or more patience.`
            : `Quote impact at ${priceImpactPercent}% is acceptable.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "holder_concentration",
      label: "Holder Concentration",
      status:
        holderConcentration > profile.maxHolderConcentrationPercent + 8
          ? side === "buy"
            ? "block"
            : "review"
          : holderConcentration > profile.maxHolderConcentrationPercent
            ? "review"
            : "pass",
      actual: holderConcentration,
      threshold: profile.maxHolderConcentrationPercent,
      summary:
        holderConcentration > profile.maxHolderConcentrationPercent + 8
          ? `Top holders control ${holderConcentration}% of supply, which is too concentrated.`
          : holderConcentration > profile.maxHolderConcentrationPercent
            ? `Top holders control ${holderConcentration}% of supply, so position size should stay conservative.`
            : `Holder concentration at ${holderConcentration}% is acceptable.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "liquidity_floor",
      label: "Liquidity Floor",
      status:
        liquidityUsd < profile.minLiquidityUsd * 0.6
          ? side === "buy"
            ? "block"
            : "review"
          : liquidityUsd < profile.minLiquidityUsd
            ? "review"
            : "pass",
      actual: liquidityUsd,
      threshold: profile.minLiquidityUsd,
      summary:
        liquidityUsd < profile.minLiquidityUsd * 0.6
          ? `Liquidity at ${formatUsd(liquidityUsd)} is too thin for this workflow.`
          : liquidityUsd < profile.minLiquidityUsd
            ? `Liquidity at ${formatUsd(liquidityUsd)} is below the preferred floor.`
            : `Liquidity at ${formatUsd(liquidityUsd)} supports the requested size.`
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "contract_safety",
      label: "Contract Safety",
      status:
        hasHoneypot
          ? "block"
          : taxPercent > maxTaxPercent + 1 || contractFlags.length >= 2
            ? "block"
            : taxPercent > maxTaxPercent || contractFlags.length > 0
              ? "review"
              : "pass",
      actual: {
        taxPercent,
        contractFlags
      },
      threshold: {
        maxTaxPercent
      },
      summary:
        hasHoneypot
          ? "Honeypot risk is present. Do not automate this trade."
          : taxPercent > maxTaxPercent + 1 || contractFlags.length >= 2
            ? "Tax or contract flags are too severe for treasury automation."
            : taxPercent > maxTaxPercent || contractFlags.length > 0
              ? "Tax or contract flags require manual review before execution."
              : "No material contract-level blockers detected."
    })
  );

  checks.push(
    buildPolicyCheck({
      id: "recognition",
      label: "Token Recognition",
      status: token?.tagList?.communityRecognized ? "pass" : side === "buy" ? "review" : "pass",
      actual: Boolean(token?.tagList?.communityRecognized),
      threshold: true,
      summary: token?.tagList?.communityRecognized
        ? "Token is recognized by the current token metadata."
        : side === "buy"
          ? "Token is not strongly recognized, so new entries need extra caution."
          : "Recognition is weak, but this action reduces exposure."
    })
  );

  const status = checks.reduce(
    (worst, check) =>
      statusRank(check.status) > statusRank(worst) ? check.status : worst,
    "pass"
  );

  return {
    status,
    summary:
      status === "pass"
        ? "Treasury policy passes. The workflow stays inside mandate."
        : status === "review"
          ? side === "buy"
            ? "Treasury policy is mixed. Size should be reduced or watched before entry."
            : "Treasury policy is mixed. Exit can proceed, but it should be staged and monitored."
          : side === "buy"
            ? "Treasury policy blocks this entry."
            : "Treasury policy requires manual handling for this exit.",
    walletSizeUsd,
    currentAssetExposureUsd,
    postTradeAssetExposureUsd,
    mandate: {
      maxTradePercent: profile.maxTradePercent,
      maxAssetExposurePercent: profile.maxAssetExposurePercent,
      maxRiskScore: profile.maxRiskScore,
      maxPriceImpactPercent: profile.maxPriceImpactPercent,
      maxHolderConcentrationPercent: profile.maxHolderConcentrationPercent,
      minLiquidityUsd: profile.minLiquidityUsd,
      stopLossPercent: profile.stopLossPercent,
      takeProfitPercent: profile.takeProfitPercent
    },
    checks
  };
}

function mergeActionWithPolicy({ side, action, policy }) {
  if (side === "buy") {
    if (policy.status === "block") {
      return {
        decision: "block",
        summary: "Treasury policy blocked the entry. Fix the mandate violations before executing."
      };
    }
    if (policy.status === "review") {
      return {
        decision: action.decision === "block" ? "block" : "reduce-size",
        summary:
          "The setup is interesting, but treasury policy requires a smaller starter clip or more confirmation."
      };
    }
    return action;
  }

  if (policy.status === "block" && action.decision === "hold") {
    return {
      decision: "manual-exit",
      summary: "Exit conditions require manual supervision because policy and execution checks are stretched."
    };
  }

  if (policy.status === "review" && action.decision === "hold") {
    return {
      decision: "trim",
      summary: "No panic exit is needed, but treasury policy prefers a staged reduction."
    };
  }

  return action;
}

function buildExecutionClips({ side, decision }) {
  if (side === "buy") {
    if (decision === "proceed") {
      return [
        {
          label: "Starter clip",
          percent: 60,
          reason: "Enter with most of the target size while the setup is inside mandate."
        },
        {
          label: "Confirmation clip",
          percent: 40,
          reason: "Add the remainder only if the first review remains green."
        }
      ];
    }

    if (["reduce-size", "watch"].includes(decision)) {
      return [
        {
          label: "Probe clip",
          percent: 25,
          reason: "Only deploy a small probe until the policy review items clear."
        }
      ];
    }

    return [];
  }

  if (decision === "de-risk-fast") {
    return [
      {
        label: "Immediate risk-off clip",
        percent: 60,
        reason: "Reduce exposure before liquidity or whale flow deteriorates further."
      },
      {
        label: "Follow-through exit",
        percent: 40,
        reason: "Finish the exit on the next review if stress remains elevated."
      }
    ];
  }

  if (["trim", "manual-exit"].includes(decision)) {
    return [
      {
        label: "First trim",
        percent: 35,
        reason: "Reduce exposure without forcing the entire position through one route."
      },
      {
        label: "Second trim",
        percent: 35,
        reason: "Continue the exit if risk triggers remain active at the next checkpoint."
      }
    ];
  }

  return [];
}

function buildWatchPlan({
  side,
  riskProfile,
  budgetUsd,
  token,
  priceInfo,
  holders,
  quote,
  policy,
  risk
}) {
  const profile = getPolicyProfile(riskProfile);
  const currentPrice = toNumber(priceInfo?.price);
  const currentLiquidity = toNumber(priceInfo?.liquidity);
  const currentImpact = toNumber(quote?.priceImpactPercent);
  const stopLossPrice = roundPriceValue(
    currentPrice * (1 - profile.stopLossPercent / 100)
  );
  const takeProfitPrice = roundPriceValue(
    currentPrice * (1 + profile.takeProfitPercent / 100)
  );
  const liquidityFloor = roundMetric(
    Math.max(policy.mandate.minLiquidityUsd, currentLiquidity * 0.6)
  );
  const reviewBase = profile.nextReviewMinutes;
  const buyWhaleFloor = -Math.max(100000, budgetUsd * 100);
  const sellWhaleFloor = -Math.max(75000, budgetUsd * 80);
  const triggers =
    side === "buy"
      ? [
          {
            signal: "price_usd_below",
            threshold: stopLossPrice,
            action: "exit-full",
            reason: "Hard stop-loss to keep the treasury inside risk budget."
          },
          {
            signal: "price_usd_above",
            threshold: takeProfitPrice,
            action: "trim-25",
            reason: "Lock in gains once the first take-profit level is reached."
          },
          {
            signal: "net_whale_flow_usd_below",
            threshold: buyWhaleFloor,
            action: "trim-50",
            reason: "Smart money reversal is an early sign to reduce exposure."
          },
          {
            signal: "liquidity_usd_below",
            threshold: liquidityFloor,
            action: "exit-fast",
            reason: "Liquidity deterioration increases slippage and treasury risk."
          },
          {
            signal: "risk_score_above",
            threshold: Math.min(100, policy.mandate.maxRiskScore + 10),
            action: "de-risk",
            reason: "Risk score moved outside the treasury comfort zone."
          }
        ]
      : [
          {
            signal: "price_impact_percent_above",
            threshold: roundMetric(currentImpact + 1),
            action: "slice-order-smaller",
            reason: "Worse impact means the remaining exit should use smaller clips."
          },
          {
            signal: "net_whale_flow_usd_below",
            threshold: sellWhaleFloor,
            action: "sell-next-25",
            reason: "Further whale selling argues for completing more of the exit."
          },
          {
            signal: "liquidity_usd_below",
            threshold: liquidityFloor,
            action: "finish-exit",
            reason: "If liquidity thins out, finish the exit before conditions worsen."
          },
          {
            signal: "risk_score_above",
            threshold: Math.min(100, policy.mandate.maxRiskScore + 5),
            action: "finish-exit",
            reason: "Risk remains too high to keep the position unattended."
          }
        ];

  return {
    summary:
      side === "buy"
        ? `Review ${token.symbol} again in ${reviewBase}m unless one of the stop-loss, liquidity, or whale-flow triggers fires first.`
        : `Review the remaining ${token.symbol} exposure in ${reviewBase}m and use the triggers to decide whether to finish the exit.`,
    nextReviewMinutes: reviewBase,
    checkpoints: [
      {
        label: "Fast review",
        minutes: reviewBase,
        goal:
          side === "buy"
            ? "Confirm that price impact, liquidity, and whale flow still support the entry."
            : "Check whether the first exit clip reduced risk without blowing out impact."
      },
      {
        label: "Trend review",
        minutes: reviewBase * 4,
        goal:
          side === "buy"
            ? "Decide whether to add, hold, or stop the idea."
            : "Decide whether to finish the exit or keep only a small runner."
      },
      {
        label: "Session review",
        minutes: reviewBase * 8,
        goal:
          side === "buy"
            ? "Reset stops and take-profit thresholds if the thesis is still alive."
            : "Clear any remaining exposure if conditions have not improved."
      }
    ],
    triggers
  };
}

export async function findOpportunities(adapter, options) {
  const chain = String(options.chain || DEFAULTS.chain).toLowerCase();
  const limit = Math.max(1, Number(options.limit || 3));
  const budgetUsd = Number(options.budgetUsd || 1000);
  const walletTypes = String(options.walletTypes || DEFAULTS.walletTypes);
  const signalList = await adapter.listSignals({
    chain,
    walletTypes,
    minAmountUsd: Number(options.minSignalUsd || DEFAULTS.minSignalUsd)
  });

  const uniqueSignals = uniqueBy(signalList, (item) => `${item.chain}:${item.token.tokenAddress}`)
    .slice(0, Math.max(limit * 2, 6));

  const opportunities = [];
  for (const signal of uniqueSignals) {
    const token = await resolveToken(adapter, {
      address: signal.token.tokenAddress,
      chain
    });
    const [priceInfo, holders, stable] = await Promise.all([
      adapter.getPriceInfo({ address: token.address, chain }),
      adapter.getHolderStats({ address: token.address, chain }),
      resolveStableToken(adapter, { stable: options.stable, chain })
    ]);
    const quote = await adapter.getQuote({
      chain,
      fromToken: stable,
      toToken: token,
      amount: toMinimalUnits(String(budgetUsd), stable.decimals),
      side: "buy",
      walletAddress: options.walletAddress
    });
    const risk = evaluateRisk({
      side: "buy",
      priceInfo,
      holders,
      signal,
      quote,
      token
    });
    const opportunityScore = scoreOpportunity({
      token,
      priceInfo,
      holders,
      signal,
      risk
    });

    opportunities.push({
      symbol: token.symbol,
      name: token.name,
      chain,
      address: token.address,
      priceUsd: toNumber(priceInfo.price),
      liquidityUsd: toNumber(priceInfo.liquidity),
      risk,
      signal: {
        walletType: signal.walletType,
        amountUsd: toNumber(signal.amountUsd)
      },
      opportunityScore,
      summary:
        opportunityScore >= 70
          ? "Strong candidate for a guarded entry."
          : "Worth watching, but size should stay disciplined."
    });
  }

  opportunities.sort((left, right) => right.opportunityScore - left.opportunityScore);

  return {
    kind: "opportunities",
    adapter: adapter.name,
    generatedAt: nowIso(),
    input: {
      chain,
      budgetUsd,
      riskProfile: options.riskProfile
    },
    opportunities: opportunities.slice(0, limit),
    machineView: {
      intent: "find_opportunities",
      chain,
      budgetUsd,
      tier: "free",
      results: opportunities.slice(0, limit).map((item) => ({
        symbol: item.symbol,
        chain: item.chain,
        address: item.address,
        opportunityScore: item.opportunityScore,
        riskScore: item.risk.score
      })),
      nextCalls: {
        premiumTradePlan: {
          path: "/premium/trade-plan",
          method: "POST",
          bodyTemplate: {
            side: "buy",
            symbol: opportunities[0]?.symbol || "<symbol>",
            chain,
            budgetUsd,
            riskProfile: options.riskProfile || DEFAULTS.riskProfile
          }
        },
        premiumThesisPlan: {
          path: "/premium/thesis-plan",
          method: "POST",
          bodyTemplate: {
            side: "buy",
            symbol: opportunities[0]?.symbol || "<symbol>",
            chain,
            budgetUsd,
            riskProfile: options.riskProfile || DEFAULTS.riskProfile,
            thesis: "<external thesis summary>",
            thesisSource: "<source model>",
            providerId: "<provider-id>",
            providerName: "<provider-name>",
            providerPayoutAddress: "<provider-payout-address>"
          }
        }
      }
    }
  };
}

async function preparePlan(adapter, options, forcedSide, workflow = "direct") {
  const chain = String(options.chain || DEFAULTS.chain).toLowerCase();
  const side = String(forcedSide || options.side || "buy").toLowerCase();
  const riskProfile = String(options.riskProfile || DEFAULTS.riskProfile).toLowerCase();
  const budgetUsd = Number(options.budgetUsd || 1000);
  const thesisInput = buildThesisInput(options);
  const provider = buildProviderProfile({
    options,
    workflow,
    thesisInput
  });
  const commercialTerms = buildCommercialTerms(provider);

  if (workflow === "thesis" && !thesisInput) {
    throw new Error("Missing thesis input. Provide --thesis or thesis bullets for BYO-thesis mode.");
  }

  const token = await resolveToken(adapter, {
    symbol: options.symbol,
    address: options.address,
    chain
  });
  const stable = await resolveStableToken(adapter, {
    stable: options.stable,
    chain
  });

  const [priceInfo, holders, signalList] = await Promise.all([
    adapter.getPriceInfo({ address: token.address, chain }),
    adapter.getHolderStats({ address: token.address, chain }),
    adapter.listSignals({
      chain,
      tokenAddress: token.address,
      walletTypes: options.walletTypes || DEFAULTS.walletTypes,
      minAmountUsd: Number(options.minSignalUsd || DEFAULTS.minSignalUsd)
    })
  ]);
  const signal = signalList[0] || null;

  const fromToken = side === "buy" ? stable : token;
  const toToken = side === "buy" ? token : stable;
  const amountBase =
    side === "buy"
      ? toMinimalUnits(String(budgetUsd), fromToken.decimals)
      : toMinimalUnits(String(budgetUsd / Math.max(toNumber(priceInfo.price), 0.000001)), fromToken.decimals);

  const quote = await adapter.getQuote({
    chain,
    fromToken,
    toToken,
    amount: amountBase,
    side,
    walletAddress: options.walletAddress
  });
  const risk = evaluateRisk({
    side,
    priceInfo,
    holders,
    signal,
    quote,
    token
  });
  const opportunityScore = scoreOpportunity({
    token,
    priceInfo,
    holders,
    signal,
    risk
  });
  const action = decideAction({
    side,
    risk,
    quote,
    riskProfile
  });
  const policy = buildTreasuryPolicy({
    side,
    chain,
    riskProfile,
    budgetUsd,
    options,
    token,
    risk,
    quote,
    holders,
    priceInfo
  });
  const executionDecision = mergeActionWithPolicy({
    side,
    action,
    policy
  });
  const thesisReview = buildThesisReview({
    side,
    thesis: thesisInput,
    token,
    signal,
    priceInfo,
    holders,
    quote,
    risk,
    policy,
    executionDecision
  });
  const watch = buildWatchPlan({
    side,
    riskProfile,
    budgetUsd,
    token,
    priceInfo,
    holders,
    quote,
    policy,
    risk
  });

  const expectedOutput = fromMinimalUnits(
    side === "buy" ? quote.toTokenAmount : quote.toTokenAmount,
    toToken.decimals
  );
  const inputAmountUi = fromMinimalUnits(quote.fromTokenAmount, fromToken.decimals);
  const chainDefaults = CHAIN_DEFAULTS[chain];
  const needsApproval = side === "sell" && !token.native && chain !== "solana";
  const kind =
    workflow === "thesis"
      ? "thesis-plan"
      : side === "sell"
        ? "exit-plan"
        : "trade-plan";
  const intent =
    workflow === "thesis"
      ? "validate_thesis_and_prepare_plan"
      : side === "sell"
        ? "prepare_exit_plan"
        : "check_risk_and_prepare_trade";
  const clips = buildExecutionClips({
    side,
    decision: executionDecision.decision
  });

  const result = {
    kind,
    adapter: adapter.name,
    generatedAt: nowIso(),
    input: {
      chain,
      side,
      riskProfile,
      budgetUsd,
      walletAddress: options.walletAddress || null
    },
    asset: {
      symbol: token.symbol,
      name: token.name,
      chain,
      address: token.address
    },
    research: {
      opportunityScore,
      rationale: buildRationale({
        side,
        priceInfo,
        holders,
        signal,
        quote
      })
    },
    provider,
    commercialTerms,
    risk,
    policy,
    execution: {
      decision: executionDecision.decision,
      summary: executionDecision.summary,
      quote: {
        inputAmount: inputAmountUi,
        inputUsd: budgetUsd,
        expectedOutput,
        toSymbol: toToken.symbol,
        gasUsd: toNumber(quote.gasUsd ?? chainDefaults?.gasUsd),
        priceImpactPercent: toNumber(quote.priceImpactPercent),
        routeSummary: quoteRouteSummary(quote)
      },
      clips,
      steps: buildExecutionSteps({
        side,
        chain,
        needsApproval,
        decision: executionDecision.decision,
        walletAddress: options.walletAddress
      })
    },
    watch,
    machineView: {
      intent,
      side,
      chain,
      riskProfile,
      decision: executionDecision.decision,
      provider: {
        id: provider.id,
        kind: provider.kind
      },
      commercialTerms: {
        model: commercialTerms.model,
        platformTakeRateBps: commercialTerms.platformTakeRateBps,
        providerPayoutBps: commercialTerms.providerPayoutBps
      },
      token: {
        symbol: token.symbol,
        address: token.address,
        chain,
        decimals: token.decimals
      },
      fromToken: {
        symbol: fromToken.symbol,
        address: fromToken.address,
        decimals: fromToken.decimals
      },
      toToken: {
        symbol: toToken.symbol,
        address: toToken.address,
        decimals: toToken.decimals
      },
      policy: {
        status: policy.status,
        summary: policy.summary,
        failingChecks: policy.checks
          .filter((item) => ["review", "block"].includes(item.status))
          .map((item) => ({
            id: item.id,
            status: item.status,
            summary: item.summary
          }))
      },
      watch: {
        nextReviewMinutes: watch.nextReviewMinutes,
        triggers: watch.triggers.map((item) => ({
          signal: item.signal,
          action: item.action,
          threshold: item.threshold
        }))
      },
      quote: {
        fromTokenAmount: quote.fromTokenAmount,
        toTokenAmount: quote.toTokenAmount,
        priceImpactPercent: quote.priceImpactPercent,
        gasUsd: quote.gasUsd ?? chainDefaults?.gasUsd,
        route: quote.dexRouterList || []
      },
      nextCalls: {
        quote: {
          command: "onchainos swap quote",
          args: [
            "--from",
            fromToken.address,
            "--to",
            toToken.address,
            "--amount",
            amountBase,
            "--chain",
            chain
          ]
        },
        swap: {
          command: "onchainos swap swap",
          args: [
            "--from",
            fromToken.address,
            "--to",
            toToken.address,
            "--amount",
            amountBase,
            "--chain",
            chain,
            "--wallet",
            options.walletAddress || "<wallet>"
          ]
        },
        gateway: {
          command: "onchainos gateway orders",
          args: [
            "--address",
            options.walletAddress || "<wallet>",
            "--chain",
            chain
          ]
        }
      }
    }
  };

  if (thesisReview) {
    result.thesis = thesisReview;
    result.machineView.thesis = {
      source: thesisReview.source,
      summary: thesisReview.summary,
      confidence: thesisReview.confidence,
      verdict: thesisReview.verdict,
      operationalVerdict: thesisReview.operationalVerdict
    };
  }

  return result;
}

export async function prepareTradePlan(adapter, options) {
  return preparePlan(adapter, options);
}

export async function prepareExitPlan(adapter, options) {
  return preparePlan(adapter, options, "sell");
}

export async function prepareThesisPlan(adapter, options) {
  return preparePlan(adapter, options, options.side || "buy", "thesis");
}

export async function trackExecution(adapter, options) {
  const chain = String(options.chain || DEFAULTS.chain).toLowerCase();
  const tracking = await adapter.getTransactionStatus({
    chain,
    address: options.address,
    orderId: options.orderId,
    txHash: options.txHash
  });
  const order = tracking.orders?.[0] || tracking;
  const status = STATUS_LABELS[String(order.txStatus)] || "unknown";

  return {
    kind: "execution-status",
    adapter: adapter.name,
    generatedAt: nowIso(),
    chain,
    orderId: order.orderId,
    txHash: order.txHash,
    status,
    failReason: order.failReason || "",
    updatedAt: new Date(Number(order.updatedAt || Date.now())).toISOString(),
    machineView: {
      intent: "track_execution_status",
      chain,
      orderId: order.orderId,
      txHash: order.txHash,
      status
    }
  };
}
