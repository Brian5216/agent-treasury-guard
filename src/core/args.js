import { DEFAULTS } from "./constants.js";

function toCamelCase(flag) {
  return flag.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function parseArgs(argv) {
  const [, , command = "help", ...rest] = argv;
  const options = {};
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    const key = toCamelCase(current.slice(2));
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    command,
    positionals,
    options: {
      adapter: DEFAULTS.adapter,
      chain: DEFAULTS.chain,
      stable: DEFAULTS.stable,
      riskProfile: DEFAULTS.riskProfile,
      walletTypes: DEFAULTS.walletTypes,
      minSignalUsd: DEFAULTS.minSignalUsd,
      limit: 3,
      format: "markdown",
      side: "buy",
      budgetUsd: 1000,
      ...options
    }
  };
}

export function helpText() {
  return `Agent Treasury Guard

Usage:
  node src/cli.js find-opportunities [--chain base] [--budget-usd 1000] [--format json|markdown]
  node src/cli.js prepare-trade --side buy|sell --symbol BRETT --chain base [--budget-usd 1000] [--risk-profile balanced]
  node src/cli.js prepare-exit-plan --symbol BRETT --chain base [--budget-usd 1000] [--risk-profile balanced]
  node src/cli.js prepare-thesis-plan --side buy|sell --symbol BRETT --chain base --thesis "why this should work"
  node src/cli.js track-execution --chain base --order-id demo-order-1 [--address 0x...]

Environment:
  TREASURY_GUARD_ADAPTER=mock|onchainos-cli|okx-http
  ONCHAINOS_BIN=onchainos`;
}
