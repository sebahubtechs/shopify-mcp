import { DurableObject } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import schema from "../schema/admin-2026-10.graphql";
import {
  setBundledAdminSchema,
  rememberSecret,
  safeErrorMessage,
} from "../dist/adminSecurity.js";
import { workerRequestGate } from "../dist/workerGate.js";
import {
  installUploadSessionPersistence,
  cleanupExpiredUploadSessions,
} from "../dist/files/uploadSessions.js";

const nodeHandler = httpServerHandler({ port: 3000 });
// The Node listener belongs to the isolate and can outlive a Durable Object.
// Reuse it after object reconstruction instead of binding the same port again.
let serverReady;
function ensureServer() {
  if (!serverReady)
    serverReady = (async () => {
      setBundledAdminSchema(schema, "2026-10");
      const { main } = await import("../dist/index.js");
      await main();
    })().catch((error) => {
      // A failed Shopify exchange must not poison future initialization.
      serverReady = undefined;
      throw error;
    });
  return serverReady;
}

// One object keeps the upstream SSE and upload-session state in one place.
// Shopify tokens remain in memory and are never written to object storage.
export class ShopifyMcpHost extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.list({ prefix: "upload:" });
      installUploadSessionPersistence([...saved.values()], (id, record) => {
        ctx.waitUntil(
          record
            ? ctx.storage.put("upload:" + id, record)
            : ctx.storage.delete("upload:" + id),
        );
      });
      cleanupExpiredUploadSessions();
      const reusedListener = !!serverReady;
      await ensureServer();
      console.info("MCP host ready", { reusedListener });
    });
  }
  async fetch(request) {
    await this.ready;
    return nodeHandler.fetch(request);
  }
}

export default {
  async fetch(request, env) {
    rememberSecret(env.MCP_API_KEY);
    rememberSecret(env.MCP_BOT_API_KEY);
    rememberSecret(env.SHOPIFY_CLIENT_SECRET);
    const rejected = workerRequestGate(request, env);
    if (rejected) return rejected;
    try {
      return await env.SHOPIFY_MCP_HOST.getByName("merchant").fetch(request);
    } catch (error) {
      console.error(
        "Worker connection initialization failed:",
        safeErrorMessage(error),
      );
      // Do not expose provider diagnostics or host internals in HTTP errors.
      return Response.json(
        { error: "Shopify connection unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
};
