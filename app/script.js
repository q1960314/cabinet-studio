// Cabinet Studio page state. Prices are integer cents (CNY).
// The catalog is demo data (catalog.json); the quote lives only in page memory.
import catalogData from "./catalog.json" with { type: "json" };

export const catalog = catalogData.items;
export const finishes = catalogData.finishes;
export const extras = catalogData.extras;
export const CURRENCY = catalogData.currency;

// In-memory state intentionally keeps this demo independent of a backend.
let draftConfig = null;
const quote = new Map();
let quoteVersion = 0;
let lastQuote = null;
let lineCounter = 0;

const money = (cents) => new Intl.NumberFormat("zh-CN", {
  style: "currency", currency: CURRENCY,
}).format(cents / 100);

const finishById = (id) => finishes.find(finish => finish.id === id);
const extraById = (id) => extras.find(extra => extra.id === id);
const itemById = (id) => catalog.find(item => item.id === id);

function unitPrice(item, finishId, extraIds) {
  const finish = finishById(finishId);
  const extraTotal = extraIds.reduce((sum, id) => sum + extraById(id).delta, 0);
  return item.price + finish.delta + extraTotal;
}

function configKey(itemId, finishId, extraIds) {
  return [itemId, finishId, [...extraIds].sort().join("+")].join("|");
}

function configSummary(line) {
  const finish = finishById(line.finish).name;
  const extraNames = line.extras.map(id => extraById(id).name);
  return [finish, ...extraNames].join("＋");
}

// Use textContent for data, including visitor input in the confirmation.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, label, action) {
  const node = element("button", text);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", action);
  return node;
}

function renderCatalog() {
  const list = document.querySelector("#catalog-items");
  for (const item of catalog) {
    const article = element("article", undefined, "catalog-item");
    const heading = element("div", undefined, "item-heading");
    heading.append(element("h3", item.name), element("strong", money(item.price)));
    const dims = element("p", `${item.category} · ${item.widthCm}宽 × ${item.heightCm}高 × ${item.depthCm}深 cm`);
    const material = element("p", `${item.material}。${item.features}。`);
    const actions = element("div", undefined, "item-actions");
    actions.append(
      button("配置", `配置 ${item.name}`, () => App.page.configureCabinet(item.id, {})),
      button("加入报价", `把 ${item.name} 加入报价单`, () => App.page.addToQuote(item.id, 1, {})),
    );
    article.append(heading, dims, material, actions);
    list.append(article);
  }
}

function renderDraft() {
  const panel = document.querySelector("#draft-config");
  const price = document.querySelector("#draft-price");
  const addButton = document.querySelector("#draft-add");
  panel.replaceChildren();
  if (!draftConfig) {
    panel.append(element("p", "还没有配置。点目录里一件柜子的“配置”，或直接点“加入报价”。"));
    price.textContent = "";
    addButton.disabled = true;
    return;
  }
  const item = itemById(draftConfig.itemId);
  const heading = element("h3", `正在配置：${item.name}`);
  const finishLabel = element("label", "饰面");
  finishLabel.setAttribute("for", "draft-finish");
  const finishSelect = element("select");
  finishSelect.id = "draft-finish";
  for (const finish of finishes) {
    const option = document.createElement("option");
    option.value = finish.id;
    option.textContent = finish.delta ? `${finish.name}（+${money(finish.delta)}）` : finish.name;
    finishSelect.append(option);
  }
  finishSelect.value = draftConfig.finish;
  finishSelect.addEventListener("change", () => {
    draftConfig.finish = finishSelect.value;
    updateDraftPrice();
  });
  const extrasLabel = element("p", "附加：");
  const extrasBox = element("div", undefined, "extras-box");
  for (const extra of extras) {
    const label = element("label", undefined, "extra-option");
    const box = document.createElement("input");
    box.setAttribute("type", "checkbox");
    box.value = extra.id;
    box.checked = draftConfig.extras.includes(extra.id);
    box.addEventListener("change", () => {
      draftConfig.extras = Array.from(extrasBox.querySelectorAll("input:checked")).map(node => node.value);
      updateDraftPrice();
    });
    label.append(box, element("span", `${extra.name}（+${money(extra.delta)}）`));
    extrasBox.append(label);
  }
  panel.append(heading, finishLabel, finishSelect, extrasLabel, extrasBox);
  addButton.disabled = false;
  updateDraftPrice();
}

