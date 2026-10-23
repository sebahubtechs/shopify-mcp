// Run locally with dev dependencies installed. Never pass the key on the CLI.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const base = process.env.MCP_URL,
  key = process.env.MCP_API_KEY;
if (!base || !key)
  throw Error(
    "Set MCP_URL and MCP_API_KEY privately in the process environment",
  );
const url = new URL(base);
if (
  url.protocol !== "https:" &&
  !["127.0.0.1", "localhost"].includes(url.hostname)
)
  throw Error("HTTPS required");
if (url.username || url.password || url.search)
  throw Error("Credentials and query strings do not belong in the URL");
const report = { endpoint: url.href, checks: {} };
const client = new Client(
  { name: "team-mcp-acceptance", version: "1.0.0" },
  { capabilities: {} },
);
const decode = (result) => {
  if (result.isError)
    throw Error(
      "Tool refused the request; inspect its sanitized error privately",
    );
  return JSON.parse(result.content.find((c) => c.type === "text").text);
};
try {
  const health = await fetch(new URL("/health", url));
  report.checks.health = { status: health.status, body: await health.json() };
  if (
    health.status !== 200 ||
    JSON.stringify(report.checks.health.body) !== '{"status":"ok"}'
  )
    throw Error("Health check failed");
  const unauth = await fetch(url, { method: "POST" });
  report.checks.unauthenticated = { status: unauth.status };
  if (unauth.status !== 401) throw Error("Unauthenticated MCP must return 401");
  await client.connect(
    new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: "Bearer " + key } },
    }),
  );
  let names = [],
    cursor;
  do {
    const result = await client.listTools(cursor ? { cursor } : {});
    names.push(...result.tools.map((t) => t.name));
    cursor = result.nextCursor;
  } while (cursor);
  report.checks.tools = { count: names.length, names };
  const shop = decode(
    await client.callTool({ name: "shop_info", arguments: {} }),
  );
  report.checks.shop = {
    name: shop.shop.name,
    domain: shop.shop.myshopifyDomain,
    currency: shop.shop.currencyCode,
    scopes: shop.currentAppInstallation?.accessScopes
      .map((s) => s.handle)
      .sort(),
  };
  if (
    process.env.EXPECTED_SHOP_NAME &&
    shop.shop.name !== process.env.EXPECTED_SHOP_NAME
  )
    throw Error("Shop name did not match EXPECTED_SHOP_NAME");
  const result = await client.callTool({
    name: "shopifyql_query",
    arguments: { query: "FROM sales SHOW total_sales SINCE -7d UNTIL today" },
  });
  if (result.isError) {
    report.checks.shopifyql = {
      passed: false,
      reason:
        "Shopify denied or failed the query; check read_reports and Level2 access",
    };
    process.exitCode = 1;
  } else {
    const data = decode(result).shopifyqlQuery;
    report.checks.shopifyql = {
      passed: !data.parseErrors?.length && !!data.tableData,
      table: data.tableData,
      parseErrors: data.parseErrors,
    };
    if (!report.checks.shopifyql.passed) process.exitCode = 1;
  }
} catch (error) {
  report.failure = String(error?.message || "Verification failed")
    .split(key)
    .join("[REDACTED]");
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
  console.log(JSON.stringify(report, null, 2));
}
