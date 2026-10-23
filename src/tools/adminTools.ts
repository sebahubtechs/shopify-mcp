import type { GraphQLClient } from "graphql-request";
import { getOperationAST, Kind, parse, print, visit } from "graphql";
import { z } from "zod";
import { adminSchema, validateAdminRequest } from "../adminSecurity.js";
import { parseReadOnlyMode } from "../toolAccess.js";

type Shape = Record<string, z.ZodType>;
type AdminTool = {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  readOnly: boolean;
  initialize: (client: GraphQLClient) => void;
  execute: (input: any) => Promise<any>;
};
export const adminOperations: Array<{
  name: string;
  document: string;
  readOnly: boolean;
}> = [];
export const adminTools: AdminTool[] = [];
const id = z
  .string()
  .regex(/^gid:\/\/shopify\/[A-Za-z]+\/[^\s]+$/)
  .describe("Shopify global ID returned by a read tool.");
const json = (name: string) =>
  z
    .record(z.string(), z.unknown())
    .describe(
      name +
        " input object. Supply Admin API input fields; unknown fields and types are rejected against the bundled schema.",
    );
const pageShape = {
  first: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Page size, 1–100."),
  after: z.string().optional().describe("endCursor from the preceding page."),
};
const searchShape = {
  ...pageShape,
  query: z
    .string()
    .max(2000)
    .optional()
    .describe("Optional Shopify search query."),
};
const pageInfo = "pageInfo { hasNextPage endCursor }";
const errors = "userErrors { field message }";

function define(
  name: string,
  description: string,
  shape: Shape,
  document: string,
  readOnly: boolean,
): AdminTool {
  adminOperations.push({ name, document, readOnly });
  let client: GraphQLClient;
  const schema = z.object(shape);
  const tool: AdminTool = {
    name,
    description,
    schema,
    readOnly,
    initialize(c) {
      client = c;
    },
    async execute(input) {
      if (!readOnly && parseReadOnlyMode(process.env.SHOPIFY_MCP_READ_ONLY))
        throw Error("Read-only mode refuses " + name);
      const variables = schema.parse(input);
      validateAdminRequest(
        document,
        variables,
        undefined,
        parseReadOnlyMode(process.env.SHOPIFY_MCP_READ_ONLY),
      );
      const data = (await client.request(document, variables)) as Record<
        string,
        any
      >;
      for (const payload of Object.values(data)) {
        const userErrors = payload?.orderCancelUserErrors?.length
          ? payload.orderCancelUserErrors
          : payload?.userErrors;
        if (userErrors?.length)
          throw Error(userErrors.map((e: any) => e.message).join("; "));
      }
      return data;
    },
  };
  adminTools.push(tool);
  return tool;
}

function query(
  name: string,
  description: string,
  shape: Shape,
  body: string,
  types: Record<string, string> = {},
) {
  const defs = Object.keys(shape)
    .map(
      (k) =>
        "$" +
        k +
        ":" +
        (types[k] ||
          (
            { first: "Int!", after: "String", query: "String" } as Record<
              string,
              string
            >
          )[k] ||
          "ID!"),
    )
    .join(",");
  return define(
    name,
    description,
    shape,
    `query ${name}${defs ? "(" + defs + ")" : ""} { ${body} }`,
    true,
  );
}

function mutation(
  name: string,
  description: string,
  field: string,
  shape: Shape,
  selection: string,
) {
  const fields = adminSchema().getMutationType()!.getFields();
  const target = fields[field];
  if (!target) throw Error("Unknown Admin mutation " + field);
  const defs = Object.keys(shape)
    .map((k) => {
      const arg = target.args.find((a) => a.name === k);
      if (!arg) throw Error("Unknown argument " + field + "." + k);
      return "$" + k + ":" + arg.type;
    })
    .join(",");
  const args = Object.keys(shape)
    .map((k) => k + ":$" + k)
    .join(",");
  return define(
    name,
    description,
    shape,
    `mutation ${name}(${defs}) { ${field}(${args}) { ${selection} } }`,
    false,
  );
}

