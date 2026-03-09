import test from "node:test";
import assert from "node:assert/strict";
import { OkxHttpAdapter } from "../src/adapters/okx-http.js";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = {
  OKX_API_KEY: process.env.OKX_API_KEY,
  OKX_SECRET_KEY: process.env.OKX_SECRET_KEY,
  OKX_API_PASSPHRASE: process.env.OKX_API_PASSPHRASE,
  OKX_PROJECT_ID: process.env.OKX_PROJECT_ID
};

function setCreds() {
  process.env.OKX_API_KEY = "demo-key";
  process.env.OKX_SECRET_KEY = "demo-secret";
  process.env.OKX_API_PASSPHRASE = "demo-pass";
  delete process.env.OKX_PROJECT_ID;
}

function restoreCreds() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test("okx-http searchTokens normalizes chain names", async () => {
  setCreds();
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "0",
        data: [
          {
            chainIndex: "8453",
            tokenName: "Brett",
            tokenSymbol: "BRETT",
            tokenContractAddress: "0x1111111111111111111111111111111111111111",
            decimal: "18",
            price: "0.168",
            liquidity: "4200000",
            tagList: {
              communityRecognized: true
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  try {
    const adapter = new OkxHttpAdapter();
    const items = await adapter.searchTokens({
      query: "BRETT",
      chain: "base"
    });

    assert.equal(items[0].chain, "base");
    assert.equal(items[0].tokenSymbol, "BRETT");
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreCreds();
  }
});

test("okx-http getHolderStats derives top10 concentration from live holder data", async () => {
  setCreds();
  let callCount = 0;
  globalThis.fetch = async (url) => {
    callCount += 1;
    if (String(url).includes("/price-info")) {
      return new Response(
        JSON.stringify({
          code: "0",
          data: [
            {
              chainIndex: "8453",
              tokenContractAddress: "0x1111111111111111111111111111111111111111",
              circSupply: "1000",
              price: "0.168",
              liquidity: "4200000",
              priceChange1H: "4.8"
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        code: "0",
        data: Array.from({ length: 10 }, () => ({
          holdAmount: "40",
          holderWalletAddress: "0xholder"
        }))
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const adapter = new OkxHttpAdapter();
    const holders = await adapter.getHolderStats({
      address: "0x1111111111111111111111111111111111111111",
      chain: "base"
    });

    assert.equal(holders.top10HolderPercent, 40);
    assert.deepEqual(holders.contractRiskFlags, ["holder concentration"]);
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreCreds();
  }
});

test("okx-http listSignals maps toplist volume into signal-like items", async () => {
  setCreds();
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "0",
        data: [
          {
            chainIndex: "8453",
            tokenSymbol: "BRETT",
            tokenContractAddress: "0x1111111111111111111111111111111111111111",
            volume: "330000",
            uniqueTraders: "7",
            firstTradeTime: "1710000000000"
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const adapter = new OkxHttpAdapter();
    const signals = await adapter.listSignals({
      chain: "base",
      minAmountUsd: 5000
    });

    assert.equal(signals[0].walletType, "TOPLIST_VOLUME_1H");
    assert.equal(signals[0].token.tokenAddress, "0x1111111111111111111111111111111111111111");
    assert.equal(signals[0].triggerWalletCount, 7);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreCreds();
  }
});

test("okx-http getQuote normalizes dex routes and gas fee", async () => {
  setCreds();
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "0",
        data: [
          {
            fromTokenAmount: "1000000000",
            toTokenAmount: "5947619048000000000000",
            tradeFee: "0.08",
            estimateGasFee: "100000",
            priceImpactPercent: "0.08",
            dexRouterList: [
              {
                dexProtocol: {
                  dexName: "Aerodrome",
                  percent: "65"
                }
              },
              {
                dexProtocol: {
                  dexName: "Uniswap V3",
                  percent: "35"
                }
              }
            ],
            fromToken: {
              decimal: "6",
              tokenUnitPrice: "1",
              isHoneyPot: false,
              taxRate: "0"
            },
            toToken: {
              decimal: "18",
              tokenUnitPrice: "0.168",
              isHoneyPot: false,
              taxRate: "0"
            }
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const adapter = new OkxHttpAdapter();
    const quote = await adapter.getQuote({
      chain: "base",
      fromToken: { symbol: "USDC", address: "0x74b7f16337b8972027f6196a17a631ac6de26d22", decimals: 6 },
      toToken: { symbol: "BRETT", address: "0x1111111111111111111111111111111111111111", decimals: 18 },
      amount: "1000000000"
    });

    assert.equal(quote.gasUsd, 0.08);
    assert.deepEqual(quote.dexRouterList, [
      { dexName: "Aerodrome", percentage: "65" },
      { dexName: "Uniswap V3", percentage: "35" }
    ]);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreCreds();
  }
});

test("okx-http retries on rate limiting before succeeding", async () => {
  setCreds();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({
          code: "50011",
          msg: "Too Many Requests"
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "retry-after": "0"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        code: "0",
        data: [
          {
            chainIndex: "8453",
            tokenName: "Brett",
            tokenSymbol: "BRETT",
            tokenContractAddress: "0x1111111111111111111111111111111111111111",
            decimal: "18",
            price: "0.168",
            liquidity: "4200000"
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const adapter = new OkxHttpAdapter();
    const items = await adapter.searchTokens({
      query: "BRETT",
      chain: "base"
    });

    assert.equal(items[0].tokenSymbol, "BRETT");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreCreds();
  }
});
