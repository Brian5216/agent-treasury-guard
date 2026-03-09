import { spawn } from "node:child_process";

function runCommand(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `External payer command exited with code ${code}.`
          )
        );
        return;
      }

      resolve(stdout);
    });

    child.stdin.end(JSON.stringify(input));
  });
}

export class CommandPayer {
  constructor({ command }) {
    if (!command) {
      throw new Error(
        "Missing payer command. Set TREASURY_GUARD_PAYER_COMMAND or pass --payer-command."
      );
    }
    this.name = "command-payer";
    this.command = command;
  }

  async preparePayment({ paymentRequirements, payer, invoice }) {
    const stdout = await runCommand(this.command, {
      paymentRequirements,
      payer,
      invoice
    });

    let payload;
    try {
      payload = JSON.parse(String(stdout || "").trim());
    } catch {
      throw new Error(
        `External payer command must print JSON paymentPayload to stdout. Received: ${String(stdout).slice(0, 200)}`
      );
    }

    return payload;
  }
}
