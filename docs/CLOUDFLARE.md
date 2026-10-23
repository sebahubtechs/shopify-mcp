# Cloudflare deployment and Grok connection

The merchant deployment uses an existing Cloudflare Workers account. Railway
is not required. Keep the dedicated Shopify app in the store's merchant
organization and use client credentials, never a static Admin access token.

## Deploy

1. Install pinned dependencies with `npm ci --ignore-scripts`. Verify the intended
   Cloudflare account with `wrangler whoami` using your isolated CLI profile.
2. Deploy `wrangler.jsonc` with explicit public configuration on every deploy:

   ```sh
   npm run deploy:cloudflare -- \
     --var MYSHOPIFY_DOMAIN:your-store.myshopify.com \
     --var PUBLIC_BASE_URL:https://your-worker.your-subdomain.workers.dev
   ```

   Use the intended account through your local deployment environment. Do not
   put operator credentials in source. These two public vars must be supplied
   again when deploying; secret bindings remain private and are preserved.
3. In the Worker's Settings → Variables and Secrets, add **encrypted Secrets**
   `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` and `MCP_API_KEY`. Generate the last
   privately with `openssl rand -hex 32`. Keep its recovery copy in your secret
   manager; Cloudflare does not reveal a saved secret value afterward. Never put
   credentials in plain text vars, CLI arguments, Git, URLs, messages or logs.
   An optional encrypted `MCP_BOT_API_KEY` accepts a separate bot credential
   without replacing the required primary key. It uses the same Bearer header
   and granted permissions. Remove that Secret to revoke the bot independently.
4. Leave `SHOPIFY_MCP_READ_ONLY` unset/false for full granted access. Do not set
   `SHOPIFY_ACCESS_TOKEN`. Keep `NODE_ENV=production`, `REMOTE_MCP=true` and
   `SHOPIFY_MCP_WORKER=true` from the checked-in configuration.
5. Verify `/health`, missing-key401, authenticated tools, `shop_info` and
   `shopifyql_query` using `scripts/verify-remote.mjs`. A real ShopifyQL denial
   is a failed acceptance check, even if all other tools work. Check actual
   scopes with `shop_info`; do not infer grants from requested configuration.

The API key is checked at the edge before dispatch to a Durable Object. That
object runs the same authenticated Express/MCP implementation, preserving legacy
SSE sessions and the 104-tool remote catalog. Shopify tokens remain in memory,
with the same automatic renewal. The Node HTTP listener starts once per isolate;
reconstructed Durable Objects reuse it, avoiding a duplicate port binding after
idle eviction. Upload metadata is restored for each reconstructed object. Object
storage contains only temporary browser
upload-session metadata; it contains no Shopify access token or client secret.
Upload capabilities survive eviction and expire on access. An interrupted upload
is marked failed with instructions to inspect Shopify Files before retrying.

Browser file uploads are capped at10MiB to bound Workers' memory use. For larger
files, use Shopify's staged-upload APIs through `graphql_admin`, with the bytes
sent directly to Shopify's returned upload target. Local filesystem uploads are
not exposed remotely. Worker logs/observability are disabled by default; do not
add raw request, response, header or customer-data logging.

## Grokbot / shared team connection

In the appropriate Grok workspace, open Connectors → New Connector → Custom.
Enter `https://your-worker.your-subdomain.workers.dev/mcp` and configure the
`Authorization` header as `Bearer <private MCP_API_KEY>` using its secure secret
field. Use Streamable HTTP. Do not append the key to the URL. Verify the tool
catalog and the exact shop with `shop_info` before enabling the connector for
its intended bot/team. Do not substitute a Shopify token for the MCP key.

Every person using this shared connection has the same granted store rights.
There is no individual revocation or attribution. Start with read tools; tool
installation does not itself authorize a bot to issue refunds, cancel orders,
publish content or change fulfillment without the team's operating instructions.
Use the existing bot; this deployment does not build or publish a new AI agent.

Official references: [Grok connectors](https://docs.x.ai/grok/connectors),
[Cloudflare Express support](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/),
[Shopify client credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant).
