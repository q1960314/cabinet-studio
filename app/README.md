# Cabinet Studio — agentified website

A public furniture-configuration website, agentified per MVP Profile 0.3
(`worldwide_agentic_web_mvp_spec.md` in the spec repo). A visitor chats with
the Cabinet Studio Assistant: it answers from a real product catalog,
helps configure a cabinet (finish + extras), adds items to a quote, and
confirms with the visitor before issuing the quote. The quote lives only in
page memory; there is no payment and no real order.

All prices are **demo data** in CNY, in `catalog.json`. The catalog is 8
items: wardrobes, sideboards, entry cabinet, TV cabinet, bookcase, tea
cabinet — each with dimensions, material and price.

## Run it

ES modules and `fetch` need HTTP, not `file://`. From
`~/workspace/open-agentic-web/` (the commands below assume that directory):

```shell
node spec-repo/skills/agentify-website/scripts/serve_site.mjs app --port 8081
```

Then open http://127.0.0.1:8081/. The skill's server binds to `127.0.0.1`,
so the site is not reachable from the local network. Port 8081 is used here
(the spec repo's examples use 8080); `localhost` and `127.0.0.1` are
different origins with separate saved settings.

Run the Node tests from the same directory:

```shell
node --test "app/tests/*.test.mjs"
```

## Files

- `index.html`, `styles.css`, `script.js` — the page: catalog, configure
  panel, quote panel, confirmation section, assistant section.
- `catalog.json` — the demo catalog (8 items, finishes, extras, CNY).
- `cabinet-actions.js` — the 4 site actions: `query_catalog` (read),
  `configure_cabinet` (write), `add_to_quote` (write), `issue_quote`
  (irreversible — waits for the visitor's confirmation in the page's own
  dialog).
- `site.js` — the assistant mount: greeting, dialog words for `issue_quote`,
  consent handling, and the `window.__cabinet` verification hook.
- `chat-follow.js` — chat follow behaviour (copied from the skill's example).
- `agent-manifest.json` — the manifest: brand, networks, LLM router,
  agent tools, linking, peer policy (closed), theme.
- `cabinet_studio_assistant.hocon` — the network source: 1 network, front
  agent `cabinet_coordinator`, specialists `catalog_specialist` and
  `quote_specialist`, model `alibaba/qwen3.8-flash`, max 12 steps, CRUSE v1.
- `cabinet_studio_assistant.network.json` — the built network (generated;
  rebuild with `build_network.mjs`, do not edit by hand).
- `agent-mcp.json`, `.well-known/nsdeploy.json`,
  `.well-known/nsdeploy-agent.json` — discovery files (generated).
- `links.json` — saved links (none: no partners).
- `runtime/` — the skill's runtime, copied unchanged.
- `bridge/action-bridge.html`, `bridge/bridge-actions.js` — the bridge.
  It shares exactly one read action, `query_catalog` (the public demo
  catalog only, `callerOrigins: ["*"]`). No quote, draft or visitor data
  is shared, and no write is shared.
- `bridge/agent-manifest.json` — the bridge's copy of the manifest
  (generated).
- `tests/` — `agentified.test.mjs` (22 tests: network, actions, read/write,
  irreversible confirmation, dialog, consent, CRUSE) plus the DOM and model
  stand-ins it uses.
- `favicon.svg`, `fonts/` — the walnut cabinet glyph and the bundled fonts.
- `README.md` — this file. `VERIFICATION.md` — the verification record.

## Your data leaves the page

The assistant sends the visitor's messages, and the page data it reads
(the catalog and the quote), to the LLM provider the visitor picks. The
default router is Otari (`https://api.otari.ai/api/v1`); the visitor can
pick OpenRouter or another provider in the settings panel. No API key is
hardcoded anywhere in this site: the visitor pays for the chat's model
calls with their own key (BYOK), entered in **⚙ AI model settings**.

To try it with your own key: open the site, expand **⚙ AI model
settings**, paste an API key for the site's default provider (or select
**Connect with OpenRouter** / **Connect with Otari** to sign in instead),
then select **Save and start**. Use a key with a low spending limit.
Afterwards, select **Delete setup** under **Advanced settings (optional)**
and close the tab: the tab keeps using the key until it is closed.

On `localhost` and `127.0.0.1`, the runtime also copies saved setups,
keys included, into a cookie for 180 days, so the settings follow you
across local ports. A hosted site on any other domain keeps the key in
that site's own browser storage only.

## The network

The network is `cabinet_studio_assistant`, served from this site as
`cabinet_studio_assistant.network.json` (see `agent-manifest.json`,
`linking.exports`). It calls no partners (`peer_policy` closed,
`allowed_peers` empty), so there are no linked sites and no partner cards.

Other agent sites that call this network get no site tools: their
assistant points to this site's page instead. Calling sites can read the
public catalog through the bridge (`bridge/action-bridge.html`), which
shares only `query_catalog`.
