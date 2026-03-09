import crypto from "node:crypto";
import { CHAIN_DEFAULTS } from "../core/constants.js";
import { toNumber } from "../core/utils.js";

const BASE_URL = process.env.OKX_BASE_URL || "https://web3.okx.com";
const MAX_RETRIES = Number(process.env.OKX_HTTP_MAX_RETRIES || "4");
const RETRY_BASE_MS = Number(process.env.OKX_HTTP_RETRY_BASE_MS || "1200");

function chainToChainIndex(chain) {
  const chainIndex = CHAIN_DEFAULTS[String(chain).toLowerCase()]?.chainIndex;
  if (!chainIndex) {
    throw new Error(`Unsupported chain for OKX HTTP adapter: ${chain}`);
  }
  return String(chainIndex);
}

function chainIndexToChain(chainIndex) {
  const match = Object.entries(CHAIN_DEFAULTS).find(
    ([, value]) => String(value.chainIndex) === String(chainIndex)
  );
  return match?.[0] || null;
}

function normalizeAddress(address) {
  if (!address) {
    return address;
  }
  return String(address).startsWith("0x") ? String(address).toLowerCase() : String(address);
}

function sign(timestamp, method, pathWithQuery, body = "") {
  const secret = process.env.OKX_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing OKX_SECRET_KEY for live OKX HTTP adapter calls.");
  }

  const prehash = `${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`;
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64");
}

function buildHeaders({ method, pathWithQuery, bodyText }) {
  const apiKey = process.env.OKX_API_KEY;
  const passphrase = process.env.OKX_API_PASSPHRASE;
  const projectId = process.env.OKX_PROJECT_ID;

  if (!apiKey || !passphrase) {
    throw new Error("Missing OKX credentials for live OKX HTTP adapter calls.");
  }

  const timestamp = new Date().toISOString();
  const headers = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-SIGN": sign(timestamp, method, pathWithQuery, bodyText)
  };
  if (projectId) {
    headers["OK-ACCESS-PROJECT"] = projectId;
  }
  return headers;
}

