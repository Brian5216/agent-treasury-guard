export const opportunityResultSchema = {
  type: "object",
  required: ["kind", "adapter", "generatedAt", "input", "opportunities", "machineView"],
  properties: {
    kind: { const: "opportunities" },
    adapter: { type: "string" },
    generatedAt: { type: "string" },
    input: {
      type: "object",
      required: ["chain", "budgetUsd", "riskProfile"],
      properties: {
        chain: { type: "string" },
        budgetUsd: { type: "number" },
        riskProfile: { type: "string" }
      }
    },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        required: ["symbol", "chain", "address", "risk", "opportunityScore", "summary"],
        properties: {
          symbol: { type: "string" },
          name: { type: "string" },
          chain: { type: "string" },
          address: { type: "string" },
          priceUsd: { type: "number" },
          liquidityUsd: { type: "number" },
          opportunityScore: { type: "number" },
          summary: { type: "string" },
          signal: {
            type: "object",
            properties: {
              walletType: { type: "string" },
              amountUsd: { type: "number" }
            }
          },
          risk: {
            type: "object",
            required: ["score", "label", "warnings"],
            properties: {
              score: { type: "number" },
              label: { type: "string" },
              warnings: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    },
    machineView: {
      type: "object",
      required: ["intent", "chain", "budgetUsd", "results"],
      properties: {
        intent: { const: "find_opportunities" },
        chain: { type: "string" },
        budgetUsd: { type: "number" },
        tier: { type: "string" },
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["symbol", "chain", "address", "opportunityScore", "riskScore"],
            properties: {
              symbol: { type: "string" },
              chain: { type: "string" },
              address: { type: "string" },
              opportunityScore: { type: "number" },
              riskScore: { type: "number" }
            }
          }
        },
        nextCalls: { type: "object" }
      }
    }
  }
};

const policySchema = {
  type: "object",
  required: ["status", "summary", "walletSizeUsd", "mandate", "checks"],
  properties: {
    status: { type: "string" },
    summary: { type: "string" },
    walletSizeUsd: { type: "number" },
    currentAssetExposureUsd: { type: "number" },
    postTradeAssetExposureUsd: { type: "number" },
    mandate: {
      type: "object",
      required: [
        "maxTradePercent",
        "maxAssetExposurePercent",
        "maxRiskScore",
        "maxPriceImpactPercent",
        "maxHolderConcentrationPercent",
        "minLiquidityUsd"
      ],
      properties: {
        maxTradePercent: { type: "number" },
        maxAssetExposurePercent: { type: "number" },
        maxRiskScore: { type: "number" },
        maxPriceImpactPercent: { type: "number" },
        maxHolderConcentrationPercent: { type: "number" },
        minLiquidityUsd: { type: "number" },
        stopLossPercent: { type: "number" },
        takeProfitPercent: { type: "number" }
      }
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "label", "status", "summary"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          status: { type: "string" },
          actual: {},
          threshold: {},
          summary: { type: "string" }
        }
      }
    }
  }
};

const watchSchema = {
  type: "object",
  required: ["summary", "nextReviewMinutes", "checkpoints", "triggers"],
  properties: {
    summary: { type: "string" },
    nextReviewMinutes: { type: "number" },
    checkpoints: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "minutes", "goal"],
        properties: {
          label: { type: "string" },
          minutes: { type: "number" },
          goal: { type: "string" }
        }
      }
    },
    triggers: {
      type: "array",
      items: {
        type: "object",
        required: ["signal", "threshold", "action", "reason"],
        properties: {
          signal: { type: "string" },
          threshold: {},
          action: { type: "string" },
          reason: { type: "string" }
        }
      }
    }
  }
};

const thesisReviewSchema = {
  type: "object",
  required: [
    "mode",
    "source",
    "summary",
    "confidence",
    "verdict",
    "operationalVerdict",
    "reviewSummary",
    "evidenceFor",
    "evidenceAgainst"
  ],
  properties: {
    mode: { type: "string" },
    source: { type: "string" },
    summary: { type: "string" },
    confidence: { type: ["number", "null"] },
    horizonMinutes: { type: ["number", "null"] },
    bullets: { type: "array", items: { type: "string" } },
    verdict: { type: "string" },
    operationalVerdict: { type: "string" },
    reviewSummary: { type: "string" },
    evidenceFor: { type: "array", items: { type: "string" } },
    evidenceAgainst: { type: "array", items: { type: "string" } }
  }
};

const providerSchema = {
  type: "object",
  required: ["id", "name", "kind", "thesisOrigin", "payoutAddress", "profileUrl"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    kind: { type: "string" },
    thesisOrigin: { type: "string" },
    payoutAddress: { type: ["string", "null"] },
    profileUrl: { type: ["string", "null"] }
  }
};

