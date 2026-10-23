import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const key = "synthetic-worker-key";
async function freePort() {
  const s = createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const p = s.address().port;
  s.close();
  return p;
}
async function start(port, persist, readOnly = false) {
  const args = [
    "dev",
    "__tests__/fixtures/cloudflare-worker.mjs",
    "--local",
    "--port",
    String(port),
    "--inspector-port",
    "0",
    "--persist-to",
    persist,
  ];
  for (const [k, v] of Object.entries({
    MCP_API_KEY: key,
    SHOPIFY_CLIENT_ID: "synthetic-client-id",
    SHOPIFY_CLIENT_SECRET: "synthetic-client-secret",
    MYSHOPIFY_DOMAIN: "test-shop.myshopify.com",
    PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    SHOPIFY_MCP_READ_ONLY: String(readOnly),
  }))
    args.push("--var", k + ":" + v);
  const child = spawn("./node_modules/.bin/wrangler", args, {
    detached: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  const stop = async () => {
    if (child.exitCode !== null) return;
    const exited = once(child, "exit");
    process.kill(-child.pid, "SIGTERM");
    await exited;
  };
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw Error("Worker exited: " + logs.slice(-2500));
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok)
          return { url: `http://127.0.0.1:${port}`, stop };
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    throw Error("Worker startup timed out: " + logs.slice(-2500));
  } catch (e) {
    await stop();
    throw e;
  }
}
async function connect(url) {
  const c = new Client(
    { name: "worker-acceptance", version: "1" },
    { capabilities: {} },
  );
  await c.connect(
    new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
      requestInit: { headers: { Authorization: "Bearer " + key } },
    }),
  );
  return c;
}
function decode(r) {
  assert.ok(!r.isError, JSON.stringify(r));
  return JSON.parse(r.content[0].text);
}
test(
  "workerd HTTP, schema variables, read-only enforcement and persisted upload capabilities",
  { timeout: 120000 },
  async () => {
    const persist = await mkdtemp(join(tmpdir(), "shopify-worker-test-"));
    let server, client;
    try {
      server = await start(await freePort(), persist);
      assert.equal(
        (await fetch(server.url + "/mcp", { method: "POST" })).status,
        401,
      );
      assert.equal(
        (await fetch(server.url + "/mcp?apiKey=" + key)).status,
        401,
      );
      client = await connect(server.url);
      assert.equal((await client.listTools()).tools.length, 104);
      assert.equal(
        decode(await client.callTool({ name: "shop_info", arguments: {} })).shop
          .name,
        "Test shop",
      );
      const sql = decode(
        await client.callTool({
          name: "shopifyql_query",
          arguments: {
            query: "FROM sales SHOW total_sales SINCE -7d UNTIL today",
          },
        }),
      );
      assert.deepEqual(sql.shopifyqlQuery.tableData.rows, [["0"]]);
      const upload = decode(
        await client.callTool({
          name: "create-file-upload-session",
          arguments: {},
        }),
      );
      assert.ok(upload.sessionId, JSON.stringify(upload));
      assert.equal(
        (await fetch(server.url + "/uploads/shopify-files/" + upload.sessionId))
          .status,
        200,
      );
      await client.close();
      client = null;
      await server.stop();
      server = null;
      server = await start(await freePort(), persist);
      client = await connect(server.url);
      const restored = decode(
        await client.callTool({
          name: "get-file-upload-session",
          arguments: { sessionId: upload.sessionId },
        }),
      );
      assert.equal(restored.sessionId, upload.sessionId);
      assert.equal(restored.sessionState, "PENDING");
      await client.close();
      client = null;
      await server.stop();
      server = null;
      server = await start(await freePort(), persist, true);
      client = await connect(server.url);
      const names = (await client.listTools()).tools.map((t) => t.name);
      assert.ok(!names.includes("cancel_order"));
      assert.ok(names.includes("graphql_admin"));
      const denied = await client.callTool({
        name: "graphql_admin",
        arguments: {
          query:
            'query Safe { shop { name } } mutation Hidden { tagsAdd(id:"gid://shopify/Order/1",tags:[]) { userErrors { message } } }',
          operationName: "Safe",
        },
      });
      assert.equal(denied.isError, true);
      assert.match(denied.content[0].text, /read.only/i);
    } finally {
      if (client) await client.close();
      if (server) await server.stop();
      await rm(persist, { recursive: true, force: true });
    }
  },
);
