# Verification — Cabinet Studio (`app/`)

Date: 2026-11-25. Environment: Node v24.22.1, headless Chromium 1255
(`~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`,
Playwright-core, `--no-sandbox`). All commands run from
`~/workspace/open-agentic-web/` unless noted.

## T1 — Build is up to date

```shell
cd app
node ../spec-repo/skills/agentify-website/scripts/build_network.mjs \
  cabinet_studio_assistant.hocon --manifest agent-manifest.json --check
```

Result: `OK: these files are up to date` — `cabinet_studio_assistant.network.json`,
`agent-mcp.json`, `.well-known/nsdeploy.json`, `.well-known/nsdeploy-agent.json`,
`bridge/action-bridge.html`, `bridge/agent-manifest.json`.
Network `cabinet_studio_assistant`, front `cabinet_coordinator`, 3 agents
(coordinator 3380 instruction chars +1612 CRUSE context; catalog_specialist
2193 +1678; quote_specialist 2380 +1678). Website tools:
`website_query_catalog`, `website_configure_cabinet`, `website_add_to_quote`,
`website_issue_quote`, plus `render_cruse` on every agent.

## T2 — Node tests: 22/22 pass

```shell
node --test "app/tests/*.test.mjs"
```

Result: `tests 22, pass 22, fail 0` (`app/tests/agentified.test.mjs`).
Coverage: network validity (no demo mode, grounding + partner rules),
actions match the manifest (bridge shares exactly 1 action,
`query_catalog:bridge`, `callerOrigins ["*"]`, no quote shared), read tool
runs as a tool and changes nothing, write tool changes state and refuses an
unknown ID, configure computes the unit price (wardrobe-120 + dark walnut +
LED = ¥3,580.00) and refuses unknown ids, irreversible action needs
confirmation and a decline changes nothing, dialog words filled in, no
template text left, dialog shows the real call and changes nothing, only the
dialog's confirm button confirms, refused calls open no dialog, partner
action gets the runtime's dialog, bundled forms run nothing, other bundles
get the runtime's dialog, consent focus behaviour (both cases), CRUSE intake
form feeding `issue_quote`, add returning an intake widget with a plain-text
receipt, structured CRUSE objects preserved, coordinator retains child
widgets, approved irreversible call stores the same record as the page's own
button (quoteId `QUOTE-[0-9A-F]{8}`, total, items).

Two failures found and fixed during this run, both in the build, not
papered over:

1. `script.js` `issueQuote()` moved focus to the confirmation section.
   The template rule is that a website tool call must not move focus, so
   the `confirmation.focus()` call was removed; the confirmation section is
   still unhidden and visible in the page flow.
2. The CRUSE widget test asserted wire-format guidance in the
   `render_cruse` tool schema; this runtime keeps that guidance in the
   system prompt instead, so the test now asserts what the runtime actually
   tells the model (`ONE consolidated form`, `CRUSE forms remain available`,
   `Widgets submitted through this tool are preserved`). The same test also
   had a variable-shadowing bug (a local `presentation` holding the tool
   schema shadowed the presentation object sent to `render_cruse`); fixed by
   renaming to `presentationSchema`. The trace of the dispatched tool call
   exposed it.

## T3 — Headless-browser verification: PASS

```shell
node verify/cabinet-browser-verify.mjs
```

Script: `verify/cabinet-browser-verify.mjs` (serves `app/` on port 8081 via
the skill's `serve_site.mjs`, Playwright-core + cached Chromium).
Exit code 0, `"passed": true`. Full JSON output is printed by the script;
the key results:

- Console errors: `[]`. Page errors: `[]`. Failed requests: `[]`.
  External requests: `[]` (zero requests left the local origin).
- Boot: status `Assistant needs your AI provider key. Add it in AI model
  settings below.` (no key supplied — boot succeeded, chat waits for a key);
  `window.__cabinet.engine` exists.
- Manifest: 1 network, front `cabinet_coordinator`, 4 agent tools,
  peer policy closed, router Otari `https://api.otari.ai/api/v1`.
- Network JSON: 3 tools (`cabinet_coordinator`, `catalog_specialist`,
  `quote_specialist`), model `alibaba/qwen3.8-flash`, max steps 12,
  CRUSE v1.
- Bridge: `bridge/action-bridge.html` HTTP 200,
  `bridge/bridge-actions.js` HTTP 200 and names `query_catalog`.
- Discovery: `.well-known/nsdeploy.json` parses, exports
  `cabinet_studio_assistant` / `cabinet_coordinator`.
- Scripted-model turn through the booted engine (`engine.top.llm`
  stubbed): `website_add_to_quote` (wardrobe-120 ×1) — quote total in the
  DOM `¥0.00` → `¥3,280.00`, state total 328000 cents, 2 model calls.
- `issue_quote`, declined: dialog `dialog.assistant-review` opened with
  title `Issue this quote?`, details `1 × 分段式衣柜 120（胡桃木） —
  ¥3,280.00`, Total `¥3,280.00`, Name `Test Visitor`, buttons
  `Issue the quote` / `Don't issue it`. After clicking `Don't issue it`:
  agent answer `Quote not issued (cancelled).`, quote total unchanged
  (328000), 1 line, `lastQuote` null, confirmation still hidden.
- `issue_quote`, confirmed: same dialog, clicked `Issue the quote`.
  Agent answer `Quote issued: QUOTE-B4905E8C.` (quoteId differs per run),
  quote total 0, 0 lines, `lastQuote` total 328000, confirmation section
  visible with `Test Visitor，你的报价单 QUOTE-B4905E8C 已出。这只是演示报价，不收款、不下单。`

One probe error in the script itself, fixed and re-run: the first bridge
check looked for `query_catalog` in the generated bridge HTML shell, which
names no action; the shared action is registered by `bridge-actions.js`.
The check now fetches that file. The product was not at fault.

## Not verified

- No live LLM call: the model was stubbed in both the Node tests and the
  browser verification, exactly as the minimal-site capability test did.
  A real key in **⚙ AI model settings** has not been tried.
- No peer-site loading: `peer_policy` is closed and `allowed_peers` is
  empty, so there is no partner to load. The bridge was fetched over HTTP
  and its shared action proven by the Node test, but no other site has
  called this network through the bridge in a browser.
- No MCP calls: `agent_mcp.available` is false by design (static bundle;
  a public MCP facade needs an application host).
- No public hosting, repo push, Devpost submission, or video: out of scope
  for this build task.
