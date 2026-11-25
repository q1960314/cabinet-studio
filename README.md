# Cabinet Studio

An agentic furniture-configuration website built for the [Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/) (Cognizant, Mozilla, NANDA / MIT Media Lab, AWS, UT Austin, AI Commons).

A visitor chats with the agent; the agent answers from a real product catalog
(wardrobes, sideboards, entry cabinets, TV cabinets, bookcases, tea cabinets),
helps configure a cabinet, adds items to a quote, and issues the quote only
after the visitor confirms. The quote lives only in page memory. No payment,
no real order — a demo quote, stated on the page.

## Conformance

Built to the Open Agentic Web **MVP Profile 0.3** spec
(`docs/worldwide_agentic_web_mvp_spec.md` in
[cognizant-ai-labs/agentic-web](https://github.com/cognizant-ai-labs/agentic-web)):

- `agent-manifest.json` — public index of the site's agent network
- `cabinet_studio_assistant.network.json` — the resolved network definition
  (1 network, front agent `cabinet_coordinator`, specialists
  `catalog_specialist` / `quote_specialist`)
- `links.json` — peer-link map (peer policy closed: no partners yet)
- `runtime/` — the browser runtime from the spec repo's `agentify-website` skill
- `bridge/` — shares one read action (`query_catalog`, public catalog only)

## Try it

Live site: https://q1960314.github.io/cabinet-studio/

The agent needs a model key to chat live: open ⚙ AI model settings and add
your own key (Otari by default, or OpenRouter). Your key stays in your
browser and is sent only to the router you choose — never to this site, and
never to a peer site. No key is stored in this repo.

## Verify

- `SPEC.md` — the product spec (catalog, network, actions, acceptance T1–T8)
- `app/VERIFICATION.md` — local verification evidence (Node tests 22/22,
  headless-browser run exit 0, quote ¥0.00 → ¥3,280.00, confirmation flow)
- `REVIEW-20261125.md` — from-scratch review of the build
- `verify/cabinet-browser-verify.mjs` — the headless-browser verification script

## License

MIT. Catalog prices are demo data (CNY).
