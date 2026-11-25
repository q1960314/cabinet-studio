// Registers this website's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
//
// Operations return {ok: false, reason} when they refuse input, before changing
// anything, and throw only on unexpected failures. A throw is reported as "unknown".
// Import the page script by the same URL the page uses (no ?v= query), or the actions
// get a second, separate copy of the page state.
import { App } from "./script.js";

/**
 * Describes the site's operations as actions the agents can call.
 *
 * Each action wraps a function the page already uses, so the assistant and the manual
 * UI share one set of rules. The runtime validates arguments against inputSchema before
 * execute runs, and asks the visitor to confirm "irreversible" actions first.
 */
class SiteActions {
  /**
   * Register every site action with the runtime.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register(SiteActions.queryCatalogAction());
    actions.register(SiteActions.configureCabinetAction());
    actions.register(SiteActions.addToQuoteAction());
    actions.register(SiteActions.issueQuoteAction());
  }

  /**
   * Describe the read action that returns the page's data and current state.
   *
   * :return: The action definition.
   */
  static queryCatalogAction() {
    return {
      name: "query_catalog",
      description: "Read the actual cabinet catalog (8 demo items with dimensions, materials and CNY prices), the current configuration draft, the quote, its version and the latest issued quote on this page. Call it before answering about cabinets, prices or the quote, and again in each turn that needs it: the visitor can also use the page.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: () => App.page.getState(),
    };
  }

  /**
   * Describe the configuration write.
   *
   * :return: The action definition.
   */
  static configureCabinetAction() {
    return {
      name: "configure_cabinet",
      description: "Call it only when the visitor asks, with an id from website_query_catalog. Set the visible configuration draft for one cabinet: pick a finish and extras, and get the computed unit price back. Returns the updated state, or ok false with a reason. Does not touch the quote.",
      // "write" runs immediately. Use it only for changes the visitor can undo on the page.
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["itemId"],
        properties: {
          itemId: {
            type: "string",
            enum: App.page.catalogIds(),
            description: "Cabinet id from website_query_catalog.",
          },
          finish: {
            type: "string",
            enum: ["walnut", "white-oak", "matte-white", "dark-walnut"],
            description: "Finish: walnut (default), white-oak, matte-white, or dark-walnut (+¥120).",
          },
          extras: {
            type: "array",
            items: { type: "string", enum: ["led", "socket", "hinge"] },
            description: "Extras: led (LED light strip +¥180), socket (track socket +¥260), hinge (soft-close hinges +¥90).",
          },
        },
      },
      execute: ({ itemId, finish, extras }) => App.page.configureCabinet(itemId, { finish, extras }),
    };
  }

  /**
   * Describe the quote write.
   *
   * :return: The action definition.
   */
  static addToQuoteAction() {
    return {
      name: "add_to_quote",
      description: "Call it only when the visitor asks, with an id from website_query_catalog. Add a quantity of one configured cabinet to the visible quote, keeping existing lines. Returns the updated state with the new quote version, or ok false with a reason. Does not issue a quote.",
      // "write" runs immediately. Use it only for changes the visitor can undo on the page.
      effect: "write",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["itemId", "quantity"],
        properties: {
          itemId: {
            type: "string",
            enum: App.page.catalogIds(),
            description: "Cabinet id from website_query_catalog.",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            description: "How many to add.",
          },
          finish: {
            type: "string",
            enum: ["walnut", "white-oak", "matte-white", "dark-walnut"],
            description: "Finish: walnut (default), white-oak, matte-white, or dark-walnut (+¥120).",
          },
          extras: {
            type: "array",
            items: { type: "string", enum: ["led", "socket", "hinge"] },
            description: "Extras: led (+¥180), socket (+¥260), hinge (+¥90).",
          },
        },
      },
      execute: ({ itemId, quantity, finish, extras }) =>
        App.page.addToQuote(itemId, quantity, { finish, extras }),
    };
  }

  /**
   * Describe the irreversible operation that the visitor must confirm.
   *
   * :return: The action definition.
   */
  static issueQuoteAction() {
    return {
      name: "issue_quote",
      description: "Issue the quote for the current quote lines. First ask for the visitor's name. In the turn you call it, first call website_query_catalog and wait for its result: this needs its current quoteVersion, and results from earlier turns are not kept. The browser asks the visitor to confirm. The site refuses a stale expectedQuoteVersion or an empty quote. Returns the issued quote receipt with a QUOTE- id.",
      // "irreversible" makes the runtime open a confirmation dialog before execute runs.
      effect: "irreversible",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["customerName", "expectedQuoteVersion"],
        properties: {
          customerName: {
            type: "string",
            minLength: 1,
            maxLength: 80,
            description: "The name the visitor gave.",
          },
          expectedQuoteVersion: {
            type: "integer",
            minimum: 0,
            description: "The latest quoteVersion in this turn: from website_query_catalog, or from a quote change made after that read.",
          },
        },
      },
      execute: ({ customerName, expectedQuoteVersion }) =>
        App.page.issueQuote({ customerName, expectedQuoteVersion }),
    };
  }
}

// The runtime calls the module's registerActions export.
export const registerActions = SiteActions.registerActions;
