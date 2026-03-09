import { RISK_PROFILES } from "./constants.js";
import { clamp, inverseScale, scale, toNumber } from "./utils.js";

function riskLabel(score) {
  if (score >= 75) {
    return "critical";
  }
  if (score >= 60) {
    return "high";
  }
  if (score >= 40) {
    return "moderate";
  }
  return "low";
}

export function evaluateRisk({ side, priceInfo, holders, signal, quote, token }) {
  const concentration = scale(toNumber(holders?.top10HolderPercent), 8, 50) * 28;
  const volatility = scale(Math.abs(toNumber(priceInfo?.priceChange1H)), 0, 12) * 18;
  const liquidity = inverseScale(toNumber(priceInfo?.liquidity), 500000, 25000000) * 20;
  const sellPressure = scale(
    toNumber(holders?.whaleSell1HUsd) - toNumber(holders?.whaleBuy1HUsd),
    -250000,
    250000
  ) * 14;
  const execution = scale(toNumber(quote?.priceImpactPercent), 0, 8) * 20;
  const soldRatio = scale(toNumber(signal?.soldRatioPercent), 0, 50) * 10;
  const taxRisk =
    Math.max(
      toNumber(quote?.fromToken?.taxRate),
      toNumber(quote?.toToken?.taxRate)
    ) > 0
      ? 15
      : 0;
  const honeypotRisk =
    quote?.fromToken?.isHoneyPot || quote?.toToken?.isHoneyPot ? 100 : 0;
  const contractFlags = (holders?.contractRiskFlags || []).length * 8;
  const recognitionPenalty = token?.tagList?.communityRecognized ? 0 : 10;

  const rawScore =
    concentration +
    volatility +
    liquidity +
    sellPressure +
    execution +
    soldRatio +
    taxRisk +
    contractFlags +
    recognitionPenalty;

  const score = clamp(Math.round(Math.max(rawScore, honeypotRisk)), 0, 100);
  const warnings = [];

  if (toNumber(holders?.top10HolderPercent) >= 35) {
    warnings.push("Top holders control too much supply.");
  }
  if (toNumber(priceInfo?.liquidity) < 1000000) {
    warnings.push("Liquidity is thin for the target size.");
  }
  if (toNumber(quote?.priceImpactPercent) >= 3) {
    warnings.push("Quote shows elevated price impact.");
  }
  if (toNumber(signal?.soldRatioPercent) >= 30) {
    warnings.push("Signal wallets have already sold a large share.");
  }
  if ((holders?.contractRiskFlags || []).length > 0) {
    warnings.push(...holders.contractRiskFlags.map((flag) => `Flagged: ${flag}.`));
  }
  if (quote?.fromToken?.isHoneyPot || quote?.toToken?.isHoneyPot) {
    warnings.push("Honeypot risk detected. Do not execute.");
  }

  const label = riskLabel(score);
  const profile = RISK_PROFILES[side === "sell" ? "aggressive" : "balanced"];

  return {
    score,
    label,
    warnings,
    thresholds: profile
  };
}

export function scoreOpportunity({ token, priceInfo, holders, signal, risk }) {
  const momentum = scale(toNumber(priceInfo?.priceChange1H), -8, 8) * 22;
  const volumeQuality = scale(
    toNumber(priceInfo?.volume1H) / Math.max(toNumber(priceInfo?.liquidity), 1),
    0.02,
    0.4
  ) * 18;
  const whaleSupport = scale(
    toNumber(holders?.whaleBuy1HUsd) - toNumber(holders?.whaleSell1HUsd),
    -250000,
    300000
  ) * 20;
  const signalStrength =
    scale(toNumber(signal?.amountUsd), 10000, 500000) * 20 +
    scale(toNumber(signal?.triggerWalletCount), 1, 8) * 10;
  const recognition = token?.tagList?.communityRecognized ? 5 : 0;
  const safety = (100 - risk.score) * 0.25;

  return clamp(
    Math.round(momentum + volumeQuality + whaleSupport + signalStrength + recognition + safety),
    0,
    100
  );
}

export function decideAction({ side, risk, quote, riskProfile }) {
  const profile = RISK_PROFILES[riskProfile] || RISK_PROFILES.balanced;
  const priceImpact = toNumber(quote?.priceImpactPercent);

  if (risk.warnings.some((warning) => warning.includes("Honeypot"))) {
    return {
      decision: "block",
      summary: "Do not execute. Safety checks failed."
    };
  }

  if (side === "buy") {
    if (risk.score > profile.maxRisk || priceImpact > profile.maxPriceImpact) {
      return {
        decision: "watch",
        summary: "Hold for now. Monitor or reduce size before entering."
      };
    }

    return {
      decision: "proceed",
      summary: "Setup is within the selected risk profile."
    };
  }

  if (risk.score >= 70 || priceImpact >= 4) {
    return {
      decision: "de-risk-fast",
      summary: "Risk is elevated. Exit quickly or split into smaller clips."
    };
  }

  if (risk.score >= 50) {
    return {
      decision: "trim",
      summary: "Risk is rising. Consider partial exit."
    };
  }

  return {
    decision: "hold",
    summary: "No urgent exit pressure from the current data."
  };
}
