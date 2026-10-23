import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildSchema,
  getOperationAST,
  getVariableValues,
  Kind,
  parse,
  validate,
  type GraphQLSchema,
} from "graphql";
import { SHOPIFY_API_VERSION } from "./config.js";

const secrets = new Set<string>();
export function rememberSecret(value: string | undefined): void {
  if (value) secrets.add(value);
}

export function redactSensitive(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const secret of secrets)
      result = result.split(secret).join("[REDACTED]");
    return result
      .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
      .replace(/\bshp[a-z]*_[A-Za-z0-9_-]+/g, "[REDACTED]");
  }
  if (value instanceof Error)
    return {
      message: redactSensitive(value.message.split(': {"response"')[0], seen),
    };
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((v) => redactSensitive(v, seen));
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        /(?:authorization|access[_-]?token|client[_-]?secret|api[_-]?key|password)/i.test(
          key,
        )
          ? "[REDACTED]"
          : redactSensitive(v, seen),
      ]),
    );
  }
  return value;
}

export function installSafeLogging(): void {
  for (const key of ["log", "warn", "error", "info", "debug"] as const) {
    const original = console[key].bind(console);
    console[key] = (...args: unknown[]) =>
      original(...args.map((v) => redactSensitive(v)));
  }
}

export function safeErrorMessage(error: unknown): string {
  const candidate = error as {
    response?: { errors?: Array<{ message?: string }> };
    message?: string;
  };
  const message =
    candidate?.response?.errors
      ?.map((e) => e.message || "Admin API error")
      .join("; ") ||
    candidate?.message ||
    "Admin API request failed";
  return String(redactSensitive(message.split(': {"response"')[0])).slice(
    0,
    2000,
  );
}

export function bearerAuthorized(
  header: string | undefined,
  expected: string,
): boolean {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
}

let cachedSchema: GraphQLSchema | undefined;
/** Workers imports the same reviewed schema as a bundled text module. */
export function setBundledAdminSchema(sdl: string, version: string): void {
  if (version !== SHOPIFY_API_VERSION)
    throw Error("Bundled schema/API version mismatch");
  cachedSchema = buildSchema(sdl);
}

export function adminSchema(): GraphQLSchema {
  if (cachedSchema) return cachedSchema;
  // The packaged executable is dist/index.js; cwd is a fallback for tests and
  // programmatic consumers. Never download or silently change a schema at runtime.
  const file = "admin-" + SHOPIFY_API_VERSION + ".graphql";
  const paths = [
    resolve(dirname(process.argv[1] || "."), "../schema", file),
    resolve(process.cwd(), "schema", file),
  ];
  const path = paths.find((p) => existsSync(p));
  if (!path)
    throw Error("No bundled Admin API schema for " + SHOPIFY_API_VERSION);
  cachedSchema = buildSchema(readFileSync(path, "utf8"));
  return cachedSchema;
}

export function validateAdminRequest(
  query: string,
  variables: Record<string, unknown> = {},
  operationName?: string,
  readOnly = false,
): void {
  if (typeof query !== "string" || query.length > 128_000)
    throw Error("Admin GraphQL document must be a string under 128KB");
  const document = parse(query, { maxTokens: 20000 });
  if (
    readOnly &&
    document.definitions.some(
      (d) => d.kind === Kind.OPERATION_DEFINITION && d.operation !== "query",
    )
  )
    throw Error("Read-only mode refuses all Admin GraphQL mutations");
  const operation = getOperationAST(document, operationName);
  if (!operation)
    throw Error("Select one valid GraphQL operation by operationName");
  if (operation.operation === "subscription")
    throw Error("Admin GraphQL subscriptions are not supported");
  const schema = adminSchema();
  const errors = validate(schema, document);
  if (errors.length)
    throw Error(
      "Admin API schema validation: " +
        errors
          .map((e) => e.message)
          .join("; ")
          .slice(0, 1800),
    );
  const values = getVariableValues(
    schema,
    operation.variableDefinitions || [],
    variables,
  );
  // Do not echo values: inputs can contain customer data or a caller's secrets.
  if (values.errors?.length)
    throw Error(
      "Admin API variable validation failed; check required arguments and input field types",
    );
}

export function guardedAdminFetch(
  fetchImpl: typeof fetch,
  readOnly: boolean,
): typeof fetch {
  return async (url, init = {}) => {
    if (typeof init.body !== "string")
      throw Error("Expected a JSON Admin GraphQL request");
    let body;
    try {
      body = JSON.parse(init.body);
    } catch {
      throw Error("Invalid Admin GraphQL JSON");
    }
    if (Array.isArray(body))
      throw Error("Admin GraphQL batch requests are not supported");
    validateAdminRequest(
      body.query,
      body.variables || {},
      body.operationName,
      readOnly,
    );
    return fetchImpl(url, {
      ...init,
      signal: init.signal || AbortSignal.timeout(30_000),
    });
  };
}
