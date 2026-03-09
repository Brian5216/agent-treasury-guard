# 提交表单答案草稿

## 项目名称

Agent Treasury Guard

## 一句话介绍

OKX 提供底层链上技能，Agent Treasury Guard 提供 AI 愿意付费的决策工作流。其他 AI 不必自己拼 OKX Skills，就能获得免费机会扫描，并按次购买带 Treasury Policy 的交易计划、BYO Thesis 验证、风险退出方案和 Watch Plan。普通 BYO Thesis 调用直接向 Treasury Guard 付费；只有白名单 Provider thesis 才进入 `20% / 80%` 分成。

## 项目简介

Agent Treasury Guard 建立在 OKX OnchainOS 和 OKX Skills 之上。  
它不让其他 AI 自己拼底层链上技能，而是把这些能力封装成可直接消费的高阶工作流：

- Free Opportunity Scan
- Premium Trade Plan
- Premium BYO Thesis Plan
- Premium Exit Plan

当通用 AI 遇到链上任务时，可以直接请求 Treasury Guard。  
如果请求的是高价值工作流，Treasury Guard 会先返回 `402 Payment Required`，然后在支付成功后解锁完整结果。  
输出同时包含人类可读解释和 AI 可读 `machineView`，并附带 Treasury Policy 检查结果与 Watch Plan，方便后续继续调用或接入 UI。

项目已经完成全 live 演示：`okx-http` 直接调用 OKX live 市场与交易数据，`okx-x402-api` 完成 `verify / settle`，买方使用真实 X Layer 钱包签名支付。

## 为什么选择 OKX OnchainOS

1. OKX 已提供成熟的 token、market、swap、gateway 能力，适合封装高阶工作流
2. x402 提供了 AI-to-AI 按次付费的基础设施
3. 整体能力非常适合构建可复制、可收费、可集成的 Agent 服务
4. 也适合进一步做成 `House + Provider + Guard` 的混合模式，既有自营判断层，也支持白名单外部 AI 提交 thesis 并按次分账

## 创新点

1. 从“聊天式 Agent”升级为“AI 可购买的专家服务”
2. 将底层链上技能封装成高阶工作流，而不是重复做行情机器人
3. 新增 `BYO Thesis` 模式，让更强的 AI 保留自己的推理层，再把判断交给 Treasury Guard 做验证、路由和风控落地
4. 在高阶工作流中加入 Treasury Policy 与 Watch Plan，让 AI 为“决策结果”付费，而不是为“原始数据”付费
5. 同时提供 `manifest`、OpenAPI 和 prompts，方便其他 AI 快速接入
6. 新增 provider 分成模型：白名单 Provider thesis 采用平台抽成 20%，通过统一的风控与执行层承接外部 AI 供给

## 为什么 AI 会为它付费

1. OKX 底层链上技能解决“能做什么”，Treasury Guard 解决“该不该做、怎么做、什么时候退出”
2. 调用方 AI 不需要自己拼 `token / market / swap / gateway`，只需要购买一个稳定输出的高阶工作流
3. 付费后获得的不是碎片数据，而是 `policy + decision + route + watch + machineView`

## 实用场景

1. 通用 AI 需要链上候选标的时，先调用免费 opportunity scan
2. 通用 AI 需要买入计划时，购买 premium trade plan
3. 通用 AI 已经有更强 thesis 时，购买 premium thesis plan
4. 通用 AI 需要减仓/退出建议时，购买 premium exit plan

## 可复制性

项目已经提供：

- Skill
- Premium API
- `/manifest`
- `openapi.yaml`
- Buyer / Provider prompts
- Mock demo flow
- Full live demo flow

其他 AI 或开发者可以直接复用，而不需要重新拼接底层 OKX 工具。

## 演示说明

演示中展示了完整 A2A 流程：

1. Buyer Agent 请求 premium resource
2. 返回 `402 Payment Required`
3. x402 支付
4. 返回 premium result
5. 输出机会排名、风险评估、Treasury Policy、执行建议、Watch Plan 和 machineView

全 live 证明：

- trade settlement: `0x79e11af955c5f1cb62187c921b679464a0536d516f724b732281aa30034e33b8`
- exit settlement: `0x4fb62e16e0625a6c8a448d35a640b4bab7835de6c81863a877d132fa35fa94db`
