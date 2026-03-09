#!/usr/bin/env node

import { parseArgs, helpText } from "./core/args.js";
import { renderResult } from "./core/render.js";
import {
  findOpportunities,
  prepareExitPlan,
  prepareThesisPlan,
  prepareTradePlan,
  trackExecution
} from "./core/planner.js";
import { MockOkxAdapter } from "./adapters/mock.js";
import { OnchainosCliAdapter } from "./adapters/onchainos-cli.js";
import { OkxHttpAdapter } from "./adapters/okx-http.js";

function createAdapter(name) {
  if (name === "onchainos-cli") {
    return new OnchainosCliAdapter();
  }
  if (name === "okx-http") {
    return new OkxHttpAdapter();
  }
  return new MockOkxAdapter();
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  if (command === "help" || options.help) {
    console.log(helpText());
    return;
  }

  const adapter = createAdapter(String(options.adapter));

  let result;
  switch (command) {
    case "find-opportunities":
      result = await findOpportunities(adapter, options);
      break;
    case "prepare-trade":
      result = await prepareTradePlan(adapter, options);
      break;
    case "prepare-exit-plan":
      result = await prepareExitPlan(adapter, options);
      break;
    case "prepare-thesis-plan":
      result = await prepareThesisPlan(adapter, options);
      break;
    case "track-execution":
      result = await trackExecution(adapter, options);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  console.log(renderResult(result, String(options.format || "markdown")));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
