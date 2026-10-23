import {
  bearerAuthorized,
  redactSensitive,
  rememberSecret,
  validateAdminRequest,
} from "../src/adminSecurity.js";

describe("remote Admin API safety boundary", () => {
  test("accepts only the exact configured bearer key", () => {
    expect(bearerAuthorized("Bearer synthetic-key", "synthetic-key")).toBe(
      true,
    );
    for (const header of [
      undefined,
      "",
      "synthetic-key",
      "Basic synthetic-key",
      "Bearer wrong",
      "Bearer synthetic-key ",
    ]) {
      expect(bearerAuthorized(header, "synthetic-key")).toBe(false);
    }
    expect(bearerAuthorized("Bearer anything", "")).toBe(false);
  });

  test("read-only parses operations rather than matching a word or prefix", () => {
    expect(() =>
      validateAdminRequest(
        "# mutation is a comment\nquery { shop { name } }",
        {},
        undefined,
        true,
      ),
    ).not.toThrow();
    for (const document of [
      'mutation Change { tagsAdd(id:"gid://shopify/Order/1",tags:["test"]) { userErrors { message } } }',
      'query Safe { shop { name } } mutation Hidden { tagsAdd(id:"gid://shopify/Order/1",tags:[]) { userErrors { message } } }',
    ])
      expect(() => validateAdminRequest(document, {}, "Safe", true)).toThrow(
        /read.only/i,
      );
  });

  test("validates fields, operation selection and variables before any fetch", () => {
    expect(() =>
      validateAdminRequest("query { shop { inventedField } }"),
    ).toThrow(/schema/i);
    expect(() =>
      validateAdminRequest(
        "query A { shop { name } } query B { shop { name } }",
      ),
    ).toThrow(/operation/i);
    expect(() =>
      validateAdminRequest("query($id: ID!) { order(id:$id) { id } }", {}),
    ).toThrow(/variable/i);
    expect(() =>
      validateAdminRequest("query { shop { name } }", {}, "Missing"),
    ).toThrow(/operation/i);
    expect(() =>
      validateAdminRequest("subscription { shop { name } }"),
    ).toThrow();
  });

  test("redacts exact known credentials and authorization-like values recursively", () => {
    rememberSecret("synthetic-private-client-value");
    const result = redactSensitive({
      error: new Error("client synthetic-private-client-value"),
      nested: ["Bearer synthetic-api-value"],
      access_token: "a-token",
    });
    expect(JSON.stringify(result)).not.toContain(
      "synthetic-private-client-value",
    );
    expect(JSON.stringify(result)).not.toContain("synthetic-api-value");
    expect(JSON.stringify(result)).not.toContain("a-token");
    expect(JSON.stringify(result)).toContain("REDACTED");
  });
});