query(
  "shop_info",
  "Read shop identity, currency, timezone, plan and granted app scopes; changes nothing.",
  {},
  "shop { id name myshopifyDomain currencyCode ianaTimezone primaryDomain { url } plan { displayName shopifyPlus } } currentAppInstallation { accessScopes { handle } }",
);
query(
  "shop_policies",
  "Read the published shipping, refund, privacy and terms policies; changes nothing.",
  {},
  "shop { shopPolicies { id title type body url } }",
);
query(
  "shopifyql_query",
  "Run a read-only ShopifyQL query and return tableData/parseErrors. Traffic queries should use WHERE human_or_bot_session = 'human'. Requires read_reports and Shopify Level2 access.",
  {
    query: z
      .string()
      .min(1)
      .max(32000)
      .describe(
        "ShopifyQL, for example FROM sales SHOW total_sales SINCE -30d UNTIL today.",
      ),
  },
  "shopifyqlQuery(query:$query) { tableData { columns { name dataType displayName } rows } parseErrors }",
  { query: "String!" },
);

const codeDiscount =
  "codeDiscount { __typename ... on DiscountCodeBasic { title status startsAt endsAt summary codes(first:10) { nodes { code } } } ... on DiscountCodeBxgy { title status startsAt endsAt summary codes(first:10) { nodes { code } } } ... on DiscountCodeFreeShipping { title status startsAt endsAt summary codes(first:10) { nodes { code } } } }";
const automaticDiscount =
  "automaticDiscount { __typename ... on DiscountAutomaticBasic { title status startsAt endsAt summary } ... on DiscountAutomaticBxgy { title status startsAt endsAt summary } ... on DiscountAutomaticFreeShipping { title status startsAt endsAt summary } }";
query(
  "list_code_discounts",
  "List code discounts with status and pagination; changes nothing.",
  searchShape,
  `codeDiscountNodes(first:$first,after:$after,query:$query) { nodes { id ${codeDiscount} } ${pageInfo} }`,
);
query(
  "list_automatic_discounts",
  "List automatic discounts with status and pagination; changes nothing.",
  searchShape,
  `automaticDiscountNodes(first:$first,after:$after,query:$query) { nodes { id ${automaticDiscount} } ${pageInfo} }`,
);

for (const [category, prefix, payload, selection] of [
  ["code", "Code", "codeDiscountNode", codeDiscount],
  ["automatic", "Automatic", "automaticDiscountNode", automaticDiscount],
] as const) {
  for (const action of ["create", "update"] as const) {
    const variants = new Map<string, AdminTool>();
    for (const [kind, method] of [
      ["basic", "Basic"],
      ["bxgy", "Bxgy"],
      ["free_shipping", "FreeShipping"],
    ] as const) {
      const field =
        "discount" +
        prefix +
        method +
        (action === "create" ? "Create" : "Update");
      const target = adminSchema().getMutationType()!.getFields()[field];
      const inputArg = target.args.find((a) => a.name !== "id")!;
      const hiddenName = action + "_" + category + "_discount_" + kind;
      const internal = mutation(
        hiddenName,
        `${action} ${category} ${kind} discount.`,
        field,
        {
          ...(action === "update" ? { id } : {}),
          [inputArg.name]: json(String(inputArg.type)),
        },
        `${payload} { id ${selection} } ${errors}`,
      );
      adminTools.pop();
      variants.set(kind, internal);
    }
    const schema = z.object({
      kind: z
        .enum(["basic", "bxgy", "free_shipping"])
        .describe(
          "Discount kind. Update must match the existing discount type.",
        ),
      ...(action === "update" ? { id } : {}),
      input: json(
        "Discount" +
          prefix +
          " input; creation needs title, startsAt, " +
          (category === "code" ? "code, " : "") +
          "and kind-specific customerGets/customerBuys or shipping rules",
      ),
    });
    adminTools.push({
      name: action + "_" + category + "_discount",
      description:
        (action === "create" ? "Create a new " : "Change an existing ") +
        category +
        " discount (basic, buy-X-get-Y or free shipping). Changes checkout pricing; supply dates, value and eligibility deliberately.",
      schema,
      readOnly: false,
      initialize(c) {
        for (const t of variants.values()) t.initialize(c);
      },
      async execute(raw) {
        const input = schema.parse(raw);
        const selected = variants.get(input.kind)!;
        const key = Object.keys(selected.schema.shape).find((k) => k !== "id")!;
        return selected.execute({
          ...(action === "update" ? { id: input.id } : {}),
          [key]: input.input,
        });
      },
    });
  }
  mutation(
    "deactivate_" + category + "_discount",
    "Deactivate an existing " +
      category +
      " discount so it no longer applies at checkout.",
    "discount" + prefix + "Deactivate",
    { id },
    `${payload} { id } ${errors}`,
  );
}

