
```
███████╗██╗  ██╗ ██████╗ ██████╗ ██╗███████╗██╗   ██╗    ███╗   ███╗ ██████╗██████╗ 
██╔════╝██║  ██║██╔═══██╗██╔══██╗██║██╔════╝╚██╗ ██╔╝    ████╗ ████║██╔════╝██╔══██╗
███████╗███████║██║   ██║██████╔╝██║█████╗   ╚████╔╝     ██╔████╔██║██║     ██████╔╝
╚════██║██╔══██║██║   ██║██╔═══╝ ██║██╔══╝    ╚██╔╝      ██║╚██╔╝██║██║     ██╔═══╝ 
███████║██║  ██║╚██████╔╝██║     ██║██║        ██║       ██║ ╚═╝ ██║╚██████╗██║     
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝        ╚═╝       ╚═╝     ╚═╝ ╚═════╝╚═╝     
```

# Shopify MCP

A Model Context Protocol (MCP) server that connects agents to the Shopify Admin GraphQL API. Use it to browse, edit, and clean up store data via a curated set of tools.

This is the `sebahubtechs` fork. Deploy this checkout for the extensions below;
the upstream npm release does not include these unpublished fork changes.

**Upstream npm:** `@benwmerritt/shopify-mcp`
**binary:** `shopify-mcp`

This project started from Ge Li's [shopify-mcp](https://github.com/GeLi2001/shopify-mcp). The unscoped `shopify-mcp` package on npm is theirs and does not include the changes in this repository.

## Highlights

- CRUD for products, collections, orders, and customers
- Draft orders for quotes, manual orders, and B2B pricing
- Inventory and location lookups for stock workflows
- Metafields for custom data
- Metaobject entry creation and lookup for existing definitions
- URL redirects management
- OAuth login flow with local token caching
- Bulk product cleanup utilities
- Fail-closed read-only mode for audit and QA agents

## Prerequisites

- Node.js 20+
- A Shopify custom app (OAuth or Admin API token)

## Local setup (this repo)

Use this when you want to run the MCP server from this local checkout instead of a remote deployment.

1. Install dependencies and build:

```bash
npm install
npm run build
```

2. Create local env config:

```bash
cp .env.example .env
```

Set at least:
- `MYSHOPIFY_DOMAIN=your-store.myshopify.com`
- Either:
  - `SHOPIFY_CLIENT_ID=...` and `SHOPIFY_CLIENT_SECRET=...` for a Dev Dashboard app owned by the store's organization; or
  - `SHOPIFY_ACCESS_TOKEN=shpat_xxx` for a static/manual token
- `REMOTE_MCP=false`

3. Start local MCP (stdio):

```bash
npm run start:local
```

`start:local` uses stdio mode. Remote mode is only enabled with `--remote` or `REMOTE_MCP=true`.

### Read-only mode

Start a capability-restricted server for QA, audit, and reporting agents:

```bash
shopify-mcp --read-only --domain=<YOUR_SHOP>.myshopify.com
# or
SHOPIFY_MCP_READ_ONLY=true npm run start:local
```

Read-only mode exposes only a reviewed allowlist of lookup and reporting tools.
All mutating, mixed read/write, file-upload, and unknown future tools are hidden.
The allowlist is fail-closed, so a newly added tool does not appear in a
read-only instance until it is explicitly reviewed. `get-status` reports the
effective access mode, whether the boundary is enforced, and whether write
tools are exposed.

Use a least-privilege Shopify token as well when one is available. The server
boundary is designed to remain useful when a deployment must temporarily share
an existing token: agents connected to the read-only MCP instance cannot call
the hidden mutation tools.

## Install + run

### Client credentials (same Shopify organization)

For a Dev Dashboard app installed on a store owned by the same Shopify
organization, configure:

```bash
MYSHOPIFY_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your-client-id
SHOPIFY_CLIENT_SECRET=your-client-secret
```

No callback URL or browser consent is required. The MCP obtains Shopify's
24-hour access token at startup, caches it per permanent MyShopify domain in
`~/.shopify-mcp/tokens.json`, and renews it automatically before expiry.
Cached tokens include the client ID so a token created by a different app is
never silently reused after an app cutover.

Shopify does not allow this grant for public or custom-distribution apps on
stores owned by another organization; use the authorization-code flow below
for those apps.

### Authorization-code OAuth

1. Create a custom app and copy **Client ID** and **Client Secret**.
2. In **App setup**, set **App URL** and **Allowed redirection URLs** to:
   `http://localhost:3456/callback`
3. Start the OAuth flow:

```bash
npx @benwmerritt/shopify-mcp --oauth --domain=your-store.myshopify.com --clientId=xxx --clientSecret=yyy
```

Tokens are stored at `~/.shopify-mcp/tokens.json`. After that, start the server with just the domain:

```bash
npx @benwmerritt/shopify-mcp --domain=your-store.myshopify.com
```

Optional: override scopes with `--scopes` or `SHOPIFY_SCOPES`.

### Access token (manual)

1. Create a custom app in Shopify
2. Enable Admin API scopes:
   - `read_products`, `write_products`
   - `read_customers`, `write_customers`
   - `read_orders`, `write_orders`
   - `read_draft_orders`, `write_draft_orders`
   - `read_inventory`, `write_inventory`
   - `read_locations`
   - `read_content`, `write_content`
   - `read_files`, `write_files`
3. Install the app and copy the Admin API access token

Run:

```bash
shopify-mcp --accessToken=<YOUR_ACCESS_TOKEN> --domain=<YOUR_SHOP>.myshopify.com
```

## MCP client setup

### Claude Desktop (local repo build)

Build first (`npm run build`), then point Claude Desktop at this repo's built entrypoint:

```json
{
  "mcpServers": {
    "shopify-local": {
      "command": "node",
      "args": [
        "/absolute/path/to/shopify-mcp/dist/index.js",
        "--domain",
        "your-store.myshopify.com"
      ],
      "env": {
        "SHOPIFY_ACCESS_TOKEN": "shpat_xxx",
        "REMOTE_MCP": "false"
      }
    }
  }
}
```

If you completed OAuth locally, remove `SHOPIFY_ACCESS_TOKEN` and keep `--domain`.

### Claude Desktop (npm package)

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": [
        "@benwmerritt/shopify-mcp",
        "--accessToken",
        "<YOUR_ACCESS_TOKEN>",
        "--domain",
        "<YOUR_SHOP>.myshopify.com"
      ]
    }
  }
}
```

If you completed OAuth, omit `--accessToken` and keep `--domain`.

Config paths:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

### Remote MCP on Cloudflare

The merchant's selected host is Cloudflare Workers. Follow the complete
[Cloudflare deployment and Grok connection guide](docs/CLOUDFLARE.md), including
private secrets, an isolated account, public configuration and live acceptance.
Use the existing bot/team; no new AI agent is created. The complete
[104-tool catalog](docs/TOOLS.md) lists the remote interface.

### Standalone Node/container hosting (upstream alternative)

The following upstream container route remains available to other deployments;
the merchant's Cloudflare deployment does not use Railway.


This Tech fork adds Admin API 2026-10 tools, schema validation and mandatory
remote authentication. The complete [tool catalog](docs/TOOLS.md) lists every
remote tool. Read [SECURITY.md](SECURITY.md) before sharing the connection.

1. From your store admin, open Settings → Apps → Develop apps → Build apps in
   Dev Dashboard. Create the app in the **store's own organization**, configure
   its scopes, release a version and install it on that store. An app in a
   different organization can fail with `shop_not_permitted`.
2. Create a Railway service from this repository. Railway uses `Dockerfile` and
   `railway.json`. Privately set these service Variables:

   ```text
   MYSHOPIFY_DOMAIN=your-store.myshopify.com
   SHOPIFY_CLIENT_ID=<installed merchant app client ID>
   SHOPIFY_CLIENT_SECRET=<installed merchant app client secret>
   MCP_API_KEY=<private output of openssl rand -hex 32>
   ```

   Leave `SHOPIFY_MCP_READ_ONLY` unset for full granted access. **Do not set
   `SHOPIFY_ACCESS_TOKEN`.** Production remote startup refuses static tokens.
   Railway supplies `PORT`; the image sets `NODE_ENV=production`. Client
   credentials are exchanged for a 24-hour Shopify token, refreshed five
   minutes before expiry, with concurrent refreshes coalesced. Remote Shopify
   tokens stay in process memory and are not saved to disk.
3. Generate a Railway public domain. Use `https://<domain>/mcp` in your assistant,
   with `Authorization: Bearer <MCP_API_KEY>` supplied through its secure secret
   prompt. The key stays in Railway Variables and the assistant's secret store.
   This shared-key service does not implement an MCP OAuth authorization server.
4. `GET /health` is public and returns only `{"status":"ok"}`. Every `/mcp` and
   `/messages` request, including OPTIONS, requires the bearer header. Missing,
   wrong or URL-only keys return 401. An authenticated request also passes exact
   Host and Origin checks. A browser requiring an unauthenticated CORS preflight
   cannot connect directly; use a server-side assistant connector.
