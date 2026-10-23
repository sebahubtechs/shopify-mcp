import { parse, validate } from "graphql";
import { adminSchema } from "../src/adminSecurity.js";
import { adminOperations, adminTools } from "../src/tools/adminTools.js";

describe("Admin API extensions", () => {
  const request = jest.fn();
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ ok: true });
    for (const tool of adminTools) tool.initialize({ request } as any);
    delete process.env.SHOPIFY_MCP_READ_ONLY;
  });
  const tool = (name: string) => {
    const t = adminTools.find((t) => t.name === name);
    if (!t) throw Error("Missing " + name);
    return t;
  };

  test("every supported operation validates against the real 2026-10 schema", () => {
    expect(adminOperations.length).toBeGreaterThan(35);
    for (const operation of adminOperations)
      expect({
        operation: operation.name,
        errors: validate(adminSchema(), parse(operation.document)).map(
          (e) => e.message,
        ),
      }).toEqual({ operation: operation.name, errors: [] });
  });
  test("lists preserve cursor data and apply bounded pagination defaults", async () => {
    request.mockResolvedValue({
      codeDiscountNodes: {
        nodes: [],
        pageInfo: { hasNextPage: true, endCursor: "next" },
      },
    });
    const result = await tool("list_code_discounts").execute({});
    expect(request.mock.calls[0][1]).toEqual({ first: 25 });
    expect(result).toEqual({
      codeDiscountNodes: {
        nodes: [],
        pageInfo: { hasNextPage: true, endCursor: "next" },
      },
    });
    await expect(tool("list_pages").execute({ first: 251 })).rejects.toThrow();
  });
  test.each(["basic", "bxgy", "free_shipping"])(
    "supports %s code discounts without interpolating input",
    async (kind) => {
      const input = {
        title: 'quote " and mutation',
        code: "EXAMPLE",
        startsAt: "2026-10-23T00:00:00Z",
      };
      await tool("create_code_discount").execute({ kind, input });
      expect(request.mock.calls[0][0]).not.toContain(input.title);
      expect(Object.values(request.mock.calls[0][1])).toContainEqual(input);
    },
  );
  test("cancel requires an explicit restock/refund decision and never dispatches incomplete input", async () => {
    await expect(
      tool("cancel_order").execute({
        orderId: "gid://shopify/Order/1",
        reason: "CUSTOMER",
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await tool("cancel_order").execute({
      orderId: "gid://shopify/Order/1",
      reason: "CUSTOMER",
      restock: false,
      refundMethod: { originalPaymentMethodsRefund: false },
    });
    expect(request.mock.calls[0][1]).toMatchObject({
      restock: false,
      notifyCustomer: false,
      refundMethod: { originalPaymentMethodsRefund: false },
    });
  });
  test("generic escape hatch validates schema, variables and read-only mutations before dispatch", async () => {
    process.env.SHOPIFY_MCP_READ_ONLY = "true";
    await expect(
      tool("graphql_admin").execute({
        query:
          'mutation { tagsAdd(id:"gid://shopify/Order/1",tags:["x"]) { userErrors { message } } }',
      }),
    ).rejects.toThrow(/read.only/i);
    expect(request).not.toHaveBeenCalled();
    await tool("graphql_admin").execute({ query: "query { shop { name } }" });
    expect(request).toHaveBeenCalledTimes(1);
    await expect(
      tool("graphql_admin").execute({ query: "query { shop { imaginary } }" }),
    ).rejects.toThrow(/schema/i);
  });
  test("named writes refuse read-only direct execution as well as transport filtering", async () => {
    process.env.SHOPIFY_MCP_READ_ONLY = "true";
    await expect(
      tool("deactivate_code_discount").execute({
        id: "gid://shopify/DiscountCodeNode/1",
      }),
    ).rejects.toThrow(/read.only/i);
    expect(request).not.toHaveBeenCalled();
  });
  test("GraphQL user errors cannot be mistaken for a successful write", async () => {
    request.mockResolvedValue({
      pageCreate: {
        page: null,
        userErrors: [{ message: "Handle already exists", field: ["handle"] }],
      },
    });
    await expect(
      tool("create_page").execute({
        page: { title: "Example", body: "Example" },
      }),
    ).rejects.toThrow(/Handle already exists/);
  });
});