query(
  "list_fulfillment_orders",
  "Read an order’s fulfillment orders, assigned locations and remaining line items; changes nothing.",
  { orderId: id, ...pageShape },
  `order(id:$orderId) { id name fulfillmentOrders(first:$first,after:$after) { nodes { id status requestStatus supportedActions { action } assignedLocation { name location { id name } } lineItems(first:100) { nodes { id remainingQuantity totalQuantity lineItem { id name sku } } ${pageInfo} } } ${pageInfo} } }`,
);
mutation(
  "create_fulfillment",
  "Create a fulfillment with tracking/fulfillment-order line items. Marks items fulfilled; notifyCustomer can email the customer.",
  "fulfillmentCreate",
  {
    fulfillment: json(
      "FulfillmentInput: lineItemsByFulfillmentOrder, trackingInfo, notifyCustomer; set notification deliberately",
    ),
    message: z.string().optional().describe("Optional fulfillment message."),
  },
  `fulfillment { id status trackingInfo { company number url } } ${errors}`,
);
mutation(
  "update_fulfillment_tracking",
  "Change tracking on an existing fulfillment; customer notification defaults to false.",
  "fulfillmentTrackingInfoUpdate",
  {
    fulfillmentId: id,
    trackingInfoInput: json(
      "FulfillmentTrackingInput: company, number(s), url(s)",
    ),
    notifyCustomer: z.boolean().default(false),
  },
  `fulfillment { id status trackingInfo { company number url } } ${errors}`,
);
mutation(
  "cancel_order",
  "Cancel an order; restocking and refundMethod are explicit decisions. This can refund money and cannot be undone.",
  "orderCancel",
  {
    orderId: id,
    restock: z.boolean().describe("Whether to restock canceled items."),
    reason: z
      .enum(["CUSTOMER", "DECLINED", "FRAUD", "INVENTORY", "OTHER", "STAFF"])
      .describe("Cancellation reason."),
    refundMethod: json(
      "OrderCancelRefundMethodInput: originalPaymentMethodsRefund or storeCreditRefund",
    ),
    notifyCustomer: z.boolean().default(false),
    staffNote: z.string().max(2000).optional(),
  },
  "job { id done } orderCancelUserErrors { field message code }",
);
mutation(
  "refund_order",
  "Create an order refund; supplied transactions can move money. Supply exact line items, shipping and amounts.",
  "refundCreate",
  {
    input: json(
      "RefundInput: orderId, refundLineItems, transactions, shipping, note, notify",
    ),
  },
  `refund { id createdAt note totalRefundedSet { shopMoney { amount currencyCode } } } ${errors}`,
);
mutation(
  "set_order_note",
  "Replace an order’s note; does not change payment or fulfillment.",
  "orderUpdate",
  {
    input: z.object({
      id,
      note: z
        .string()
        .max(5000)
        .describe("Full replacement note; empty text clears it."),
    }),
  },
  `order { id note } ${errors}`,
);
mutation(
  "add_order_tags",
  "Add tags to an order without replacing its existing tags.",
  "tagsAdd",
  {
    id: id.refine(
      (v) => v.startsWith("gid://shopify/Order/"),
      "Use an Order ID.",
    ),
    tags: z.array(z.string().min(1).max(255)).min(1).max(250),
  },
  `node { id } ${errors}`,
);

const pageFields = "id title handle body isPublished templateSuffix updatedAt";
query(
  "list_pages",
  "Read online-store pages and pagination; changes nothing.",
  searchShape,
  `pages(first:$first,after:$after,query:$query) { nodes { ${pageFields} } ${pageInfo} }`,
);
query(
  "get_page",
  "Read one online-store page, including HTML body; changes nothing.",
  { id },
  `page(id:$id) { ${pageFields} }`,
);
mutation(
  "create_page",
  "Create an online-store page. isPublished controls public visibility.",
  "pageCreate",
  {
    page: json(
      "PageCreateInput: title, body, handle, isPublished, templateSuffix",
    ),
  },
  `page { ${pageFields} } ${errors}`,
);
mutation(
  "update_page",
  "Change an existing online-store page; published content changes publicly.",
  "pageUpdate",
  {
    id,
    page: json(
      "PageUpdateInput: title, body, handle, isPublished, templateSuffix",
    ),
  },
  `page { ${pageFields} } ${errors}`,
);
mutation(
  "delete_page",
  "Permanently delete an online-store page.",
  "pageDelete",
  { id },
  `deletedPageId ${errors}`,
);

