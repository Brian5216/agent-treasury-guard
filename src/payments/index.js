import { PAYMENT_DEFAULTS } from "./catalog.js";
import { MockX402Adapter } from "./mock.js";
import { OkxX402ApiAdapter } from "./okx-api.js";

export function createPaymentAdapter(name = PAYMENT_DEFAULTS.adapter) {
  if (["okx-api", "okx-x402-api"].includes(String(name || "").toLowerCase())) {
    return new OkxX402ApiAdapter();
  }
  return new MockX402Adapter();
}

export { MockX402Adapter, OkxX402ApiAdapter };
