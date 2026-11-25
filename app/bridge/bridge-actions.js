// The actions this site shares with other agent sites, through its action bridge.
// The build names this file in bridge/agent-manifest.json. When another site's assistant
// calls this site, the bridge loads it in a hidden frame on this site's origin, which has
// no page. Only the names in the manifest's "actions.agentTools" reach a partner's agents.
//
// This site shares one read: the public demo catalog. It reads nothing from the page
// (the frame has none) and nothing that belongs to one visitor, such as a quote.
// No write is shared.
import catalogData from "../catalog.json" with { type: "json" };

/**
 * Shares this site's public catalog read with the partner sites that call its network.
 *
 * A partner's agent calls it from the partner's page. The read runs here, in a hidden
 * frame on this site's origin, with this site's own data.
 */
class BridgeActions {
  /**
   * The sites allowed to call this read. "*" shares it with every site on the web:
   * it is used here only because the read returns facts the public page already shows
   * (the demo catalog with prices). No visitor data is shared.
   */
  static CALLERS = ["*"];

  /**
   * Register the shared read.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    actions.register(BridgeActions.queryCatalogAction());
  }

  /**
   * Describe the shared read of the site's demo catalog.
   *
   * :return: The action definition.
   */
  static queryCatalogAction() {
    return {
      // The page's own action has the same name and input, so the network's instructions
      // fit both.
      name: "query_catalog",
      description: "Read the public demo cabinet catalog (8 items with dimensions, materials and CNY prices). Changes nothing. Call it before answering about cabinets or prices.",
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.CALLERS,
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: BridgeActions.queryCatalog,
    };
  }

  /**
   * Return the catalog as plain JSON data.
   *
   * :return: The catalog, currency and demo marker. No quote, no draft, no visitor data.
   */
  static queryCatalog() {
    return {
      catalog: catalogData.items.map(item => ({ ...item })),
      finishes: catalogData.finishes.map(finish => ({ ...finish })),
      extras: catalogData.extras.map(extra => ({ ...extra })),
      currency: catalogData.currency,
      demo: true,
    };
  }
}

// The bridge calls the module's registerActions export.
export const registerActions = BridgeActions.registerActions;