query(
  "list_blogs",
  "Read blogs and pagination to obtain a blog ID; changes nothing.",
  searchShape,
  `blogs(first:$first,after:$after,query:$query) { nodes { id title handle } ${pageInfo} }`,
);
mutation(
  "create_blog",
  "Create an online-store blog.",
  "blogCreate",
  { blog: json("BlogCreateInput: title, handle, commentPolicy") },
  `blog { id title handle } ${errors}`,
);
mutation(
  "update_blog",
  "Change a blog title, handle or settings.",
  "blogUpdate",
  { id, blog: json("BlogUpdateInput") },
  `blog { id title handle } ${errors}`,
);
mutation(
  "delete_blog",
  "Permanently delete a blog and its articles.",
  "blogDelete",
  { id },
  `deletedBlogId ${errors}`,
);
const articleFields =
  "id title handle body summary isPublished publishedAt blog { id title }";
query(
  "list_blog_posts",
  "Read blog posts and pagination; filter with a Shopify article search query.",
  searchShape,
  `articles(first:$first,after:$after,query:$query) { nodes { ${articleFields} } ${pageInfo} }`,
);
query(
  "get_blog_post",
  "Read one blog post and its HTML body; changes nothing.",
  { id },
  `article(id:$id) { ${articleFields} }`,
);
mutation(
  "create_blog_post",
  "Create a blog post. Set its blog, author and publication state explicitly.",
  "articleCreate",
  {
    article: json(
      "ArticleCreateInput: blogId, title, author, body, isPublished; see schema for fields",
    ),
  },
  `article { ${articleFields} } ${errors}`,
);
mutation(
  "update_blog_post",
  "Change a blog post; publishing or changing a published post affects the public store.",
  "articleUpdate",
  { id, article: json("ArticleUpdateInput") },
  `article { ${articleFields} } ${errors}`,
);
mutation(
  "delete_blog_post",
  "Permanently delete a blog post.",
  "articleDelete",
  { id },
  `deletedArticleId ${errors}`,
);

const menuFields =
  "id title handle items { id title type url resourceId tags items { id title type url resourceId tags items { id title type url resourceId tags } } }";
query(
  "list_navigation_menus",
  "Read navigation menus and up to three item levels; changes nothing.",
  searchShape,
  `menus(first:$first,after:$after,query:$query) { nodes { ${menuFields} } ${pageInfo} }`,
);
query(
  "get_navigation_menu",
  "Read one navigation menu and its items; changes nothing.",
  { id },
  `menu(id:$id) { ${menuFields} }`,
);
mutation(
  "create_navigation_menu",
  "Create a navigation menu with the supplied item tree.",
  "menuCreate",
  {
    title: z.string().min(1),
    handle: z.string().min(1),
    items: z.array(
      json(
        "MenuItemCreateInput: title, type, url or resourceId, optional nested items",
      ),
    ),
  },
  `menu { ${menuFields} } ${errors}`,
);
mutation(
  "update_navigation_menu",
  "Replace a menu’s item tree and change its title/handle. Read the existing tree first.",
  "menuUpdate",
  {
    id,
    title: z.string().min(1),
    handle: z.string().optional(),
    items: z.array(
      json(
        "MenuItemUpdateInput: existing item IDs and the complete intended tree",
      ),
    ),
  },
  `menu { ${menuFields} } ${errors}`,
);
mutation(
  "delete_navigation_menu",
  "Permanently delete a navigation menu.",
  "menuDelete",
  { id },
  `deletedMenuId ${errors}`,
);
mutation(
  "update_url_redirect",
  "Change an existing URL redirect’s source path or destination.",
  "urlRedirectUpdate",
  { id, urlRedirect: json("UrlRedirectInput: path and target") },
  `urlRedirect { id path target } ${errors}`,
);

