// Local workerd smoke-test entry point; never used by production wrangler.jsonc.
import "./shopify-fetch.mjs";
import worker, { ShopifyMcpHost as Host } from "../../cloudflare/worker.mjs";

// Force a same-isolate reconstruction in tests, without a production endpoint.
export class ShopifyMcpHost extends Host {
  resetForTest() {
    this.ctx.abort("Test-only host reconstruction");
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/__test/reset-host") {
      if (
        request.method !== "POST" ||
        request.headers.get("Authorization") !== "Bearer " + env.MCP_API_KEY
      )
        return new Response("Unauthorized", { status: 401 });
      try {
        await env.SHOPIFY_MCP_HOST.getByName("merchant").resetForTest();
      } catch {
        // abort intentionally disconnects the RPC response.
      }
      return Response.json({ reset: true }, { status: 202 });
    }
    return worker.fetch(request, env);
  },
};
