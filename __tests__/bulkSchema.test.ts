import { startBulkExport } from "../src/tools/startBulkExport.js";
import { validateAdminRequest } from "../src/adminSecurity.js";
const request = jest.fn();
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({
    bulkOperationRunQuery: {
      bulkOperation: { id: "test", status: "CREATED" },
      userErrors: [],
    },
  });
  startBulkExport.initialize({ request } as any);
  delete process.env.SHOPIFY_MCP_READ_ONLY;
});
test.each(["products", "orders", "customers", "inventory"] as const)(
  "bulk %s preset validates against the current schema",
  async (type) => {
    await startBulkExport.execute({
      type,
      includeMetafields: true,
      query: 'title:"quotes"',
    });
    expect(request).toHaveBeenCalled();
    expect(() =>
      validateAdminRequest(request.mock.calls[0][1].query, {}, undefined, true),
    ).not.toThrow();
  },
);
test("bulk rejects an invalid custom inner query before dispatch", async () => {
  await expect(
    startBulkExport.execute({
      type: "custom",
      customQuery: "{ customers { edges { node { inventedField } } } }",
      includeMetafields: false,
    }),
  ).rejects.toThrow(/schema/i);
  expect(request).not.toHaveBeenCalled();
});
