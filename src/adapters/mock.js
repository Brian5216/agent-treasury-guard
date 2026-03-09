import { CHAIN_DEFAULTS } from "../core/constants.js";
import { readJson, toMinimalUnits, toNumber } from "../core/utils.js";

export class MockOkxAdapter {
  constructor() {
    this.name = "mock";
  }

  async load() {
    if (!this.cache) {
      const [tokens, signals, holders, transactions] = await Promise.all([
        readJson("data/mock/tokens.json"),
        readJson("data/mock/signals.json"),
        readJson("data/mock/holders.json"),
        readJson("data/mock/transactions.json")
      ]);
      this.cache = { tokens, signals, holders, transactions };
    }

    return this.cache;
  }

  async searchTokens({ query, chain }) {
    const { tokens } = await this.load();
    const keyword = String(query).toLowerCase();
    return tokens.filter((token) => {
      const chainMatch = !chain || token.chain === chain;
      const tokenMatch =
        token.tokenSymbol.toLowerCase() === keyword ||
        token.tokenName.toLowerCase().includes(keyword) ||
        token.tokenContractAddress.toLowerCase() === keyword;
      return chainMatch && tokenMatch;
    });
  }

  async getPriceInfo({ address, chain }) {
    const { tokens } = await this.load();
    const token = tokens.find(
      (item) => item.chain === chain && item.tokenContractAddress.toLowerCase() === address.toLowerCase()
    );
    if (!token) {
      throw new Error(`No mock price data for ${address} on ${chain}`);
    }
    return token;
  }

  async getHolderStats({ address, chain }) {
    const { holders } = await this.load();
    const holderInfo = holders.find(
      (item) => item.chain === chain && item.tokenContractAddress.toLowerCase() === address.toLowerCase()
    );
    if (!holderInfo) {
      throw new Error(`No mock holder data for ${address} on ${chain}`);
    }
    return holderInfo;
  }

  async listSignals({ chain, walletTypes, minAmountUsd = 0, tokenAddress }) {
    const { signals } = await this.load();
    const allowed = String(walletTypes || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const walletTypeMap = {
      "1": "SMART_MONEY",
      "2": "INFLUENCER",
      "3": "WHALE"
    };
    return signals
      .filter((item) => item.chain === chain)
      .filter((item) => !tokenAddress || item.token.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())
      .filter((item) => toNumber(item.amountUsd) >= toNumber(minAmountUsd))
      .filter((item) => {
        if (allowed.length === 0) {
          return true;
        }
        return allowed.map((value) => walletTypeMap[value] || value).includes(item.walletType);
      })
      .sort((left, right) => Number(right.timestamp) - Number(left.timestamp));
  }

  async getQuote({ chain, fromToken, toToken, amount }) {
    const fromAmountUi = Number(BigInt(amount)) / 10 ** fromToken.decimals;
    const toTokenPrice = toNumber(toToken.price);
    const fromTokenPrice = toNumber(fromToken.price);
    const liquidity = Math.max(toNumber(toToken.liquidity || fromToken.liquidity), 1);
    const notionalUsd = fromAmountUi * fromTokenPrice;
    const priceImpactPercent = Math.max(0.08, Math.min((notionalUsd / liquidity) * 18, 6.5));
    const effectiveUsd = notionalUsd * (1 - priceImpactPercent / 100);
    const toAmountUi = effectiveUsd / Math.max(toTokenPrice, 0.0000001);
    const gasUsd = CHAIN_DEFAULTS[chain]?.gasUsd ?? 0.2;
    const route =
      chain === "base"
        ? [
            { dexName: "Aerodrome", percentage: "65" },
            { dexName: "Uniswap V3", percentage: "35" }
          ]
        : chain === "solana"
          ? [{ dexName: "Jupiter", percentage: "100" }]
          : chain === "xlayer"
            ? [
                { dexName: "XLayer DEX", percentage: "55" },
                { dexName: "CurveNG", percentage: "45" }
              ]
            : [{ dexName: "Uniswap V3", percentage: "100" }];

    return {
      fromTokenAmount: amount,
      toTokenAmount: toMinimalUnits(toAmountUi.toFixed(Math.min(toToken.decimals, 6)), toToken.decimals),
      estimateGasFee: String(gasUsd),
      gasUsd,
      tradeFee: (notionalUsd * 0.001).toFixed(2),
      priceImpactPercent: priceImpactPercent.toFixed(2),
      router: "okx-smart-router",
      dexRouterList: route,
      fromToken: {
        decimal: String(fromToken.decimals),
        tokenUnitPrice: String(fromTokenPrice),
        isHoneyPot: false,
        taxRate: "0"
      },
      toToken: {
        decimal: String(toToken.decimals),
        tokenUnitPrice: String(toTokenPrice),
        isHoneyPot: false,
        taxRate: chain === "ethereum" && toToken.tokenSymbol === "PEPE" ? "1" : "0"
      }
    };
  }

  async getTransactionStatus({ chain, address, orderId, txHash }) {
    const { transactions } = await this.load();
    const orders = transactions.filter((item) => {
      if (chain && item.chain !== chain) {
        return false;
      }
      if (address && item.address.toLowerCase() !== String(address).toLowerCase()) {
        return false;
      }
      if (orderId && item.orderId !== orderId) {
        return false;
      }
      if (txHash && item.txHash !== txHash) {
        return false;
      }
      return true;
    });

    if (orders.length === 0) {
      throw new Error("No mock transaction found for the provided filter.");
    }

    return {
      orders
    };
  }
}
