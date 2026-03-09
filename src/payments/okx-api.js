import crypto from "node:crypto";
import {
  PAYMENT_DEFAULTS,
  X402_PROTOCOL,
  X402_VERSION,
  getKnownAssetsForChainIndex
} from "./catalog.js";
import { humanizePaymentError } from "./errors.js";

const BASE_URL = process.env.OKX_BASE_URL || "https://web3.okx.com";

function getBasePaths() {
  const override = process.env.OKX_PAYMENT_BASE_PATH;
  if (override) {
    return override
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return ["/api/v6/x402", "/api/v6/wallet/payments", "/api/v6/payments"];
}

function sign(timestamp, method, pathWithQuery, body = "") {
  const secret = process.env.OKX_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing OKX_SECRET_KEY for live x402 API calls.");
  }

  const prehash = `${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`;
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64");
}

function firstDataItem(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data[0] || null;
  }
  if (payload?.data && typeof payload.data === "object") {
    return payload.data;
  }
  return null;
}

function extractErrorMessage(payload, fallback) {
  return (
    payload?.msg ||
    payload?.message ||
    firstDataItem(payload)?.errorReason ||
    firstDataItem(payload)?.errorMsg ||
    fallback
  );
}

function extractReason(payload) {
  return firstDataItem(payload)?.invalidReason || firstDataItem(payload)?.errorReason || null;
}

async function performRequest(basePath, method, path, body) {
  const apiKey = process.env.OKX_API_KEY;
  const passphrase = process.env.OKX_API_PASSPHRASE;
  const projectId = process.env.OKX_PROJECT_ID;

  if (!apiKey || !passphrase) {
    throw new Error("Missing OKX credentials for live x402 API calls.");
  }

  const bodyText = body ? JSON.stringify(body) : "";
  const timestamp = new Date().toISOString();
  const requestPath = `${basePath}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-SIGN": sign(timestamp, method, requestPath, bodyText)
  };
  if (projectId) {
    headers["OK-ACCESS-PROJECT"] = projectId;
  }

  const response = await fetch(`${BASE_URL}${requestPath}`, {
    method,
    headers,
    body: bodyText || undefined
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    if (!response.ok) {
      const error = new Error(`x402 API error ${response.status}: ${text.slice(0, 200)}`);
      error.status = response.status;
      error.body = text;
      error.paymentReason = null;
      error.paymentCode = null;
      throw error;
    }
    throw new Error(`Unexpected OKX x402 response: ${text}`);
  }

  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload, `x402 API error ${response.status}`));
    error.status = response.status;
    error.paymentCode = payload?.code || null;
    error.paymentReason = extractReason(payload);
    throw error;
  }

  if (payload?.code && payload.code !== "0") {
    const error = new Error(extractErrorMessage(payload, `x402 API business error ${payload.code}`));
    error.code = payload.code;
    error.paymentCode = payload.code;
    error.paymentReason = extractReason(payload);
    throw error;
  }

  return payload;
}

async function request(method, path, body) {
  let lastError;
  for (const basePath of getBasePaths()) {
    try {
      return await performRequest(basePath, method, path, body);
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(error.status)) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function normalizeSupportedResponse(payload, { cachedAt, ttlMs }) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return {
    provider: "okx-x402-api",
    source: "okx-live",
    fetchedAt: cachedAt,
    cachedUntil: new Date(Date.parse(cachedAt) + ttlMs).toISOString(),
    protocol: X402_PROTOCOL,
    networks: items.map((item) => ({
      chainIndex: String(item?.chainIndex || ""),
      chainName: item?.chainName || null,
      schemes: item?.scheme ? [item.scheme] : ["exact"],
      x402Version: String(item?.x402Version || X402_VERSION),
      assets: getKnownAssetsForChainIndex(item?.chainIndex)
    })),
    raw: payload
  };
}

export function normalizeVerifyResponse(payload) {
  const item = firstDataItem(payload);
  const valid = item?.isValid === true || item?.isValid === "true";
  return {
    provider: "okx-x402-api",
    valid,
    isValid: valid,
    status: valid ? "verified" : "rejected",
    reason: item?.invalidReason || (valid ? "" : "verification_failed"),
    invalidReason: item?.invalidReason || null,
    payer: item?.payer || null,
    problems: valid ? [] : [item?.invalidReason || "verification_failed"],
    txHash: null,
    raw: payload
  };
}

export function normalizeSettlementResponse(payload, paymentRequirements) {
  const item = firstDataItem(payload);
  const success = item?.success === true || item?.success === "true";
  return {
    provider: "okx-x402-api",
    status: success ? "settled" : "failed",
    success,
    settlementId: item?.txHash || `${item?.chainIndex || paymentRequirements.chainIndex}:${Date.now()}`,
    txHash: item?.txHash || null,
    chainIndex: item?.chainIndex || paymentRequirements.chainIndex,
    chainName: item?.chainName || null,
    payer: item?.payer || null,
    asset: paymentRequirements.asset,
    amount: paymentRequirements.maxAmountRequired,
    errorReason: item?.errorReason || null,
    raw: payload
  };
}

export class OkxX402ApiAdapter {
  constructor({ supportedTtlMs = PAYMENT_DEFAULTS.supportedTtlMs } = {}) {
    this.name = "okx-x402-api";
    this.supportedTtlMs = supportedTtlMs;
    this.supportedCache = null;
  }

  async getSupported({ forceRefresh = false } = {}) {
    if (
      !forceRefresh &&
      this.supportedCache &&
      Date.now() < this.supportedCache.expiresAt
    ) {
      return {
        ...this.supportedCache.value,
        cache: {
          hit: true,
          ttlMs: this.supportedTtlMs
        }
      };
    }

    const payload = await request("GET", "/supported");
    const cachedAt = new Date().toISOString();
    const normalized = normalizeSupportedResponse(payload, {
      cachedAt,
      ttlMs: this.supportedTtlMs
    });
    this.supportedCache = {
      value: normalized,
      expiresAt: Date.now() + this.supportedTtlMs
    };
    return {
      ...normalized,
      cache: {
        hit: false,
        ttlMs: this.supportedTtlMs
      }
    };
  }

  async verify({ paymentPayload, paymentRequirements }) {
    const payload = await request("POST", "/verify", {
      x402Version: X402_VERSION,
      chainIndex: paymentRequirements.chainIndex,
      paymentPayload,
      paymentRequirements
    });
    return normalizeVerifyResponse(payload);
  }

  async settle({ paymentPayload, paymentRequirements }) {
    const payload = await request("POST", "/settle", {
      x402Version: X402_VERSION,
      chainIndex: paymentRequirements.chainIndex,
      paymentPayload,
      paymentRequirements
    });
    return normalizeSettlementResponse(payload, paymentRequirements);
  }

  async preparePayment() {
    const error = new Error(
      "Live payment authoring is not automated. Use a real x402-capable payer."
    );
    error.paymentReason = "invalid_signature";
    error.hint = humanizePaymentError({
      reason: "invalid_signature"
    });
    throw error;
  }
}
