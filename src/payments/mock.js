import crypto from "node:crypto";
import {
  PAYMENT_DEFAULTS,
  X402_PROTOCOL,
  X402_VERSION,
  listKnownPaymentNetworks
} from "./catalog.js";
import { nowIso } from "../core/utils.js";

export class MockX402Adapter {
  constructor() {
    this.name = "mock-x402";
  }

  async getSupported() {
    return {
      provider: this.name,
      source: "mock",
      fetchedAt: nowIso(),
      cachedUntil: nowIso(),
      protocol: X402_PROTOCOL,
      x402Version: X402_VERSION,
      networks: listKnownPaymentNetworks(),
      cache: {
        hit: false,
        ttlMs: 0
      }
    };
  }

  async preparePayment({ paymentRequirements, payer = PAYMENT_DEFAULTS.demoPayer }) {
    const txHash = `0xpay${crypto.randomBytes(12).toString("hex")}`;
    const authorization = {
      from: payer,
      to: paymentRequirements.payTo,
      value: paymentRequirements.maxAmountRequired,
      validAfter: String(Math.floor(Date.now() / 1000) - 30),
      validBefore: String(Math.floor(Date.now() / 1000) + paymentRequirements.maxTimeoutSeconds),
      nonce: `0x${crypto.randomBytes(16).toString("hex")}`,
      asset: paymentRequirements.asset,
      resource: paymentRequirements.resource,
      requestHash: paymentRequirements.extra?.requestHash,
      txHash,
      createdAt: nowIso()
    };

    return {
      x402Version: X402_VERSION,
      scheme: "exact",
      chainIndex: paymentRequirements.chainIndex,
      payload: {
        signature: `0xmocksig${crypto.randomBytes(16).toString("hex")}`,
        authorization
      }
    };
  }

  async verify({ paymentPayload, paymentRequirements }) {
    const authorization = paymentPayload?.payload?.authorization || paymentPayload?.authorization || {};
    const problems = [];

    if (Number(paymentPayload?.x402Version) !== X402_VERSION) {
      problems.push("Unsupported x402 version.");
    }
    if (String(paymentPayload?.scheme) !== "exact") {
      problems.push("Only exact payments are supported.");
    }
    if (String(paymentPayload?.chainIndex) !== String(paymentRequirements.chainIndex)) {
      problems.push("Chain index does not match payment requirements.");
    }
    if (String(authorization.asset) !== String(paymentRequirements.asset)) {
      problems.push("Settlement asset does not match the invoice.");
    }
    if (String(authorization.to).toLowerCase() !== String(paymentRequirements.payTo).toLowerCase()) {
      problems.push("Merchant address does not match the invoice.");
    }
    if (BigInt(String(authorization.value || "0")) < BigInt(String(paymentRequirements.maxAmountRequired))) {
      problems.push("Payment amount is below the required amount.");
    }
    if (String(authorization.resource) !== String(paymentRequirements.resource)) {
      problems.push("Protected resource mismatch.");
    }
    if (String(authorization.requestHash || "") !== String(paymentRequirements.extra?.requestHash || "")) {
      problems.push("Request hash mismatch.");
    }

    return {
      provider: this.name,
      valid: problems.length === 0,
      isValid: problems.length === 0,
      status: problems.length === 0 ? "verified" : "rejected",
      reason: problems[0] || "",
      invalidReason: problems[0] || null,
      payer: authorization.from || null,
      problems,
      txHash: authorization.txHash || null
    };
  }

  async settle({ paymentPayload, paymentRequirements, verification }) {
    if (verification?.valid !== true) {
      throw new Error("Cannot settle an invalid payment.");
    }

    const authorization = paymentPayload?.payload?.authorization || paymentPayload?.authorization || {};

    return {
      provider: this.name,
      status: "settled",
      settlementId: `mocksettle_${crypto.randomBytes(6).toString("hex")}`,
      success: true,
      payer: authorization.from || null,
      txHash: authorization.txHash,
      chainIndex: paymentRequirements.chainIndex,
      chainName: "X Layer",
      asset: paymentRequirements.asset,
      amount: paymentRequirements.maxAmountRequired,
      settledAt: nowIso()
    };
  }
}