async function request(method, path, { query, body } = {}) {
  const queryString = query
    ? new URLSearchParams(
        Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")
      ).toString()
    : "";
  const pathWithQuery = queryString ? `${path}?${queryString}` : path;
  const bodyText = body ? JSON.stringify(body) : "";
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${BASE_URL}${pathWithQuery}`, {
      method,
      headers: buildHeaders({ method, pathWithQuery, bodyText }),
      body: bodyText || undefined
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const shouldRetry =
      response.status === 429 ||
      response.status >= 500 ||
      payload?.code === "50011" ||
      /too many requests/i.test(payload?.msg || payload?.message || text);

    if (response.ok && payload?.code === "0") {
      return payload.data || [];
    }

    lastError = new Error(
      payload?.msg ||
        payload?.message ||
        (text ? text.slice(0, 200) : `OKX HTTP request failed: ${response.status}`)
    );

    if (!shouldRetry || attempt === MAX_RETRIES - 1) {
      throw lastError;
    }

    const delayMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : RETRY_BASE_MS * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw lastError;
}

function normalizeTopHolders(items, circSupply) {
  const top10Amount = items
    .slice(0, 10)
    .reduce((sum, item) => sum + toNumber(item?.holdAmount), 0);
  const top10HolderPercent =
    circSupply > 0 ? Number(((top10Amount / circSupply) * 100).toFixed(2)) : null;
  const contractRiskFlags = [];
  if (top10HolderPercent !== null && top10HolderPercent >= 35) {
    contractRiskFlags.push("holder concentration");
  }

  return {
    top10HolderPercent,
    contractRiskFlags
  };
}

function normalizeDexRoute(route = []) {
  return route
    .map((item) => ({
      dexName: item?.dexProtocol?.dexName || item?.dexName || "OKX route",
      percentage:
        item?.dexProtocol?.percent ||
        item?.percent ||
        item?.routerPercent ||
        "100"
    }))
    .filter((item) => item.dexName);
}

export class OkxHttpAdapter {
  constructor() {
    this.name = "okx-http";
    this.priceInfoCache = new Map();
  }

  async searchTokens({ query, chain }) {
    const chainIndex = chainToChainIndex(chain);
    const items = await request("GET", "/api/v6/dex/market/token/search", {
      query: {
        chains: chainIndex,
        search: query
      }
    });

    return items.map((item) => ({
      ...item,
      chain: chainIndexToChain(item.chainIndex) || String(chain).toLowerCase()
    }));
  }

  async getPriceInfo({ address, chain }) {
    const chainIndex = chainToChainIndex(chain);
    const cacheKey = `${chainIndex}:${normalizeAddress(address)}`;
    if (this.priceInfoCache.has(cacheKey)) {
      return this.priceInfoCache.get(cacheKey);
    }

    const items = await request("POST", "/api/v6/dex/market/price-info", {
      body: [
        {
          chainIndex,
          tokenContractAddress: normalizeAddress(address)
        }
      ]
    });
    const item = items[0];
    if (!item) {
      throw new Error(`No live price data for ${address} on ${chain}`);
    }

    const normalized = {
      ...item,
      chain: String(chain).toLowerCase()
    };
    this.priceInfoCache.set(cacheKey, normalized);
    return normalized;
  }

  async getHolderStats({ address, chain }) {
    const chainIndex = chainToChainIndex(chain);
    const [items, priceInfo] = await Promise.all([
      request("GET", "/api/v6/dex/market/token/holder", {
        query: {
          chainIndex,
          tokenContractAddress: normalizeAddress(address)
        }
      }),
      this.getPriceInfo({ address, chain })
    ]);
    const circSupply = toNumber(priceInfo?.circSupply);
    const { top10HolderPercent, contractRiskFlags } = normalizeTopHolders(
      items,
      circSupply
    );

    return {
      chain: String(chain).toLowerCase(),
      tokenContractAddress: normalizeAddress(address),
      top10HolderPercent: top10HolderPercent ?? 0,
      whaleBuy1HUsd: 0,
      whaleSell1HUsd: 0,
      contractRiskFlags,
      topHolders: items
    };
  }

  async listSignals({ chain, minAmountUsd = 0, tokenAddress }) {
    const chainIndex = chainToChainIndex(chain);
    const items = await request("GET", "/api/v6/dex/market/token/toplist", {
      query: {
        chains: chainIndex,
        sortBy: "5",
        timeFrame: "2"
      }
    });

    return items
      .filter(
        (item) =>
          !tokenAddress ||
          normalizeAddress(item.tokenContractAddress) === normalizeAddress(tokenAddress)
      )
      .filter((item) => toNumber(item.volume) >= toNumber(minAmountUsd))
      .slice(0, tokenAddress ? 5 : 20)
      .map((item, index) => ({
        chain: String(chain).toLowerCase(),
        walletType: "TOPLIST_VOLUME_1H",
        triggerWalletCount: Math.max(1, Number(item.uniqueTraders || item.txs || 1)),
        amountUsd: String(item.volume || "0"),
        timestamp: item.firstTradeTime || String(Date.now() - index),
        token: {
          tokenAddress: normalizeAddress(item.tokenContractAddress),
          tokenSymbol: item.tokenSymbol
        },
        metadata: {
          change: item.change,
          txsBuy: item.txsBuy,
          txsSell: item.txsSell,
          uniqueTraders: item.uniqueTraders
        }
      }));
  }

  async getQuote({ chain, fromToken, toToken, amount, walletAddress }) {
    const chainIndex = chainToChainIndex(chain);
    const items = await request("GET", "/api/v6/dex/aggregator/quote", {
      query: {
        chainIndex,
        amount: String(amount),
        swapMode: "exactIn",
        fromTokenAddress: normalizeAddress(fromToken.address),
        toTokenAddress: normalizeAddress(toToken.address),
        userWalletAddress: walletAddress || undefined
      }
    });
    const item = items[0];
    if (!item) {
      throw new Error(`No live OKX quote for ${fromToken.symbol}/${toToken.symbol} on ${chain}`);
    }

    return {
      ...item,
      gasUsd: toNumber(item.tradeFee),
      priceImpactPercent: String(Math.max(0, toNumber(item.priceImpactPercent))),
      dexRouterList: normalizeDexRoute(item.dexRouterList),
      fromToken: item.fromToken || {
        decimal: String(fromToken.decimals),
        tokenUnitPrice: String(fromToken.price || "0"),
        isHoneyPot: false,
        taxRate: "0"
      },
      toToken: item.toToken || {
        decimal: String(toToken.decimals),
        tokenUnitPrice: String(toToken.price || "0"),
        isHoneyPot: false,
        taxRate: "0"
      }
    };
  }

  async getTransactionStatus() {
    throw new Error(
      "Transaction tracking is not yet supported in the okx-http adapter. Use mock or onchainos-cli for tracking."
    );
  }
}