5. Run `MCP_URL=https://<domain>/mcp EXPECTED_SHOP_NAME=Skunkfly npm run verify:remote`
   with the key injected privately into the process environment. The read-only
   acceptance script checks health, unauthenticated 401, tools, shop, scopes and
   ShopifyQL. It reports a real ShopifyQL denial as a failure, never a fake pass.

Shopify permissions remain authoritative. `read_reports` and Level2 customer-data
access are required by `shopifyqlQuery`; Basic-plan restrictions can prevent that
acceptance check. Customer names, email and addresses can be unavailable even
when customer/order scopes are configured. Do not upgrade a plan implicitly.
Merchant-organization apps do not need separate `read_all_orders` approval;
Partner-organization apps request it under the app's API access requests. Pair
that optional scope with `read_orders`/`write_orders` and verify actual grants.
See Shopify's [scope documentation](https://shopify.dev/docs/api/usage/access-scopes)
and [custom Level2 app plan limits](https://help.shopify.com/en/manual/apps/about-apps#custom-level-2-pii-apps).

`MCP_ALLOWED_HOSTS` accepts additional exact hostnames (no scheme or port), and
`MCP_ALLOWED_ORIGINS` accepts exact browser origins. Defaults cover the resolved
public app hostname and local hosts. `X-Forwarded-Host` is not trusted. Public
URL resolution uses `PUBLIC_BASE_URL`, `APP_URL`, or Railway's public-domain
variables. Legacy SSE needs the same Authorization header; URL keys are removed.
Uploads use expiring, unguessable session URLs generated by an authenticated MCP
write tool; treat those URLs as temporary capabilities. Invalid sessions are
rejected before file reception, and received files are removed after processing.

For a local container, supply the same client credentials and key privately via
your container secret mechanism, bind only the required port, and check /health.
The production image runs as an unprivileged Node 24 user. Local stdio retains
upstream OAuth/static-token compatibility; production remote does not use it.

GraphQL cost limits and throttling are enforced by Shopify. Rate-limit failures
are returned as sanitized tool errors. The server does not automatically retry
mutations; inspect the order/job result before retrying to avoid duplicate writes.
Paginated reads expose cursors; continue only as needed. Bulk export documents
are validated separately from their enclosing mutation.

## Protocol compatibility and upgrade notes

The server uses TypeScript SDK v2 and Zod 4. Local stdio selects the protocol
from the opening message. Remote POST `/mcp` supports both MCP 2026-07-28
and older initialization-based Streamable HTTP clients. Modern requests use
`server/discover` and per-request metadata rather than an initialization session.

Existing stdio commands, Shopify credentials, token renewal, OAuth setup,
read-only flags, tool names, and legacy SSE paths remain available with mandatory bearer headers.
The same tool registrations and fail-closed allowlist serve every transport.

Compatibility limits:

- Node 18 is no longer supported by SDK v2. Upgrade Node to 20+ before updating
  this server, or retain the previous release. The Docker image uses Node 24.
- Legacy SSE uses the SDK's frozen `server-legacy` compatibility package.
  New integrations should use Streamable HTTP; the SSE bridge receives no new features.
- Legacy Streamable HTTP on POST `/mcp` is stateless, with no session ID or replay.
  GET `/mcp` without protocol/session headers remains the original SSE endpoint.
  Streamable HTTP GET and DELETE session operations are unsupported. A reconnect
  to legacy SSE creates a new connection, as before.
- Browser clients from other origins must configure `MCP_ALLOWED_ORIGINS`.
  API-key authentication remains separate from Shopify OAuth and does not provide
  automatic MCP OAuth discovery or token issuance.

Run `npm test -- --runInBand` for the application suite and
`npm run test:connections` for built-server connection and security tests.
Connection tests use pinned SDK v1.32.2 and v2.4.0, explicitly pin modern clients to
2026-07-28, compare tool catalogs, and mock Shopify calls without store access.
See [the research notes](docs/mcp-sdk-v2-research.md) for official sources and migration details.

## Tool catalog

### Products
- `products` — unified lookup/search/filter. Pass `id` for a single product; omit `id` to list/search with filters (`title`, `status`, `vendor`, `tag`, inventory, dates, `hasImages`, …). Returns the product's Shopify Standard Product Taxonomy `category` (`{id, name, fullName}`) in `slim`/`standard`/`full`. Page size capped at 100.
- `create-product`
- `update-product` — accepts `category` (Shopify Standard Product Taxonomy GID, `vp-*` prefix); the tool verifies the category actually stuck and throws a loud, actionable error if Shopify silently rejected the GID, instead of leaving you with a null `category`. Also takes `cost` (cost per item, on the simple form or per entry in `variants`; the response includes `cost` only when one was written, since reading it needs `read_inventory`; without that scope the write still succeeds and the response carries a `warnings` entry instead) and `renameOption: {from, to}` to rename a product option in place without touching variant IDs (send it on its own; it cannot be rolled back if a later write fails).
- `delete-product`
- `delete-variant`
- `delete-product-images`
- `bulk-update-products`
- `bulk-delete-products`
- `count-products-by-tag`
- `find-products-by-metafield` — list products that have / don't have / both for a given `namespace.key`, paginated across the whole catalog via cursor
- `search-taxonomy` — browse Shopify's product category taxonomy; set `includeAttributes:true` to also return each category's attributes (e.g. Color, Pattern) and their allowed values

### Collections
- `get-collections`
- `manage-collection-products`
- `create-collection`
- `update-collection`
- `delete-collection`

### Customers
- `get-customers` (supports pagination via `cursor`)
- `update-customer`

### Orders
- `orders` — unified lookup/list. Pass `id` for a single order; omit `id` to list with filters (`customerId`, `status`, pagination via `cursor`). Replaces `get-orders`, `get-order-by-id`, and `get-customer-orders`.
- `update-order`

### Draft Orders
- `draft-orders` — unified lookup/list. Pass `id` for a single draft order; omit `id` to list with filters (`status`, `query`, pagination via `cursor`).
- `create-draft-order`
- `update-draft-order`
- `complete-draft-order`

### Inventory
- `get-inventory-levels`
- `update-inventory`

### Locations
- `get-locations`

### Metafields
- `get-metafields` — server-side filter with `key`+`namespace` (single field) or `keys: ["namespace.key", …]` (multi) via Shopify's native `metafields(keys:)`; set `includeDefinitions:true` to merge ALL definitions with current values so empty/unfilled fields show up (`value:null`, `isSet:false`)
- `set-metafield` (create or update; supports `metaobject_reference` / `list.metaobject_reference`)
- `bulk-set-variant-metafields` — set metafields across many variants of one product in a single `productVariantsBulkUpdate` call (up to 250 variants/call). UNIFORM mode (`metafields`) fans one value out to every variant and auto-discovers the variant IDs; PER-VARIANT mode (`variants`) sets different values per variant. Avoids one `set-metafield` call per variant.
- `delete-metafield`
- `list-metafield-definitions` — discover metafield definitions for an owner type (PRODUCT, ORDER, CUSTOMER, …); each entry now includes `constraints` (e.g. `{key:"category", values:["vp-2","vp-2-2-3", …]}`) so agents can see category-gating *before* writing (e.g. `vehicle_*` requires `vp-2*` Vehicle categories; values on disallowed categories are silently filtered out by Shopify on read).
- `get-metafield-options` — resolve a metafield's selectable options in one call (for metaobject-reference fields, returns the available metaobject entries; for choice-lists, the allowed choices)

### Metaobjects
- `list-metaobject-definitions`
- `get-metaobject-definition`
- `create-metaobject` — optional `status` (`ACTIVE`/`DRAFT`); defaults to Shopify's `DRAFT` for publishable definitions, pass `ACTIVE` to publish on create
- `update-metaobject` — edit fields on an existing entry (only provided keys change); optional `status` to publish (`ACTIVE`) or unpublish (`DRAFT`)
- `delete-metaobject`
- `list-metaobjects` — returns `status` per entry; optional `status` filter (applied client-side to the fetched page)
- `get-metaobject` — returns the entry's publish `status`

### Files
- `get-files` — list/search files in the store
- `attach-file-to-product` — attach an existing media file to a product
- `detach-file-from-product` — remove a media file from a product
- `create-file-upload-session` — start a browser upload session (**remote mode only**)
- `get-file-upload-session` — check an upload session (**remote mode only**)

### URL redirects
- `get-redirects`
- `create-redirect`
- `delete-redirect`

### Analytics
- `get-store-counts` - Get all key counts in one call (products, variants, orders, customers, collections)
- `get-product-issues` - Audit products for problems (zero inventory, low stock, missing images, zero price)

### Bulk Operations
- `start-bulk-export` - Start async bulk export (products, orders, customers, inventory, or custom query)
- `get-bulk-operation-status` - Check progress of bulk operation
- `get-bulk-operation-results` - Download and parse completed results (summary, sample, or full)

### Server
- `get-status` - Report MCP server status, configured store, and connection health

## Debugging

Tail Claude Desktop logs:

```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

## License

MIT
