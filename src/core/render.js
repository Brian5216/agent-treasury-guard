import { formatToken, formatUsd, titleCase, toNumber } from "./utils.js";

function renderOpportunitiesMarkdown(result) {
  const lines = [
    "# Treasury Guard Opportunity Scan",
    "",
    `- Adapter: ${result.adapter}`,
    `- Tier: ${titleCase(result.machineView?.tier || "free")}`,
    `- Chain: ${result.input.chain}`,
    `- Risk profile: ${result.input.riskProfile}`,
    `- Budget: ${formatUsd(result.input.budgetUsd)}`,
    ""
  ];

  result.opportunities.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.symbol} (${titleCase(item.chain)})`);
    lines.push(`- Opportunity score: ${item.opportunityScore}/100`);
    lines.push(`- Risk: ${titleCase(item.risk.label)} (${item.risk.score}/100)`);
    lines.push(`- Price: ${formatUsd(item.priceUsd)}`);
    lines.push(`- Liquidity: ${formatUsd(item.liquidityUsd)}`);
    lines.push(`- Signal: ${item.signal.walletType} ${formatUsd(item.signal.amountUsd)}`);
    lines.push(`- Summary: ${item.summary}`);
    if (item.risk.warnings.length > 0) {
      lines.push(`- Warning: ${item.risk.warnings.join(" ")}`);
    }
    lines.push("");
  });

  if (result.machineView?.nextCalls) {
    lines.push("## Next Paid Calls");
    if (result.machineView.nextCalls.premiumTradePlan) {
      lines.push("- Premium trade plan: validate one candidate and turn it into a guarded entry plan.");
    }
    if (result.machineView.nextCalls.premiumThesisPlan) {
      lines.push("- Premium thesis plan: bring your own thesis and let Treasury Guard validate, route, and monitor it.");
    }
    lines.push("");
  }

  lines.push("```json");
  lines.push(JSON.stringify(result.machineView, null, 2));
  lines.push("```");
  return lines.join("\n");
}

function renderTradeMarkdown(result) {
  const title =
    result.kind === "exit-plan"
      ? "Treasury Guard Exit Plan"
      : result.kind === "thesis-plan"
        ? "Treasury Guard BYO Thesis Plan"
        : "Treasury Guard Trade Plan";
  const lines = [
    `# ${title}`,
    "",
    `- Adapter: ${result.adapter}`,
    `- Provider: ${result.provider.name} (${titleCase(result.provider.kind)})`,
    `- Decision: ${titleCase(result.execution.decision)}`,
    `- Decision note: ${result.execution.summary}`,
    `- Asset: ${result.asset.symbol} on ${titleCase(result.asset.chain)}`,
    `- Side: ${titleCase(result.input.side)}`,
    `- Risk profile: ${titleCase(result.input.riskProfile)}`,
    `- Risk: ${titleCase(result.risk.label)} (${result.risk.score}/100)`,
    `- Opportunity score: ${result.research.opportunityScore}/100`,
    `- Budget: ${formatUsd(result.input.budgetUsd)}`,
    `- Quote: ${formatToken(result.execution.quote.expectedOutput, result.execution.quote.toSymbol)} for ${formatUsd(result.execution.quote.inputUsd)}`,
    `- Price impact: ${toNumber(result.execution.quote.priceImpactPercent).toFixed(2)}%`,
    `- Route: ${result.execution.quote.routeSummary}`,
    `- Gas estimate: ${formatUsd(result.execution.quote.gasUsd)}`,
    ""
  ];

  if (result.commercialTerms) {
    lines.push("## Revenue Model");
    lines.push(`- Model: ${titleCase(result.commercialTerms.model)}`);
    lines.push(
      `- Split: platform ${result.commercialTerms.platformTakeRateBps / 100}% / provider ${result.commercialTerms.providerPayoutBps / 100}%`
    );
    lines.push(`- Settlement: ${titleCase(result.commercialTerms.settlementMode)}`);
    lines.push(`- Summary: ${result.commercialTerms.summary}`);
    lines.push("");
  }

  if (result.research.rationale.length > 0) {
    lines.push("## Why This Plan");
    result.research.rationale.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (result.thesis) {
    lines.push("## BYO Thesis Review");
    lines.push(`- Source: ${result.thesis.source}`);
    lines.push(`- Verdict: ${titleCase(result.thesis.verdict)}`);
    lines.push(`- Operational verdict: ${titleCase(result.thesis.operationalVerdict)}`);
    lines.push(`- Review: ${result.thesis.reviewSummary}`);
    if (result.thesis.bullets?.length > 0) {
      result.thesis.bullets.forEach((item) => lines.push(`- Claim: ${item}`));
    }
    result.thesis.evidenceFor.forEach((item) => lines.push(`- Supports: ${item}`));
    result.thesis.evidenceAgainst.forEach((item) => lines.push(`- Pushback: ${item}`));
    lines.push("");
  }

  if (result.policy) {
    lines.push("## Treasury Policy");
    lines.push(`- Status: ${titleCase(result.policy.status)}`);
    lines.push(`- Summary: ${result.policy.summary}`);
    result.policy.checks
      .filter((item) => item.status !== "pass")
      .forEach((item) => lines.push(`- ${titleCase(item.status)}: ${item.label} - ${item.summary}`));
    lines.push("");
  }

  if (result.risk.warnings.length > 0) {
    lines.push("## Risk Flags");
    result.risk.warnings.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (result.execution.clips?.length > 0) {
    lines.push(result.kind === "exit-plan" ? "## Exit Clips" : "## Entry Clips");
    result.execution.clips.forEach((clip) => {
      lines.push(`- ${clip.label}: ${clip.percent}% - ${clip.reason}`);
    });
    lines.push("");
  }

  lines.push("## Execution Steps");
  result.execution.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push("");

  if (result.watch) {
    lines.push("## Watch Plan");
    lines.push(`- Summary: ${result.watch.summary}`);
    lines.push(`- Next review: ${result.watch.nextReviewMinutes} minutes`);
    result.watch.triggers.forEach((item) => {
      lines.push(`- Trigger ${item.signal}: ${item.action} at ${item.threshold} (${item.reason})`);
    });
    lines.push("");
  }

  lines.push("```json");
  lines.push(JSON.stringify(result.machineView, null, 2));
  lines.push("```");
  return lines.join("\n");
}

function renderTrackingMarkdown(result) {
  const lines = [
    "# Treasury Guard Execution Status",
    "",
    `- Adapter: ${result.adapter}`,
    `- Chain: ${result.chain}`,
    `- Order ID: ${result.orderId}`,
    `- Tx hash: ${result.txHash}`,
    `- Status: ${titleCase(result.status)}`,
    `- Updated at: ${result.updatedAt}`
  ];

  if (result.failReason) {
    lines.push(`- Failure reason: ${result.failReason}`);
  }

  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(result.machineView, null, 2));
  lines.push("```");
  return lines.join("\n");
}

export function renderResult(result, format) {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  switch (result.kind) {
    case "opportunities":
      return renderOpportunitiesMarkdown(result);
    case "trade-plan":
    case "exit-plan":
    case "thesis-plan":
      return renderTradeMarkdown(result);
    case "execution-status":
      return renderTrackingMarkdown(result);
    default:
      return JSON.stringify(result, null, 2);
  }
}
