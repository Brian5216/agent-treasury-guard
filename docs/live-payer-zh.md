# 真实 x402 Payer 怎么接

当前仓库的 provider 侧已经能真实调用 OKX Payment API，而且仓库已经内置了一个可直接使用的真实钱包 payer：

- `GET /supported`
- `POST /verify`
- `POST /settle`

## 现在的结构

- `payment adapter`：Treasury Guard 服务端使用，负责 `supported / verify / settle`
- `payer`：Buyer Agent 使用，负责根据 invoice 生成 `paymentPayload`

仓库默认 payer 是 `mock`。  
如果要直接用本地钱包私钥做真实签名，切换到内置 `real-wallet`：

```bash
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
```

这个内置 payer 现在已经在仓库里真实验证过 `USDG / USDT / USDC` 三种 X Layer 稳定币。  
其中 `USDG` 的合约当前读不到 `version()`，所以仓库内置的是通过 live verify/settle 反推并验证过的签名域：`Global Dollar / 1`。

如果要接你自己的 signer service 或钱包脚本，再切换到 `command` 模式：

```bash
export TREASURY_GUARD_PAYER=command
export TREASURY_GUARD_PAYER_COMMAND="node ./your-real-payer.js"
```

## 外部 payer 命令契约

Treasury Guard 会把以下 JSON 通过 `stdin` 传给外部 signer：

```json
{
  "paymentRequirements": {},
  "payer": "0x...",
  "invoice": {}
}
```

外部 signer 必须把一个合法的 x402 `paymentPayload` 输出到 `stdout`。

## 一个真实成功支付所需的最小步骤

1. Buyer Agent 请求 premium resource
2. Treasury Guard 返回 `402` 和 `paymentRequirements`
3. 外部 payer 读取 invoice
4. 外部 payer 为这张 invoice 构造授权对象
5. 外部 payer 用真实钱包签名
6. Buyer Agent 把签名结果放进 `X-PAYMENT`
7. Treasury Guard 调 OKX `verify`
8. Treasury Guard 调 OKX `settle`
9. Treasury Guard 解锁 premium result

## 推荐的真实 signer 形态

### 方案 A：本地钱包签名脚本

最适合比赛 demo。

- 用一个本地 Node 脚本读取 invoice
- 调你自己的钱包私钥或钱包 SDK
- 输出 `paymentPayload`

优点：
- 集成最快
- 最适合录屏

缺点：
- 私钥管理要谨慎

### 方案 B：独立 payer 微服务

更适合产品化。

- Buyer Agent 把 invoice 发给一个本地或私有网络 signer service
- service 返回签名后的 `paymentPayload`

优点：
- 更接近真实 A2A 架构
- 可替换不同钱包实现

缺点：
- 开发量更高

## 仓库里已经能直接跑的真实验证

机会扫描真支付：

```bash
export TREASURY_GUARD_PAYMENT_ADAPTER=okx-api
export TREASURY_GUARD_PAYMENT_ASSET=USDT
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_API_PASSPHRASE=...
npm run premium:real-payment-smoke
```

交易计划真支付：

```bash
export TREASURY_GUARD_PAYMENT_ADAPTER=okx-api
export TREASURY_GUARD_PAYMENT_ASSET=USDT
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_API_PASSPHRASE=...
npm run premium:real-payment-trade-smoke
```

退出计划真支付：

```bash
export TREASURY_GUARD_PAYMENT_ADAPTER=okx-api
export TREASURY_GUARD_PAYMENT_ASSET=USDT
export TREASURY_GUARD_PAYER=real-wallet
export X402_TEST_PRIVATE_KEY=0x...
export OKX_API_KEY=...
export OKX_SECRET_KEY=...
export OKX_API_PASSPHRASE=...
npm run premium:real-payment-exit-smoke
```

## 比赛阶段建议

如果目标是快速录出 live demo，最稳的做法还是：

1. 优先用仓库内置 `real-wallet` payer 跑通真支付
2. 录完视频后，如果你还想展示更强的 A2A 架构，再把 buyer 侧替换成 `command` 模式
3. 用你自己的 signer service 输出 `paymentPayload`

这样既能保证闭环先成功，也能保留后续产品化空间。
