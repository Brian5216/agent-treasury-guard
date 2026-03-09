#!/usr/bin/env node

import { OkxX402ApiAdapter } from "./payments/okx-api.js";
import { buildPaymentRequirements } from "./payments/catalog.js";

function buildDummyPaymentPayload({ paymentRequirements }) {
  return {
    x402Version: 1,
    scheme: "exact",
    chainIndex: String(paymentRequirements.chainIndex),
    payload: {
      signature: "0xdeadbeef",
      authorization: {
        from:
          process.env.TREASURY_GUARD_TEST_PAYER ||
          "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        to: paymentRequirements.payTo,
        value: paymentRequirements.maxAmountRequired,
        validAfter: "1716150000",
        validBefore: "2716150000",
        nonce: "0x1234567890abcdef1234567890abcdef12345678"
      }
    }
  };
}

async function main() {
  const adapter = new OkxX402ApiAdapter();
  const requirement = buildPaymentRequirements({
    skuId: "opportunities",
    requestUrl: "https://example.com/premium/opportunities?chain=base&budgetUsd=1000&limit=2",
    method: "GET",
    requestBody: null,
    amountUsd: 0.3
  });
  const paymentPayload = buildDummyPaymentPayload({
    paymentRequirements: requirement
  });

  const supported = await adapter.getSupported();
  const verification = await adapter.verify({
    paymentPayload,
    paymentRequirements: requirement
  });
  const settlement = await adapter.settle({
    paymentPayload,
    paymentRequirements: requirement
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        note: "Read-only smoke test. Uses an invalid dummy signature and should not move funds.",
        supported,
        verification,
        settlement
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error.message || error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
