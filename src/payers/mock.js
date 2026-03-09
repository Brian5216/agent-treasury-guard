import { MockX402Adapter } from "../payments/mock.js";

export class MockPayer {
  constructor() {
    this.name = "mock-payer";
    this.adapter = new MockX402Adapter();
  }

  async preparePayment({ paymentRequirements, payer }) {
    return this.adapter.preparePayment({
      paymentRequirements,
      payer
    });
  }
}
