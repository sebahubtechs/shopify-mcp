// No live Shopify traffic is allowed in the connection tests.
globalThis.fetch = async (input, init) => {
  if (process.env.SHOPIFY_MCP_WORKER === "true" && init?.redirect === "error")
    throw new TypeError("The edge runtime does not support redirect: error");
  if (
    String(input) === "https://test-shop.myshopify.com/admin/oauth/access_token"
  ) {
    return Response.json({
      access_token: "test-token",
      expires_in: 86399,
      scope: "read_products,write_products",
    });
  }
  if (
    String(input) !==
    "https://test-shop.myshopify.com/admin/api/2026-10/graphql.json"
  ) {
    throw new Error(`Unexpected test request: ${input}`);
  }
  if (
    new Headers(init.headers).get("X-Shopify-Access-Token") !== "test-token"
  ) {
    throw new Error("Shopify token was not forwarded");
  }
  const { query, variables } = JSON.parse(init.body);
  if (process.env.MOCK_SHOPIFY_ERROR === "true")
    return Response.json({
      errors: [
        {
          message:
            "Diagnostic " +
            process.env.SHOPIFY_CLIENT_SECRET +
            " Bearer " +
            process.env.MCP_API_KEY +
            " test-token",
        },
      ],
    });
  if (query.includes("shopifyql_query"))
    return Response.json({
      data: {
        shopifyqlQuery: {
          tableData: {
            columns: [
              {
                name: "total_sales",
                dataType: "MONEY",
                displayName: "Total sales",
              },
            ],
            rows: [["0"]],
          },
          parseErrors: [],
        },
      },
    });
  if (
    query.includes("shop_info") ||
    /^\s*query\s*\{\s*shop\s*\{\s*name/.test(query)
  )
    return Response.json({
      data: {
        shop: {
          name: "Test shop",
          myshopifyDomain: "test-shop.myshopify.com",
          currencyCode: "CAD",
        },
        currentAppInstallation: { accessScopes: [{ handle: "read_products" }] },
      },
    });
  if (
    !query.includes("query GetLocations") ||
    variables.first !== 50 ||
    variables.includeInactive !== false ||
    variables.includeLegacy !== false
  ) {
    throw new Error("Unexpected query or missing schema defaults");
  }
  return Response.json({
    data: {
      locations: {
        edges: [
          {
            node: {
              id: "gid://shopify/Location/1",
              name: "Test warehouse",
              isActive: true,
            },
          },
        ],
      },
    },
  });
};
