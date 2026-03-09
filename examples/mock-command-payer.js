#!/usr/bin/env node

import { MockX402Adapter } from "../src/payments/mock.js";

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.from(chunk));
}

const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const adapter = new MockX402Adapter();
const paymentPayload = await adapter.preparePayment({
  paymentRequirements: input.paymentRequirements,
  payer: input.payer
});

process.stdout.write(JSON.stringify(paymentPayload));