const commercialTermsSchema = {
  type: "object",
  required: [
    "model",
    "providerProgram",
    "settlementMode",
    "platformTakeRateBps",
    "providerPayoutBps",
    "providerEligibleForPayout",
    "summary"
  ],
  properties: {
    model: { type: "string" },
    providerProgram: { type: "string" },
    settlementMode: { type: "string" },
    platformTakeRateBps: { type: "number" },
    providerPayoutBps: { type: "number" },
    providerEligibleForPayout: { type: "boolean" },
    summary: { type: "string" }
  }
};

function createPlanResultSchema({ kind, intent, requiresThesis = false }) {
  const required = [
    "kind",
    "adapter",
    "generatedAt",
    "input",
    "asset",
    "research",
    "provider",
    "commercialTerms",
    "risk",
    "policy",
    "execution",
    "watch",
    "machineView"
  ];

  if (requiresThesis) {
    required.push("thesis");
  }

  return {
  type: "object",
  required,
  properties: {
    kind: { const: kind },
    adapter: { type: "string" },
    generatedAt: { type: "string" },
    input: {
      type: "object",
      required: ["chain", "side", "riskProfile", "budgetUsd"],
      properties: {
        chain: { type: "string" },
        side: { type: "string" },
        riskProfile: { type: "string" },
        budgetUsd: { type: "number" },
        walletAddress: { type: ["string", "null"] }
      }
    },
    asset: {
      type: "object",
      required: ["symbol", "chain", "address"],
      properties: {
        symbol: { type: "string" },
        name: { type: "string" },
        chain: { type: "string" },
        address: { type: "string" }
      }
    },
    research: {
      type: "object",
      required: ["opportunityScore", "rationale"],
      properties: {
        opportunityScore: { type: "number" },
        rationale: { type: "array", items: { type: "string" } }
      }
    },
    provider: providerSchema,
    commercialTerms: commercialTermsSchema,
    risk: {
      type: "object",
      required: ["score", "label", "warnings"],
      properties: {
        score: { type: "number" },
        label: { type: "string" },
        warnings: { type: "array", items: { type: "string" } }
      }
    },
    policy: policySchema,
    execution: {
      type: "object",
      required: ["decision", "summary", "quote", "steps"],
      properties: {
        decision: { type: "string" },
        summary: { type: "string" },
        steps: { type: "array", items: { type: "string" } },
        clips: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "percent", "reason"],
            properties: {
              label: { type: "string" },
              percent: { type: "number" },
              reason: { type: "string" }
            }
          }
        },
        quote: {
          type: "object",
          required: ["inputUsd", "expectedOutput", "toSymbol", "gasUsd", "priceImpactPercent", "routeSummary"],
          properties: {
            inputAmount: { type: "number" },
            inputUsd: { type: "number" },
            expectedOutput: { type: "number" },
            toSymbol: { type: "string" },
            gasUsd: { type: "number" },
            priceImpactPercent: { type: "number" },
            routeSummary: { type: "string" }
          }
        }
      }
    },
    watch: watchSchema,
    thesis: thesisReviewSchema,
    machineView: {
      type: "object",
      required: [
        "intent",
        "side",
        "chain",
        "riskProfile",
        "decision",
        "provider",
        "commercialTerms",
        "token",
        "fromToken",
        "toToken",
        "policy",
        "watch",
        "quote",
        "nextCalls"
      ],
      properties: {
        intent: { const: intent },
        side: { type: "string" },
        chain: { type: "string" },
        riskProfile: { type: "string" },
        decision: { type: "string" },
        provider: { type: "object" },
        commercialTerms: { type: "object" },
        token: { type: "object" },
        fromToken: { type: "object" },
        toToken: { type: "object" },
        thesis: { type: "object" },
        policy: { type: "object" },
        watch: { type: "object" },
        quote: { type: "object" },
        nextCalls: { type: "object" }
      }
    }
  }
  };
}

export const tradePlanResultSchema = createPlanResultSchema({
  kind: "trade-plan",
  intent: "check_risk_and_prepare_trade"
});

export const exitPlanResultSchema = createPlanResultSchema({
  kind: "exit-plan",
  intent: "prepare_exit_plan"
});

export const thesisPlanResultSchema = createPlanResultSchema({
  kind: "thesis-plan",
  intent: "validate_thesis_and_prepare_plan",
  requiresThesis: true
});

export const premiumAccessEnvelopeSchema = {
  type: "object",
  required: ["kind", "skuId", "payment", "data"],
  properties: {
    kind: { const: "premium-access" },
    skuId: { type: "string" },
    payment: {
      type: "object",
      required: ["verification", "settlement"],
      properties: {
        verification: { type: "object" },
        settlement: { type: "object" }
      }
    },
    data: { type: "object" }
  }
};