function updateDraftPrice() {
  if (!draftConfig) return;
  const item = itemById(draftConfig.itemId);
  draftConfig.unitPrice = unitPrice(item, draftConfig.finish, draftConfig.extras);
  document.querySelector("#draft-price").textContent = `单价 ${money(draftConfig.unitPrice)}`;
}

function quoteTotal() {
  return Array.from(quote.values()).reduce((total, line) => total + line.lineTotal, 0);
}

function renderQuote() {
  const list = document.querySelector("#quote-items");
  const focusedLabel = list.contains(document.activeElement)
    ? document.activeElement.getAttribute("aria-label") : null;
  list.replaceChildren();
  for (const line of quote.values()) {
    const item = itemById(line.itemId);
    const row = element("li");
    const summary = element("div", undefined, "quote-line");
    summary.append(
      element("strong", `${item.name}（${configSummary(line)}）`),
      element("span", `${line.quantity} × ${money(line.unitPrice)} = ${money(line.lineTotal)}`),
    );
    const controls = element("div", undefined, "quantity-controls");
    const remove = button("移除", `移除 ${item.name}`, () => App.page.removeFromQuote(line.lineId));
    remove.className = "remove";
    controls.append(
      button("−", `减少 ${item.name} 数量`, () => App.page.changeLineQuantity(line.lineId, -1)),
      element("span", String(line.quantity)),
      button("+", `增加 ${item.name} 数量`, () => App.page.changeLineQuantity(line.lineId, 1)),
      remove,
    );
    row.append(summary, controls);
    list.append(row);
  }
  document.querySelector("#empty-quote").hidden = quote.size > 0;
  document.querySelector("#quote-total").textContent = money(quoteTotal());
  document.querySelector("#issue-quote").disabled = quote.size === 0;
  if (focusedLabel) {
    const nextFocus = Array.from(list.querySelectorAll("button"))
      .find((node) => node.getAttribute("aria-label") === focusedLabel);
    (nextFocus || document.querySelector("#customer-name")).focus();
  }
}

function validateConfig(itemId, finish, extraIds) {
  const item = itemById(itemId);
  if (!item) return { ok: false, reason: `目录里没有 ${itemId}。` };
  const finishId = finish || "walnut";
  if (!finishById(finishId)) return { ok: false, reason: `没有 ${finish} 这种饰面。` };
  const extrasList = extraIds || [];
  if (!Array.isArray(extrasList)) return { ok: false, reason: "附加项须是一个列表。" };
  for (const id of extrasList) {
    if (!extraById(id)) return { ok: false, reason: `没有 ${id} 这种附加项。` };
  }
  if (new Set(extrasList).size !== extrasList.length) return { ok: false, reason: "附加项不要重复。" };
  return { ok: true, item, finishId, extrasList };
}

export class CabinetPage {
  getState() {
    return {
      catalog: catalog.map(item => ({ ...item })),
      finishes: finishes.map(finish => ({ ...finish })),
      extras: extras.map(extra => ({ ...extra })),
      currency: CURRENCY,
      demo: true,
      draftConfig: draftConfig ? { ...draftConfig, extras: [...draftConfig.extras] } : null,
      quote: Array.from(quote.values()).map(line => ({ ...line, extras: [...line.extras] })),
      quoteTotal: quoteTotal(),
      quoteVersion,
      lastQuote: lastQuote ? structuredClone(lastQuote) : null,
    };
  }

  catalogIds() {
    return catalog.map(item => item.id);
  }

  configureCabinet(itemId, options = {}) {
    const check = validateConfig(itemId, options.finish, options.extras);
    if (!check.ok) return check;
    draftConfig = {
      itemId,
      finish: check.finishId,
      extras: [...check.extrasList],
      unitPrice: unitPrice(check.item, check.finishId, check.extrasList),
    };
    renderDraft();
    return this.getState();
  }

