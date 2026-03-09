import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmSchemeV1, EVM_NETWORK_CHAIN_ID_MAP } from "@x402/evm/v1";

EVM_NETWORK_CHAIN_ID_MAP.xlayer = 196;

function buildSignerRequirements(paymentRequirements) {
  return {
    ...paymentRequirements,
    network:
      paymentRequirements?.extra?.network ||
      paymentRequirements?.extra?.chain ||
      "xlayer",
    extra: {
      ...paymentRequirements?.extra,
      name: paymentRequirements?.extra?.name,
      version: paymentRequirements?.extra?.version
    }
  };
}

export class RealWalletPayer {
  constructor({ privateKey = process.env.X402_TEST_PRIVATE_KEY } = {}) {
    if (!privateKey) {
      throw new Error(
        "Missing X402_TEST_PRIVATE_KEY for real wallet payer."
      );
    }
    this.name = "real-wallet-payer";
    this.account = privateKeyToAccount(privateKey);
    this.scheme = new ExactEvmSchemeV1(this.account);
  }

  async preparePayment({ paymentRequirements }) {
    const signerRequirements = buildSignerRequirements(paymentRequirements);
    if (!signerRequirements.extra?.name || !signerRequirements.extra?.version) {
      const asset = paymentRequirements?.extra?.assetSymbol || paymentRequirements?.asset || "unknown-asset";
      const network = signerRequirements.network || "unknown-network";
      throw new Error(
        `Missing token EIP-712 domain metadata (extra.name/version) for ${asset} on ${network}. Use a supported built-in asset profile or switch to the command payer.`
      );
    }

    const paymentPayload = await this.scheme.createPaymentPayload(
      1,
      signerRequirements
    );

    return {
      ...paymentPayload,
      chainIndex:
        paymentRequirements?.chainIndex ||
        paymentRequirements?.extra?.chainIndex ||
        "196"
    };
  }
}
