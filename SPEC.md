# SPEC — Cabinet Studio（Open Agentic Web Challenge，方向 A）

## 产品

Cabinet Studio — 一个公开的家具配置网站，按 MVP Profile 0.3 规范 agent 化。
访客在页面上与 agent 对话；agent 用真实产品目录（衣柜 / 餐边柜 / 玄关柜 / 电视柜 /
书柜的尺寸、材质、价格）回答问题，帮访客配柜子、加进报价单、访客确认后出报价。
报价只存页面内存，不收款、不下真单（与披萨示例的 demo 订单同理）。

## 目录（catalog.json，演示数据，页面与代码均标明）

价格为人民币整数分。尺寸单位 cm（宽 × 高 × 深）。所有价格、尺寸、材质均为
演示数据，不是真实报价；页面与目录文件均写明 "demo data — not a real price"。

| id | 名称 | 类别 | 尺寸（宽×高×深） | 材质/特点 | 价格 |
|----|------|------|------------------|-----------|------|
| wardrobe-120 | 分段式衣柜 120 | 衣柜 | 120 × 200 × 55 | 胡桃木贴面；挂杆＋可调层板＋2 抽屉 | ¥3,280 |
| wardrobe-160 | 分段式衣柜 160 | 衣柜 | 160 × 200 × 55 | 胡桃木贴面；挂杆＋可调层板＋2 抽屉 | ¥4,280 |
| sideboard-140 | 餐边柜 140 | 餐边柜 | 140 × 85 × 40 | 电器位＋轨道插座＋水吧台面 | ¥2,180 |
| sideboard-180 | 餐边柜 180 | 餐边柜 | 180 × 85 × 40 | 电器位＋轨道插座＋水吧台面 | ¥2,980 |
| entry-100 | 玄关柜 100 | 玄关柜 | 100 × 200 × 35 | 同色成套；挂衣区＋鞋柜 | ¥1,680 |
| tv-200 | 电视柜 200 | 电视柜 | 200 × 45 × 40 | 同色一体系列；走线孔＋抽屉 | ¥1,880 |
| bookcase-120 | 书柜 120 | 书柜 | 120 × 200 × 32 | 同色一体系列；可调层板 | ¥1,980 |
| tea-500 | 茶柜 500 | 茶柜 | 50 × 120 × 35（宽×高×深） | 顶格＋暖光灯带；2×2 格；双黑抽屉带 | ¥1,280 |

配置选项（全部柜子通用）：
- finish（饰面）：胡桃木 +¥0、白橡木 +¥0、哑光白 +¥0、深胡桃 +¥120
- extras（附加）：led 灯带 +¥180、socket 轨道插座 +¥260、hinge 缓冲铰链 +¥90

单价 = 基础价 ＋ 饰面差价 ＋ 附加项差价之和。行总价 = 单价 × 数量。

## Agent 网络（1 网络，1 front agent，2 specialist）

网络名 `cabinet_studio_assistant`，模型 `alibaba/qwen3.8-flash`（模板默认值，
访客在设置里可改），`max_steps` 12，CRUSE version 1，`peer_policy` closed，
`allowed_peers` 空（不调用任何外部站点）。

- `cabinet_coordinator`（front agent）：拥有全部 4 个 website_* 工具；接待访客、
  委派给 specialist、汇总成一个回答。
- `catalog_specialist`：目录与配置知识。回答尺寸、材质、价格、配置选项问题；
  只从 website_query_catalog 的结果里取事实。
- `quote_specialist`：报价单知识。帮访客把配好的柜子加进报价单、出报价；
  出报价前必须读到当回合的最新 quoteVersion。

 grounding 规则（写进 hocon 的 commondefs）：事实只来自 website_* 工具结果；
不知道就说不知道；不编价格、尺寸、库存、单号；不索要密码与支付卡信息；
不可逆操作不由 agent 在对话里确认——浏览器在调用工具时问访客。

## Site actions（manifest.actions.agentTools，4 个）

| 名称 | effect | 说明 |
|------|--------|------|
| query_catalog | read | 返回目录（8 件）、货币 CNY、演示标记、当前配置草稿、报价单、quoteVersion、最近一次报价 |
| configure_cabinet | write | 设定当前配置草稿：{itemId, finish?, extras?}。校验失败返回 {ok:false, reason}，不改状态。草稿可改，访客可在页面上撤销 |
| add_to_quote | write | 把一件配好的柜子加进报价单：{itemId, quantity, finish?, extras?}。quantity 1–100。quoteVersion +1。返回新状态 |
| issue_quote | irreversible | 出报价：{customerName, expectedQuoteVersion}。报价单为空、名字为空、版本不符时站点拒绝。成功返回报价回执 {quoteId: "QUOTE-<uuid 前 8 位大写>", customerName, items, total, issuedAt}，报价单清空，quoteVersion +1。**必须等访客在确认框里确认后才执行** |