  addToQuote(itemId, quantity, options = {}) {
    const check = validateConfig(itemId, options.finish, options.extras);
    if (!check.ok) return check;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return { ok: false, reason: "数量须是 1 到 100 的整数。" };
    }
    const key = configKey(itemId, check.finishId, check.extrasList);
    const existing = Array.from(quote.values()).find(line => line.key === key);
    const price = unitPrice(check.item, check.finishId, check.extrasList);
    if (existing) {
      existing.quantity += quantity;
      existing.lineTotal = existing.unitPrice * existing.quantity;
    } else {
      lineCounter++;
      quote.set(`line-${lineCounter}`, {
        lineId: `line-${lineCounter}`,
        key,
        itemId,
        name: check.item.name,
        finish: check.finishId,
        extras: [...check.extrasList],
        quantity,
        unitPrice: price,
        lineTotal: price * quantity,
      });
    }
    quoteVersion++;
    renderQuote();
    document.querySelector("#quote-status").textContent =
      `${check.item.name} 已加入报价单。合计 ${money(quoteTotal())}。`;
    return this.getState();
  }

  removeFromQuote(lineId) {
    if (!quote.has(lineId)) return { ok: false, reason: "报价单里没有这一行。" };
    quote.delete(lineId);
    quoteVersion++;
    renderQuote();
    return this.getState();
  }

  changeLineQuantity(lineId, change) {
    const line = quote.get(lineId);
    if (!line) return { ok: false, reason: "报价单里没有这一行。" };
    const quantity = line.quantity + change;
    if (quantity < 0) return { ok: false, reason: "数量不能小于 0。" };
    quoteVersion++;
    if (quantity === 0) quote.delete(lineId);
    else {
      line.quantity = quantity;
      line.lineTotal = line.unitPrice * quantity;
    }
    renderQuote();
    return this.getState();
  }

  // Read-only check for issuing a quote. site.js calls this before opening the
  // confirmation dialog; issueQuote calls it again before writing anything.
  checkQuote({ customerName, expectedQuoteVersion }) {
    if (quote.size === 0) return { ok: false, reason: "报价单是空的，先加一件柜子。" };
    if (expectedQuoteVersion !== quoteVersion) {
      return { ok: false, reason: "报价单变了，请再看一眼再出报价。" };
    }
    if (typeof customerName !== "string" || !customerName.trim() || customerName.length > 80) {
      return { ok: false, reason: "请留一个名字（80 字以内）。" };
    }
    return {
      ok: true,
      items: Array.from(quote.values()).map(line => ({
        name: line.name,
        config: configSummary(line),
        quantity: line.quantity,
        lineTotal: money(line.lineTotal),
      })),
      total: money(quoteTotal()),
    };
  }

  issueQuote({ customerName, expectedQuoteVersion }) {
    const check = this.checkQuote({ customerName, expectedQuoteVersion });
    if (!check.ok) return check;
    lastQuote = {
      quoteId: `QUOTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status: "issued",
      demo: true,
      customerName: customerName.trim(),
      items: Array.from(quote.values()).map(line => ({
        itemId: line.itemId,
        name: line.name,
        finish: line.finish,
        extras: [...line.extras],
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      total: quoteTotal(),
      currency: CURRENCY,
      issuedAt: new Date().toISOString(),
    };
    document.querySelector("#quote-summary").textContent =
      `${lastQuote.customerName}，你的报价单 ${lastQuote.quoteId} 已出。这只是演示报价，不收款、不下单。`;
    document.querySelector("#quote-lines").replaceChildren(
      ...lastQuote.items.map(line => element("li",
        `${line.quantity} × ${line.name}（${configSummary(line)}） — ${money(line.lineTotal)}`)),
    );
    document.querySelector("#quote-issued-total").textContent = `合计：${money(lastQuote.total)}`;
    quote.clear();
    quoteVersion++;
    renderQuote();
    document.querySelector("#customer-name").value = "";
    document.querySelector("#quote-error").textContent = "";
    const confirmation = document.querySelector("#confirmation");
    confirmation.hidden = false;
    return structuredClone(lastQuote);
  }
}

export const App = { page: new CabinetPage() };

function issueFromPage() {
  const name = document.querySelector("#customer-name").value;
  const result = App.page.issueQuote({ customerName: name, expectedQuoteVersion: quoteVersion });
  if (result.ok === false) {
    document.querySelector("#quote-error").textContent = result.reason;
  }
}

document.querySelector("#draft-add").addEventListener("click", () => {
  if (!draftConfig) return;
  const quantity = Number(document.querySelector("#draft-quantity").value) || 1;
  const result = App.page.addToQuote(draftConfig.itemId, quantity, {
    finish: draftConfig.finish, extras: draftConfig.extras,
  });
  if (result.ok === false) {
    document.querySelector("#quote-error").textContent = result.reason;
  }
});
document.querySelector("#issue-quote").addEventListener("click", issueFromPage);

renderCatalog();
renderDraft();
renderQuote();
