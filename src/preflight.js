#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { createPaymentAdapter } from "./payments/index.js";
import { normalizePaymentAssetSymbols } from "./payments/catalog.js";

const DEFAULT_RUNTIME = {
  analysisAdapter: "mock",
  paymentAdapter: "mock",
  paymentChain: "xlayer",
  paymentAsset: "USDC",
  paymentAssets: "",
  merchantAddress: "0x1234567890abcdef1234567890abcdef12345678",
  providerProgram: "whitelist"
};

function parseOptions(argv) {
  const options = {
    format: "markdown",
    probeSupported: true
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--json") {
      options.format = "json";
      continue;
    }
    if (current === "--no-probe-supported") {
      options.probeSupported = false;
      continue;
    }
    if (current === "--format") {
      const next = argv[index + 1];
      if (next) {
        options.format = next;
        index += 1;
      }
    }
  }

  return options;
}

function maskSecret(value, visible = 4) {
  if (!value) {
    return null;
  }
  if (value.length <= visible * 2) {
    return `${value.slice(0, visible)}...`;
  }
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}

function normalizeBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function readLiveEnv(env, name, fallback = "") {
  return (
    env[`TREASURY_GUARD_LIVE_${name}`] ||
    env[`TREASURY_GUARD_CHAMPION_${name}`] ||
    fallback
  );
}

export function inspectProviderConfig(env, prefix) {
  const providerId = String(env[`${prefix}_PROVIDER_ID`] || "").trim();
  const providerName = String(env[`${prefix}_PROVIDER_NAME`] || "").trim();
  const providerKind = String(env[`${prefix}_PROVIDER_KIND`] || "").trim().toLowerCase();
  const providerPayoutAddress = String(
    env[`${prefix}_PROVIDER_PAYOUT_ADDRESS`] || ""
  ).trim();
  const hasIdentity = Boolean(providerId || providerName || providerKind);
  const hasPayoutAddress = Boolean(providerPayoutAddress);

  let mode = "direct-byo-thesis";
  const warnings = [];

  if (providerKind === "external" && !hasPayoutAddress) {
    warnings.push(
      "Provider metadata is incomplete: external provider mode requires a payout address."
    );
  }

  if (hasPayoutAddress) {
    mode = "approved-provider";
  } else if (hasIdentity) {
    mode = "direct-byo-thesis";
  }

  return {
    prefix,
    providerId: providerId || null,
    providerName: providerName || null,
    providerKind: providerKind || (hasPayoutAddress ? "external" : "caller"),
    providerPayoutAddress: providerPayoutAddress || null,
    configured: hasIdentity || hasPayoutAddress,
    mode,
    splitReady: hasPayoutAddress,
    warnings
  };
}

