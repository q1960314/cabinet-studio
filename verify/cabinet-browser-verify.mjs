// Browser verification for ~/workspace/open-agentic-web/app/ (Cabinet Studio)
// Proves, in a real headless Chromium: page loads with zero console errors,
// agent-manifest.json + network .json + bridge + discovery fetch and parse,
// runtime boot() succeeds (no key: status asks for one), and scripted-model
// turns through the BOOTED engine (window.__cabinet.engine, llm stubbed at
// the top seam) call website_add_to_quote and visibly change the quote,
// then issue_quote opens the confirmation dialog: declining cancels it and
// changes nothing, confirming issues the quote and clears it.
// No live LLM call: the model is stubbed, same as the Node tests.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const SITE = new URL("../app/", import.meta.url).pathname;
const PORT = 8081;
const ORIGIN = `http://localhost:${PORT}`;
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;

const evidence = { consoleErrors: [], pageErrors: [], failedRequests: [], externalRequests: [] };

function startServer() {
  const server = spawn("node", [
    new URL("../spec-repo/skills/agentify-website/scripts/serve_site.mjs", import.meta.url).pathname,
    SITE, "--port", String(PORT),
  ], { stdio: ["ignore", "pipe", "pipe"] });
  return server;
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${ORIGIN}/agent-manifest.json`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("server did not come up on port 8081");
}

const server = startServer();
let browser;
try {
  await waitForServer();

  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", msg => { if (msg.type() === "error") evidence.consoleErrors.push(msg.text()); });
  page.on("pageerror", err => evidence.pageErrors.push(String(err)));
  page.on("requestfailed", req => evidence.failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));
  page.on("request", req => { if (!req.url().startsWith(ORIGIN)) evidence.externalRequests.push(req.url()); });

  await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });

  // 1. Runtime boot: site.js boots the runtime and sets this status line. With no
  // key it asks for one; that still proves boot() succeeded and the engine exists.
  await page.waitForFunction(
    () => document.querySelector("#assistant-status")?.textContent?.includes("Assistant needs your AI provider key"),
    { timeout: 15000 },
  );
  evidence.bootStatus = await page.textContent("#assistant-status");
  evidence.engineBooted = await page.evaluate(() => !!window.__cabinet?.engine);

  // 2. Public artifacts fetch and parse.
  evidence.manifest = await page.evaluate(async origin => {
    const res = await fetch(`${origin}/agent-manifest.json`);
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const json = await res.json();
    return {
      networks: json.networks.map(n => ({ name: n.name, front_man: n.front_man, hocon: n.hocon })),
      llm_router: json.llm_router,
      actions: json.actions.agentTools,
      peer_policy: json.peer_policy,
    };
  }, ORIGIN);
  evidence.network = await page.evaluate(async origin => {
    const res = await fetch(`${origin}/cabinet_studio_assistant.network.json`);
    if (!res.ok) throw new Error(`network HTTP ${res.status}`);
    const json = await res.json();
    return {
      toolCount: (json.tools || []).length,
      toolNames: (json.tools || []).map(t => t.name),
      llmModel: json.llm_config?.model_name,
      maxSteps: json.max_steps,
      cruse: json.cruse,
    };
  }, ORIGIN);
  evidence.bridge = await page.evaluate(async origin => {
    const html = await fetch(`${origin}/bridge/action-bridge.html`);
    if (!html.ok) throw new Error(`bridge HTML HTTP ${html.status}`);
    // The generated bridge shell names no action itself; bridge-actions.js (named by
    // the manifest) registers the shared action.
    const actions = await fetch(`${origin}/bridge/bridge-actions.js`);
    if (!actions.ok) throw new Error(`bridge actions HTTP ${actions.status}`);
    const text = await actions.text();
    return { htmlStatus: html.status, actionsStatus: actions.status, sharesQueryCatalog: text.includes("query_catalog") };
  }, ORIGIN);
  evidence.discovery = await page.evaluate(async origin => {
    const res = await fetch(`${origin}/.well-known/nsdeploy.json`);
    if (!res.ok) throw new Error(`nsdeploy HTTP ${res.status}`);
    return await res.json();
  }, ORIGIN);

  // 3. Agent run through the BOOTED engine, scripted model: add one wardrobe-120.
  evidence.agentRun = await page.evaluate(async () => {
    const { App } = await import("/script.js");
    const engine = window.__cabinet.engine;
    const quoteBefore = document.querySelector("#quote-total").textContent;
    let modelCalls = 0;
    engine.top.llm = { async chat({ tools, messages }) {
      modelCalls++;
      if (modelCalls === 1) {
        if (!tools.some(t => t.function.name === "website_add_to_quote")) throw new Error("website_add_to_quote not offered to model");
        return { content: "", toolCalls: [{ id: "add-1", type: "function",
          function: { name: "website_add_to_quote", arguments: JSON.stringify({ itemId: "wardrobe-120", quantity: 1 }) } }] };
      }
      const receipt = JSON.parse(messages.find(m => m.role === "tool").content);
      if (receipt.status !== "succeeded") throw new Error(`add_to_quote failed: ${messages.find(m => m.role === "tool").content}`);
      return { content: `Added one wardrobe. Quote total is ${(receipt.result.quoteTotal / 100).toLocaleString("en-US", { style: "currency", currency: "CNY" })}.`, toolCalls: [] };
    } };
    const result = await engine.runTurn("Add one wardrobe 120 to my quote");
    const state = App.page.getState();
    return {
      modelCalls,
      agentAnswer: result.text,
      quoteBefore,
      quoteAfterDom: document.querySelector("#quote-total").textContent,
      quoteLines: state.quote.length,
      quoteTotalCents: state.quoteTotal,
    };
  });

  // 4. issue_quote, declined: the dialog opens, the visitor declines, nothing changes.
  async function runIssueQuote(expect) {
    const runPromise = page.evaluate(async () => {
      const { App } = await import("/script.js");
      const engine = window.__cabinet.engine;
      const state = App.page.getState();
      let modelCalls = 0;
      engine.top.llm = { async chat({ tools, messages }) {
        modelCalls++;
        if (modelCalls === 1) {
          if (!tools.some(t => t.function.name === "website_issue_quote")) throw new Error("website_issue_quote not offered to model");
          return { content: "", toolCalls: [{ id: "issue-1", type: "function",
            function: { name: "website_issue_quote", arguments: JSON.stringify({ customerName: "Test Visitor", expectedQuoteVersion: state.quoteVersion }) } }] };
        }
        const toolMsg = messages.find(m => m.role === "tool");
        const receipt = JSON.parse(toolMsg.content);
        return { content: receipt.status === "succeeded"
          ? `Quote issued: ${receipt.result.quoteId}.`
          : `Quote not issued (${receipt.status}).`, toolCalls: [] };
      } };
      const quoteBefore = App.page.getState();
      const result = await engine.runTurn("Issue the quote for Test Visitor");
      const quoteAfter = App.page.getState();
      return {
        modelCalls,
        agentAnswer: result.text,
        quoteBeforeTotal: quoteBefore.quoteTotal,
        quoteBeforeLines: quoteBefore.quote.length,
        quoteAfterTotal: quoteAfter.quoteTotal,
        quoteAfterLines: quoteAfter.quote.length,
        lastQuote: quoteAfter.lastQuote,
        confirmationHidden: document.querySelector("#confirmation").hidden,
        confirmationSummary: document.querySelector("#quote-summary").textContent,
      };
    });
    await page.waitForSelector("dialog.assistant-review", { timeout: 15000 });
    evidence[expect === "decline" ? "dialogDecline" : "dialogConfirm"] = await page.evaluate(() => {
      const dialog = document.querySelector("dialog.assistant-review");
      return {
        title: dialog.querySelector("h2")?.textContent,
        sentence: dialog.querySelector("p")?.textContent,
        details: dialog.querySelector("dl")?.textContent,
        confirmLabel: [...dialog.querySelectorAll("button")].map(b => b.textContent),
      };
    });
    await page.click(`dialog.assistant-review >> text=${expect === "decline" ? "Don't issue it" : "Issue the quote"}`);
    return await runPromise;
  }

  evidence.issueDeclined = await runIssueQuote("decline");
  evidence.issueConfirmed = await runIssueQuote("confirm");

  evidence.passed =
    evidence.consoleErrors.length === 0 &&
    evidence.pageErrors.length === 0 &&
    evidence.failedRequests.length === 0 &&
    evidence.externalRequests.length === 0 &&
    evidence.engineBooted === true &&
    evidence.manifest.networks.length === 1 &&
    evidence.manifest.networks[0].front_man === "cabinet_coordinator" &&
    evidence.manifest.actions.length === 4 &&
    evidence.network.toolNames.length === 3 &&
    evidence.network.llmModel === "alibaba/qwen3.8-flash" &&
    evidence.agentRun.quoteBefore === "¥0.00" &&
    evidence.agentRun.quoteAfterDom === "¥3,280.00" &&
    evidence.agentRun.quoteTotalCents === 328000 &&
    evidence.agentRun.modelCalls === 2 &&
    evidence.dialogDecline.title === "Issue this quote?" &&
    evidence.issueDeclined.quoteAfterTotal === evidence.issueDeclined.quoteBeforeTotal &&
    evidence.issueDeclined.quoteAfterLines === evidence.issueDeclined.quoteBeforeLines &&
    evidence.issueDeclined.lastQuote === null &&
    evidence.issueDeclined.agentAnswer.includes("not issued") &&
    evidence.dialogConfirm.title === "Issue this quote?" &&
    evidence.issueConfirmed.quoteAfterTotal === 0 &&
    evidence.issueConfirmed.quoteAfterLines === 0 &&
    evidence.issueConfirmed.lastQuote !== null &&
    /^QUOTE-[0-9A-F]{8}$/.test(evidence.issueConfirmed.lastQuote.quoteId) &&
    evidence.issueConfirmed.lastQuote.total === 328000 &&
    evidence.issueConfirmed.confirmationHidden === false &&
    evidence.issueConfirmed.confirmationSummary.includes(evidence.issueConfirmed.lastQuote.quoteId);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.passed ? 0 : 1);
