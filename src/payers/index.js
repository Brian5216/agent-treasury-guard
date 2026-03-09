import { PAYMENT_DEFAULTS } from "../payments/catalog.js";
import { CommandPayer } from "./command.js";
import { MockPayer } from "./mock.js";
import { RealWalletPayer } from "./real-wallet.js";

export function createPayer(name = PAYMENT_DEFAULTS.payer, options = {}) {
  const normalized = String(name || "").toLowerCase();

  if (["command", "command-payer"].includes(normalized)) {
    return new CommandPayer({
      command: options.command || PAYMENT_DEFAULTS.payerCommand
    });
  }

  if (["real-wallet", "wallet", "real-wallet-payer"].includes(normalized)) {
    return new RealWalletPayer({
      privateKey: options.privateKey
    });
  }

  return new MockPayer();
}

export { MockPayer, CommandPayer, RealWalletPayer };