页面状态（App.page.getState() 返回）：
`{catalog, currency: "CNY", demo: true, draftConfig, quote: [{lineId, itemId, name,
finish, extras, quantity, unitPrice, lineTotal}], quoteTotal, quoteVersion, lastQuote}`。
quoteVersion 初始 0，每次报价单变化 +1。lastQuote 初始 null。

## Manifest（agent-manifest.json）字段

- brand: "Cabinet Studio Assistant"
- networks[0]: name `cabinet_studio_assistant`，front_man `cabinet_coordinator`，
  hocon `./cabinet_studio_assistant.network.json`，description 一句话，
  tags ["agentified-website"]，sample_queries 4 条（1 条可答、1 条改状态、
  1 条以确认出报价结尾、1 条本站做不了须拒绝：要求送货安装上门——本站只出报价）
- llm_router: base_url `https://api.otari.ai/api/v1`，mock false，
  byok_router `https://api.otari.ai/api/v1`
- allowed_peers: []，peer_policy: {mode: "closed", deny_origins: [], note}
- agent_mcp: protocol `nsdeploy-agent-mcp/v1`，available false（静态包，无公开 MCP 门面）
- theme.primary: `#7c4a21`（胡桃木棕，深色，白字可读）
- linking.protocol: `nsdeploy-link/v1`，exports 含本网络，imports 空，
  link_updates.mode browser-local
- deployment: mode static，self_contained_runtime true，browser_mock false，
  direct_byok true，direct_mcp_requires_cors true，public_mcp_facade false
- actions: version 1，module `./cabinet-actions.js`，
  bridge `./bridge/action-bridge.html`，
  agentTools [query_catalog, configure_cabinet, add_to_quote, issue_quote]

## 页面（app/index.html + styles + site.js）

界面必须同时显示：目录（8 件，含尺寸/材质/价格/演示标记）、对话（#agent-app，
runtime 挂载）、报价单（行、数量、单价、行总价、合计、移除按钮、姓名输入、
出报价按钮）、agent 活动（runtime 的 agents 面板与 trace）、LLM/密钥设置面板
（BYOK：Otari / OpenRouter，访客自己的 key；**任何文件里不写任何 key**）。
页面在 assistant 加载失败时仍可手动使用（目录、配置、报价单、出报价按钮均可用）。

## 验收 T1–T8

- T1：`node SKILL_DIR/scripts/build_network.mjs app/cabinet_studio_assistant.hocon --manifest app/agent-manifest.json --check` 零错误零警告。
- T2：`node --test "app/tests/*.test.mjs"` 全部通过（模板套件按本站改写：网络校验、
  actions 与 manifest 一致、读/写/不可逆确认、对话框、拒绝路径、打包表单）。
- T3：无头浏览器实跑 exit 0：consoleErrors、pageErrors、failedRequests、
  externalRequests 全部为空数组。
- T4：manifest 与 network JSON 在浏览器里 fetch 并解析：1 个网络、
  front cabinet_coordinator、3 个 agent、4 个 agentTools。
- T5：脚本模型调 website_add_to_quote（wardrobe-120 ×1，默认饰面、无附加），
  回执 succeeded，页面报价合计 ¥0.00 → ¥3,280.00，quote 状态一致。
- T6：脚本模型调 website_issue_quote 时确认框打开；点拒绝 → 回执 cancelled，
  无 lastQuote、报价单不变；点确认 → 回执 succeeded，quoteId 形如 QUOTE-XXXXXXXX，
  报价单清空。Node 测试另覆盖版本过期与空报价单的拒绝。
- T7：configure_cabinet 算价正确：wardrobe-120 ＋ 深胡桃（+¥120）＋ 灯带（+¥180）
  = ¥3,580；未知 itemId / finish / extra 时返回 ok false 且状态不变。
- T8：无任何真实 LLM 调用（模型全程 stub）；app/ 内无任何 key 材料
  （grep "api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]" 零命中；BYOK 面板由 runtime 提供，
  只读访客在浏览器里自己填的 key）。

## 未验证（写进 VERIFICATION.md，不粉饰）

- 无真实 LLM 调用（模型 stub，与最小站点测试同法）。真实 BYOK 对话回合未测。
- 无 peer 站点加载（peer_policy closed）。跨站链接未测。
- 无 MCP 工具调用（本网络只有本地 site action）。
- 演示视频、公开仓库、Pages 发布、Devpost 提交均不在本任务内（另行安排）。
