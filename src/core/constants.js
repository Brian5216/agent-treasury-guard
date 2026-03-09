export const CHAIN_DEFAULTS = {
  xlayer: {
    chainIndex: "196",
    nativeSymbol: "OKB",
    nativeAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    gasUsd: 0.01
  },
  base: {
    chainIndex: "8453",
    nativeSymbol: "ETH",
    nativeAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    gasUsd: 0.08
  },
  ethereum: {
    chainIndex: "1",
    nativeSymbol: "ETH",
    nativeAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    gasUsd: 4.2
  },
  solana: {
    chainIndex: "501",
    nativeSymbol: "SOL",
    nativeAddress: "11111111111111111111111111111111",
    gasUsd: 0.01
  }
};

export const DEFAULTS = {
  adapter: process.env.TREASURY_GUARD_ADAPTER || "mock",
  chain: process.env.TREASURY_GUARD_DEFAULT_CHAIN || "xlayer",
  stable: process.env.TREASURY_GUARD_DEFAULT_STABLE || "USDC",
  riskProfile: process.env.TREASURY_GUARD_DEFAULT_RISK_PROFILE || "balanced",
  walletTypes: process.env.TREASURY_GUARD_DEFAULT_WALLET_TYPES || "1,2,3",
  minSignalUsd: Number(process.env.TREASURY_GUARD_MIN_SIGNAL_USD || "5000")
};

export const MARKETPLACE_DEFAULTS = {
  model: process.env.TREASURY_GUARD_MARKETPLACE_MODEL || "hybrid",
  providerProgram: process.env.TREASURY_GUARD_PROVIDER_PROGRAM || "whitelist",
  platformTakeRateBps: Number(process.env.TREASURY_GUARD_PLATFORM_TAKE_RATE_BPS || "2000"),
  houseProviderId: process.env.TREASURY_GUARD_HOUSE_PROVIDER_ID || "house",
  houseProviderName:
    process.env.TREASURY_GUARD_HOUSE_PROVIDER_NAME || "Treasury Guard House",
  settlementMode:
    process.env.TREASURY_GUARD_PROVIDER_SETTLEMENT_MODE || "offchain-ledger"
};

export const RISK_PROFILES = {
  cautious: { maxRisk: 42, maxPriceImpact: 1.5 },
  balanced: { maxRisk: 58, maxPriceImpact: 3 },
  aggressive: { maxRisk: 74, maxPriceImpact: 5 }
};

export const POLICY_PROFILES = {
  cautious: {
    maxTradePercent: 5,
    maxAssetExposurePercent: 12,
    maxRiskScore: 42,
    maxPriceImpactPercent: 1.5,
    maxHolderConcentrationPercent: 30,
    minLiquidityUsd: 1500000,
    maxTaxPercent: 0,
    stopLossPercent: 5,
    takeProfitPercent: 12,
    nextReviewMinutes: 15
  },
  balanced: {
    maxTradePercent: 10,
    maxAssetExposurePercent: 18,
    maxRiskScore: 58,
    maxPriceImpactPercent: 3,
    maxHolderConcentrationPercent: 35,
    minLiquidityUsd: 1000000,
    maxTaxPercent: 1,
    stopLossPercent: 7,
    takeProfitPercent: 18,
    nextReviewMinutes: 30
  },
  aggressive: {
    maxTradePercent: 15,
    maxAssetExposurePercent: 25,
    maxRiskScore: 74,
    maxPriceImpactPercent: 5,
    maxHolderConcentrationPercent: 42,
    minLiquidityUsd: 750000,
    maxTaxPercent: 2,
    stopLossPercent: 10,
    takeProfitPercent: 25,
    nextReviewMinutes: 45
  }
};

export const STATUS_LABELS = {
  "1": "pending",
  "2": "success",
  "3": "failed"
};
