import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CHAIN_DEFAULTS } from "../core/constants.js";

const execFileAsync = promisify(execFile);

function extractJson(stdout) {
  const trimmed = stdout.trim();
  const direct = [trimmed];
  const jsonStart = Math.min(
    ...["[", "{"]
      .map((token) => trimmed.indexOf(token))
      .filter((index) => index >= 0)
  );

  if (Number.isFinite(jsonStart) && jsonStart >= 0) {
    direct.push(trimmed.slice(jsonStart));
  }

  for (const candidate of direct) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to parse JSON from onchainos output:\n${stdout}`);
}

async function runOnchainos(args) {
  const bin = process.env.ONCHAINOS_BIN || "onchainos";
  const { stdout, stderr } = await execFileAsync(bin, args, {
    maxBuffer: 10 * 1024 * 1024
  });
  if (stderr?.trim()) {
    const maybeJson = stderr.trim();
    if (maybeJson.startsWith("{") || maybeJson.startsWith("[")) {
      return extractJson(maybeJson);
    }
  }
  return extractJson(stdout);
}

export class OnchainosCliAdapter {
  constructor() {
    this.name = "onchainos-cli";
  }

  async searchTokens({ query, chain }) {
    return runOnchainos(["token", "search", query, "--chains", chain]);
  }

  async getPriceInfo({ address, chain }) {
    return runOnchainos(["token", "price-info", address, "--chain", chain]);
  }

  async getHolderStats({ address, chain }) {
    return runOnchainos(["token", "holders", address, "--chain", chain]);
  }

  async listSignals({ chain, walletTypes, minAmountUsd, tokenAddress }) {
    const args = ["market", "signal-list", chain];
    if (walletTypes) {
      args.push("--wallet-type", String(walletTypes));
    }
    if (minAmountUsd) {
      args.push("--min-amount-usd", String(minAmountUsd));
    }
    if (tokenAddress) {
      args.push("--token-address", tokenAddress);
    }
    return runOnchainos(args);
  }

  async getQuote({ chain, fromToken, toToken, amount }) {
    const response = await runOnchainos([
      "swap",
      "quote",
      "--from",
      fromToken.address,
      "--to",
      toToken.address,
      "--amount",
      String(amount),
      "--chain",
      chain
    ]);

    return {
      ...response,
      gasUsd: Number(response.estimateGasFee || CHAIN_DEFAULTS[chain]?.gasUsd || 0)
    };
  }

  async getTransactionStatus({ chain, address, orderId }) {
    const args = ["gateway", "orders", "--address", address || "<wallet>", "--chain", chain];
    if (orderId) {
      args.push("--order-id", orderId);
    }
    return runOnchainos(args);
  }
}