query(
  "list_themes",
  "Read themes and their publication roles; changes nothing.",
  pageShape,
  `themes(first:$first,after:$after) { nodes { id name role processing } ${pageInfo} }`,
);
query(
  "read_theme_files",
  "Read theme files, including text/base64/URL bodies. Use filenames to select specific files; changes nothing.",
  {
    themeId: id,
    ...pageShape,
    filenames: z
      .array(z.string().min(1))
      .min(1)
      .max(50)
      .optional()
      .describe("Optional exact paths such as layout/theme.liquid."),
  },
  `theme(id:$themeId) { id name files(first:$first,after:$after,filenames:$filenames) { nodes { filename checksumMd5 contentType size body { __typename ... on OnlineStoreThemeFileBodyText { content } ... on OnlineStoreThemeFileBodyBase64 { contentBase64 } ... on OnlineStoreThemeFileBodyUrl { url } } } ${pageInfo} } }`,
  { filenames: "[String!]" },
);
query(
  "list_shipping_profiles",
  "Read delivery-profile IDs and rate counts; changes nothing.",
  pageShape,
  `deliveryProfiles(first:$first,after:$after) { nodes { id name default activeMethodDefinitionsCount zoneCountryCount profileLocationGroups { locationGroup { id } } } ${pageInfo} }`,
);
query(
  "read_shipping_rates",
  "Read zones/rates in one profile location group. Nested cursors expose truncation; changes nothing.",
  {
    profileId: id,
    locationGroupId: id,
    ...pageShape,
    first: z.number().int().min(1).max(50).default(10),
    methodsFirst: z.number().int().min(1).max(50).default(10),
    methodsAfter: z.string().optional(),
  },
  `deliveryProfile(id:$profileId) { id name profileLocationGroups(locationGroupId:$locationGroupId) { locationGroup { id } locationGroupZones(first:$first,after:$after) { nodes { zone { id name countries { name code { countryCode restOfWorld } } } methodDefinitions(first:$methodsFirst,after:$methodsAfter) { nodes { id name description active rateProvider { __typename ... on DeliveryRateDefinition { id price { amount currencyCode } } ... on DeliveryParticipant { id fixedFee { amount currencyCode } percentageOfRateFee } } } ${pageInfo} } } ${pageInfo} } } }`,
  { methodsFirst: "Int!", methodsAfter: "String" },
);

function selectedDocument(source: string, operationName?: string): string {
  if (!operationName) return source;
  const document = parse(source),
    operation = getOperationAST(document, operationName)!;
  const fragments = new Map(
    document.definitions
      .filter((d) => d.kind === Kind.FRAGMENT_DEFINITION)
      .map((d) => [d.name.value, d]),
  );
  const needed = new Set<string>();
  const collect = (node: any) =>
    visit(node, {
      FragmentSpread(n) {
        if (!needed.has(n.name.value)) {
          needed.add(n.name.value);
          const fragment = fragments.get(n.name.value);
          if (fragment) collect(fragment);
        }
      },
    });
  collect(operation);
  return print({
    kind: Kind.DOCUMENT,
    definitions: [operation, ...[...needed].map((n) => fragments.get(n)!)],
  });
}

let genericClient: GraphQLClient;
adminTools.push({
  name: "graphql_admin",
  description:
    "Run any Admin GraphQL query or mutation within granted scopes. Mutations change store data and are refused in read-only mode; schema and variables are validated.",
  schema: z.object({
    query: z
      .string()
      .min(1)
      .max(128000)
      .describe("Complete Admin API GraphQL document."),
    variables: z
      .record(z.string(), z.unknown())
      .default({})
      .describe("JSON variable values; no credentials."),
    operationName: z
      .string()
      .optional()
      .describe("Required when choosing among multiple named operations."),
  }),
  readOnly: true,
  initialize(c) {
    genericClient = c;
  },
  async execute(raw) {
    const input = this.schema.parse(raw) as {
      query: string;
      variables: Record<string, unknown>;
      operationName?: string;
    };
    validateAdminRequest(
      input.query,
      input.variables,
      input.operationName,
      parseReadOnlyMode(process.env.SHOPIFY_MCP_READ_ONLY),
    );
    return genericClient.request(
      selectedDocument(input.query, input.operationName),
      input.variables,
    );
  },
});
