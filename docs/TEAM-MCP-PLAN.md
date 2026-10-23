# Remote Admin API extension

The requested implementation extends the existing MIT server and preserves its
tools, client-credentials refresh and modern/legacy MCP compatibility. No new
AI agent is built. One shared bearer key authorizes the team's granted Admin
API operations. Actual merchant scopes and Shopify plan restrictions remain
separate from the server's available tool definitions.

Use API 2026-10, the latest stable version at this implementation. Bundle the
public introspected schema and validate every GraphQL document and variables
before dispatch. Keep read-only exposure fail-closed and reject mutations at
the API boundary, including generic documents with multiple operations.

Remote startup requires MCP_API_KEY and client credentials; no static token.
Protect every /mcp request before CORS/body parsing, require header bearer auth,
remove URL keys, keep Host/Origin checks, make /health return only status, and
redact credentials from logs and tool errors. Tokens stay in memory remotely.

Add analytics, discount lifecycle, fulfillment/tracking, cancel/refund/note/tags,
pages/blogs/articles/menus, redirect update, theme reads, shipping reads, shop
and policy reads, and a generic graphql_admin tool. Variables carry all input;
no caller data is interpolated into document text. Return native pagination.
No live refund, cancellation, fulfillment, content or customer mutation is used
as a verification test.

- [x] Inspect upstream and baseline (136 tests), account access and requirements.
- [x] Fork under the approved Tech account; preserve MIT and upstream history.
- [x] Obtain the 2026-10 schema without customer/order data.
- [x] Write failing auth/read-only/schema/redaction and new-tool behavior tests.
- [x] Implement guarded access, new tools and schema checks; pin dependencies.
- [x] Run baseline, new tests, protocol tests, schema audit and security review.
- [ ] Build the Docker image; deploy with Dockerfile/railway.json when funded
  Railway access and the owner's installed app credentials are available.
- [ ] Verify health, 401, authenticated tool list/shop and actual ShopifyQL;
  report any provider denial rather than substituting or inventing a pass.
- [ ] Document all tools/scopes, secret rotation/revocation, deployment receipt,
  project handoff and recoverable source; do not print credentials.

Deployment requires an installed merchant-organization app and an active funded
Railway workspace. Shopify's plan and protected-data rules must be checked
against the actual app; no plan upgrade is performed by this server.

Local verification: 157 unit tests, seven protocol tests, 140 static schema
checks and the production Docker image with a synthetic provider. Inspector
lists the catalog with zero schema errors (free-form GraphQL input objects
produce 18 portability warnings); shop_info succeeds. The ten eval scenarios
are supplied in evals.xml. Destructive evals are not run on a live merchant.
No independent model task-completion score or public deployment is claimed.