export function buildPreflightSnapshot(env = process.env) {
  const nodeVersion = process.versions.node;
  const nodeMajor = Number(String(nodeVersion).split(".")[0] || "0");
  const analysisAdapter =
    readLiveEnv(env, "ANALYSIS_ADAPTER") ||
    env.TREASURY_GUARD_REAL_SMOKE_ANALYSIS_ADAPTER ||
    env.TREASURY_GUARD_ADAPTER ||
    DEFAULT_RUNTIME.analysisAdapter;
  const paymentAdapter =
    env.TREASURY_GUARD_PAYMENT_ADAPTER || DEFAULT_RUNTIME.paymentAdapter;
  const paymentChain =
    env.TREASURY_GUARD_PAYMENT_CHAIN || DEFAULT_RUNTIME.paymentChain;
  const paymentAsset =
    env.TREASURY_GUARD_PAYMENT_ASSET || DEFAULT_RUNTIME.paymentAsset;
  const paymentAssets =
    env.TREASURY_GUARD_PAYMENT_ASSETS || DEFAULT_RUNTIME.paymentAssets;
  const merchantAddress =
    env.TREASURY_GUARD_MERCHANT_ADDRESS || DEFAULT_RUNTIME.merchantAddress;

  let acceptedAssets = [];
  let assetError = null;
  try {
    acceptedAssets = normalizePaymentAssetSymbols({
      chain: paymentChain,
      assetSymbol: paymentAsset || undefined,
      assetSymbols: paymentAssets
    });
  } catch (error) {
    assetError = String(error.message || error);
  }

  const liveProvider = inspectProviderConfig(env, "TREASURY_GUARD_LIVE");
  const legacyLiveProvider = inspectProviderConfig(env, "TREASURY_GUARD_CHAMPION");
  const primaryLiveProvider = liveProvider.configured
    ? liveProvider
    : legacyLiveProvider;
  const realSmokeProvider = inspectProviderConfig(
    env,
    "TREASURY_GUARD_REAL_SMOKE"
  );
  const payerMode = env.TREASURY_GUARD_PAYER || "mock";
  const liveScriptsUseRealWallet = true;
  const hasOkxCreds = Boolean(
    env.OKX_API_KEY && env.OKX_SECRET_KEY && env.OKX_API_PASSPHRASE
  );
  const hasWalletKey = Boolean(env.X402_TEST_PRIVATE_KEY);
  const merchantSelfPays = merchantAddress === DEFAULT_RUNTIME.merchantAddress;
  const supportedProbeEligible =
    hasOkxCreds &&
    ["okx-api", "okx-x402-api"].includes(String(paymentAdapter).toLowerCase());

  const warnings = [
    ...primaryLiveProvider.warnings.map((item) => `Live thesis: ${item}`),
    ...realSmokeProvider.warnings.map((item) => `Real smoke: ${item}`)
  ];

  if (merchantSelfPays) {
    warnings.push(
      "TREASURY_GUARD_MERCHANT_ADDRESS is not set. Live smokes will default to self-pay using the payer wallet."
    );
  }
  if (!hasWalletKey) {
    warnings.push(
      "X402_TEST_PRIVATE_KEY is missing. Real-wallet payer flows will not run until it is set."
    );
  }
  if (!hasOkxCreds) {
    warnings.push(
      "OKX credentials are incomplete. Live OKX analysis and x402 supported probes will be skipped."
    );
  }
  if (assetError) {
    warnings.push(assetError);
  }

  const checks = [
    {
      id: "node_runtime",
      label: "Node >= 20",
      status: nodeMajor >= 20 ? "pass" : "fail",
      detail: `Detected ${nodeVersion}`
    },
    {
      id: "okx_credentials",
      label: "OKX credentials",
      status: hasOkxCreds ? "pass" : "fail",
      detail: hasOkxCreds
        ? "OKX API key, secret, and passphrase are present."
        : "Missing one or more of OKX_API_KEY / OKX_SECRET_KEY / OKX_API_PASSPHRASE."
    },
    {
      id: "wallet_signer",
      label: "Real wallet signer",
      status: hasWalletKey ? "pass" : "fail",
      detail: hasWalletKey
        ? "X402_TEST_PRIVATE_KEY is present for real-wallet payer flows."
        : "X402_TEST_PRIVATE_KEY is missing."
    },
    {
      id: "payment_assets",
      label: "Settlement assets",
      status: assetError ? "fail" : "pass",
      detail: assetError || acceptedAssets.join(", ")
    },
    {
      id: "live_provider_mode",
      label: "Live thesis mode",
      status:
        primaryLiveProvider.mode === "approved-provider" ||
        primaryLiveProvider.mode === "direct-byo-thesis"
          ? "pass"
          : "fail",
      detail: primaryLiveProvider.splitReady
        ? "Approved provider split is configured."
        : "Live thesis will run as direct BYO-thesis unless payout metadata is added."
    },
    {
      id: "x402_supported_probe",
      label: "x402 /supported probe",
      status: supportedProbeEligible ? "ready" : "skipped",
      detail: supportedProbeEligible
        ? "Ready to query OKX /supported."
        : "Skipped until live OKX credentials and okx-api adapter are configured."
    }
  ];

  const ready =
    checks.every((item) => item.status !== "fail") &&
    !assetError &&
    hasOkxCreds &&
    hasWalletKey;

  return {
    generatedAt: new Date().toISOString(),
    ready,
    runtime: {
      nodeVersion,
      analysisAdapter,
      paymentAdapter,
      paymentChain,
      paymentAsset,
      acceptedAssets,
      payerMode,
      liveScriptsUseRealWallet,
      merchantAddress,
      merchantSelfPays,
      providerProgram:
        env.TREASURY_GUARD_PROVIDER_PROGRAM || DEFAULT_RUNTIME.providerProgram
    },
    envSummary: {
      okxApiKey: hasOkxCreds ? maskSecret(env.OKX_API_KEY, 4) : null,
      okxSecretKey: hasOkxCreds ? maskSecret(env.OKX_SECRET_KEY, 4) : null,
      okxPassphrase: hasOkxCreds ? maskSecret(env.OKX_API_PASSPHRASE, 2) : null,
      walletKey: hasWalletKey ? maskSecret(env.X402_TEST_PRIVATE_KEY, 6) : null
    },
    providerModes: {
      live: primaryLiveProvider,
      realSmoke: realSmokeProvider
    },
    checks,
    warnings,
    probe: {
      eligible: supportedProbeEligible,
      enabledByDefault: true
    }
  };
}

