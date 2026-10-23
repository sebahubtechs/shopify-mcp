import { bearerAuthorized } from "./adminSecurity.js";
export type WorkerSecrets = {
  MCP_API_KEY?: string;
  MCP_BOT_API_KEY?: string;
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
};
/** Edge guard runs before any Durable Object or Shopify request. */
export function workerRequestGate(
  request: Request,
  env: WorkerSecrets,
): Response | null {
  const path = new URL(request.url).pathname;
  const reply = (error: string, status: number) =>
    Response.json(
      { error },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
        },
      },
    );
  if (
    path === "/health" &&
    (request.method === "GET" || request.method === "HEAD")
  )
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  const mcp = path === "/mcp" || path === "/messages";
  const upload = /^\/uploads\/shopify-files\/[a-f0-9-]{36}$/.test(path);
  if (!mcp && !upload) return reply("Not found", 404);
  if (!env.MCP_API_KEY?.trim() || env.MCP_API_KEY.trim() !== env.MCP_API_KEY)
    return reply("Service configuration incomplete", 503);
  if (
    mcp &&
    !bearerAuthorized(
      request.headers.get("Authorization") || undefined,
      env.MCP_API_KEY,
    ) &&
    !bearerAuthorized(
      request.headers.get("Authorization") || undefined,
      env.MCP_BOT_API_KEY || "",
    )
  )
    return reply("Unauthorized", 401);
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET)
    return reply("Shopify app setup incomplete", 503);
  return null;
}
