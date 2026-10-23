# Security

Remote production requires a nonempty MCP_API_KEY and Shopify client credentials.
Every /mcp method requires `Authorization: Bearer <key>`; keys in query
strings are rejected. /health is public and returns only `{"status":"ok"}`.
Do not set SHOPIFY_ACCESS_TOKEN for the production service. Shopify tokens are
exchanged automatically, renewed five minutes before expiry and kept in memory.

MCP_API_KEY remains required. An optional encrypted MCP_BOT_API_KEY permits an
independent bot credential without replacing the primary key. Both use the same
Bearer header and have the same granted rights and read-only restrictions.
Remove the bot Secret and restart to revoke it without changing primary clients;
verify the removed key gets401. The server accepts no other key names or URL keys.

A shared key gives every holder the same granted store access, including
destructive tools and the generic GraphQL mutation capability. There is no
per-person revocation or attribution with this shared connection. Store the key
only in private deployment Secrets and assistants' secure secret stores.
Never paste credentials into a URL, source, issue, email, log or chat.

## Rotate the shared key

In Cloudflare, open the Worker's Settings → Variables and Secrets. Replace the
encrypted MCP_API_KEY Secret with a newly
generated 32-byte random hex value (`openssl rand -hex 32`), entered privately.
Cloudflare cannot reveal saved secret values; retain private recovery in your
secret manager. Redeploy/restart so the old value stops working, then update the
team's secure assistant connections. Verify that the old key returns 401 and
the replacement can list tools. Do not print either key during verification.
If exposure is suspected, stop the service first while coordinating rotation.

## Cut off Shopify access

Uninstall the dedicated MCP app from the store's Apps settings. This revokes its
store access and prevents further successful client-credentials use. Verify an
authenticated read fails. Stopping/deleting the deployed service additionally
cuts off the MCP endpoint. Rotating only the MCP key does not revoke Shopify app
credentials; rotate those separately in the Dev Dashboard if compromised.

## Read-only mode and validation

Set SHOPIFY_MCP_READ_ONLY=true and restart. Mutating tools are hidden/refused.
graphql_admin stays available for queries, but parsed mutations (including other
operations in a multi-operation document) are rejected before any fetch. All
GraphQL documents and variable inputs are checked against the bundled 2026-10
schema. A different API version requires a matching reviewed schema; no silent
fallback is used. Runtime schema checks also cover dynamically assembled legacy
tools. Shopify's scopes and protected-customer-data/plan rules remain authoritative.

Requests have body/query limits and a timeout; Host and Origin are checked.
Credentials are redacted from errors/logs, and production runs as a nonroot
container user. Do not publish raw request/response dumps or customer records
while troubleshooting. Local development OAuth/static-token support is retained
for compatibility; the production remote entry point refuses static tokens.

Report a suspected issue privately to the repository maintainers. Do not attach
credentials or private store/customer data to a public issue.

Browser upload capabilities expire and should be shared only with the intended
uploader. Upload forms send only one bounded file; invalid sessions are rejected
before multipart parsing, and temporary files are deleted on success or error.
The local-host file upload tool is not available to remote clients.

Cloudflare checks the key at the edge before the Node/MCP host. Its Durable
Object persists temporary upload-session metadata across eviction; tokens and
client secrets are not written to that storage. Browser uploads are limited
to10MiB there. Secrets are never available to the bot through tools.