async function runSupportedProbe(snapshot, options) {
  if (!options.probeSupported || !snapshot.probe.eligible) {
    return {
      status: "skipped",
      reason: options.probeSupported
        ? "Missing live payment credentials or okx-api adapter."
        : "Disabled by flag."
    };
  }

  try {
    const adapter = createPaymentAdapter("okx-api");
    const supported = await adapter.getSupported({ forceRefresh: true });
    const networks = (supported.networks || []).map((network) => ({
      chainIndex: network.chainIndex,
      chainName: network.chainName,
      assets: (network.assets || []).map((asset) => asset.symbol)
    }));
    return {
      status: "pass",
      source: supported.source,
      cache: supported.cache || null,
      networks
    };
  } catch (error) {
    return {
      status: "fail",
      reason: String(error.message || error)
    };
  }
}

export function renderPreflightMarkdown(report) {
  const lines = [
    "# Treasury Guard Preflight",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Overall: ${report.ready ? "Ready" : "Needs Attention"}`,
    ""
  ];

  lines.push("## Runtime");
  lines.push(`- Analysis adapter: ${report.runtime.analysisAdapter}`);
  lines.push(`- Payment adapter: ${report.runtime.paymentAdapter}`);
  lines.push(`- Payment chain: ${report.runtime.paymentChain}`);
  lines.push(`- Default settlement asset: ${report.runtime.paymentAsset}`);
  lines.push(
    `- Accepted assets: ${report.runtime.acceptedAssets.join(", ") || "none"}`
  );
  lines.push(`- Merchant address: ${report.runtime.merchantAddress}`);
  lines.push(`- Payer mode: ${report.runtime.payerMode}`);
  lines.push("");

  lines.push("## Checks");
  for (const check of report.checks) {
    lines.push(`- ${check.label}: ${check.status.toUpperCase()} (${check.detail})`);
  }
  lines.push("");

  lines.push("## Thesis Modes");
  lines.push(
    `- Live thesis: ${report.providerModes.live.mode} (${report.providerModes.live.providerKind})`
  );
  lines.push(
    `- Real smoke thesis: ${report.providerModes.realSmoke.mode} (${report.providerModes.realSmoke.providerKind})`
  );
  lines.push("");

  lines.push("## Live x402 Probe");
  lines.push(`- Status: ${String(report.supportedProbe.status || "skipped").toUpperCase()}`);
  if (report.supportedProbe.networks?.length) {
    for (const network of report.supportedProbe.networks) {
      lines.push(
        `- ${network.chainName || network.chainIndex}: ${(network.assets || []).join(", ")}`
      );
    }
  } else if (report.supportedProbe.reason) {
    lines.push(`- Reason: ${report.supportedProbe.reason}`);
  }
  lines.push("");

  if (report.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  lines.push("## Recommended Commands");
  lines.push("- `npm run preflight`");
  lines.push("- `npm run premium:live-demo-thesis`");
  lines.push("- `npm run premium:live-demo-trade`");
  lines.push("- `npm run premium:live-smoke`");

  return lines.join("\n");
}

export async function main() {
  const options = parseOptions(process.argv);
  const snapshot = buildPreflightSnapshot(process.env);
  const supportedProbe = await runSupportedProbe(snapshot, options);
  const report = {
    ...snapshot,
    supportedProbe
  };

  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderPreflightMarkdown(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
}
