import { workerRequestGate } from "../src/workerGate.js";
const env = {
  MCP_API_KEY: "synthetic-worker-key",
  SHOPIFY_CLIENT_ID: "synthetic-client",
  SHOPIFY_CLIENT_SECRET: "synthetic-secret",
};
test("Worker health is public and contains no account data", async () => {
  const r = workerRequestGate(
    new Request("https://worker.example/health"),
    env,
  )!;
  expect(await r.json()).toEqual({ status: "ok" });
});
test.each(["GET", "POST", "OPTIONS", "DELETE", "PUT"])(
  "Worker authenticates every MCP method (%s)",
  (method) => {
    expect(
      workerRequestGate(
        new Request("https://worker.example/mcp?apiKey=synthetic-worker-key", {
          method,
        }),
        env,
      )?.status,
    ).toBe(401);
    expect(
      workerRequestGate(
        new Request("https://worker.example/mcp", {
          method,
          headers: { Authorization: "Bearer synthetic-worker-key" },
        }),
        env,
      ),
    ).toBeNull();
  },
);
test("Worker fails closed before initializing Shopify without key or app credentials", () => {
  const request = new Request("https://worker.example/mcp", {
    headers: { Authorization: "Bearer synthetic-worker-key" },
  });
  expect(workerRequestGate(request, {})?.status).toBe(503);
  expect(
    workerRequestGate(request, { MCP_API_KEY: env.MCP_API_KEY })?.status,
  ).toBe(503);
  expect(
    workerRequestGate(new Request("https://worker.example/not-a-route"), env)
      ?.status,
  ).toBe(404);
});

test("Worker accepts a separate bot key while retaining the required primary key", () => {
  const request = new Request("https://worker.example/mcp", {
    headers: { Authorization: "Bearer synthetic-bot-key" },
  });
  const botEnv = { ...env, MCP_BOT_API_KEY: "synthetic-bot-key" };
  expect(workerRequestGate(request, botEnv)).toBeNull();
  const { MCP_API_KEY: _primary, ...withoutPrimary } = botEnv;
  expect(workerRequestGate(request, withoutPrimary)?.status).toBe(503);
});
