const REASON_HINTS = {
  invalid_signature:
    "x402 signature is invalid. Rebuild the payment payload with a real payer that signs the authorization for this invoice.",
  verification_failed:
    "Payment verification failed. Request a fresh invoice and rebuild the payment payload before retrying.",
  payment_required:
    "Payment is required before this premium workflow can be unlocked. Attach a valid X-PAYMENT header and retry.",
  unsupported_chain:
    "The selected payment chain is not currently supported by OKX Payment API.",
  unsupported_asset:
    "The selected settlement asset is not currently supported on this payment chain.",
  unsupported_scheme:
    "The requested x402 payment scheme is not supported by the provider.",
  expired_authorization:
    "The payment authorization has expired. Request a new invoice and sign again.",
  insufficient_amount:
    "The payment amount is below the invoice requirement.",
  request_hash_mismatch:
    "The payment payload does not match this protected request. Sign the exact invoice that was returned by the provider."
};

const CODE_HINTS = {
  "50125":
    "This OKX API key does not currently have access to the x402 service for the active account or region.",
  "50011":
    "The OKX x402 service rate-limited the request. Retry with backoff instead of firing multiple verify or settle calls in parallel.",
  "50000":
    "The upstream OKX service returned a generic error. Retry later or inspect the raw response."
};

export function normalizePaymentReason(reason) {
  return String(reason || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function humanizePaymentError({ code, reason, fallback }) {
  const normalizedReason = normalizePaymentReason(reason);
  if (normalizedReason && REASON_HINTS[normalizedReason]) {
    return REASON_HINTS[normalizedReason];
  }
  if (code && CODE_HINTS[String(code)]) {
    return CODE_HINTS[String(code)];
  }
  return fallback || "The payment provider rejected the request.";
}

export function buildPaymentErrorPayload(error, fallbackMessage) {
  return {
    kind: "payment-upstream-error",
    code: error?.paymentCode || error?.code || null,
    reason: error?.paymentReason || null,
    status: error?.status || null,
    message: humanizePaymentError({
      code: error?.paymentCode || error?.code,
      reason: error?.paymentReason,
      fallback: fallbackMessage || String(error?.message || error || "Payment provider error.")
    })
  };
}
