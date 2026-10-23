# Remote tool catalog

104 tools. Available definitions do not imply that Shopify granted every scope. `graphql_admin` is query-only in read-only mode. The local-only upload tool is excluded remotely.

| Tool | Access | Description |
|---|---|---|
| `add_order_tags` | Write | Add tags to an order without replacing its existing tags. |
| `attach-file-to-product` | Write | Attach an existing Shopify MediaImage file to a product without re-uploading it |
| `bulk-delete-products` | Write | Delete multiple products at once. This action is irreversible. Max 100 products per call. |
| `bulk-set-variant-metafields` | Write | Set SKU and/or metafields across many variants of a single product in one API call (productVariantsBulkUpdate, up to 250 variants per call). UNIFORM mode (pass `metafields`) applies the same metafields to every variant — the tool auto-discovers the variant IDs, so you only pass the product. PER-VARIANT mode (pass `variants`) applies an SKU and/or different metafields per variant. Far more efficient than calling set-metafield once per variant. |
| `bulk-update-products` | Write | Update multiple products at once. Supports updating status, vendor, productType, category, and tags (add/remove/replace). |
| `cancel_order` | Write | Cancel an order; restocking and refundMethod are explicit decisions. This can refund money and cannot be undone. |
| `complete-draft-order` | Write | Convert a draft order into a real order. The draft order will be marked as completed and a new order will be created. |
| `count-products-by-tag` | Read | Get a count of products with and without a specific tag. Useful for tracking progress on bulk tagging operations. |
| `create_automatic_discount` | Write | Create a new automatic discount (basic, buy-X-get-Y or free shipping). Changes checkout pricing; supply dates, value and eligibility deliberately. |
| `create_blog` | Write | Create an online-store blog. |
| `create_blog_post` | Write | Create a blog post. Set its blog, author and publication state explicitly. |
| `create_code_discount` | Write | Create a new code discount (basic, buy-X-get-Y or free shipping). Changes checkout pricing; supply dates, value and eligibility deliberately. |
| `create_fulfillment` | Write | Create a fulfillment with tracking/fulfillment-order line items. Marks items fulfilled; notifyCustomer can email the customer. |
| `create_navigation_menu` | Write | Create a navigation menu with the supplied item tree. |
| `create_page` | Write | Create an online-store page. isPublished controls public visibility. |
| `create-collection` | Write | Create a custom or smart collection. Smart collections auto-populate based on rules (tag, vendor, price, etc.) |
| `create-draft-order` | Write | Create a new draft order. Use for quotes, manual orders, or B2B pricing. Line items can reference existing variants or be custom items. |
| `create-file-upload-session` | Write | Create a short-lived browser upload session for Shopify Files uploads in remote mode |
| `create-metafield-definition` | Write | Create a Shopify metafield definition and independently verify the exact created schema through a fresh read. |
| `create-metaobject` | Write | Create a new entry in an existing Shopify metaobject definition |
| `create-product` | Write | Create a new product with optional variants, pricing, and images |
| `create-product-option` | Write | Create an option and values on an existing product using productOptionsCreate |
| `create-redirect` | Write | Create a URL redirect (useful when deleting products to preserve SEO) |
| `deactivate_automatic_discount` | Write | Deactivate an existing automatic discount so it no longer applies at checkout. |
| `deactivate_code_discount` | Write | Deactivate an existing code discount so it no longer applies at checkout. |
| `delete_blog` | Write | Permanently delete a blog and its articles. |
| `delete_blog_post` | Write | Permanently delete a blog post. |
| `delete_navigation_menu` | Write | Permanently delete a navigation menu. |
| `delete_page` | Write | Permanently delete an online-store page. |
| `delete-collection` | Write | Delete a collection by ID. This does not delete the products in the collection. |
| `delete-metafield` | Write | Delete a specific metafield by ID |
| `delete-metaobject` | Write | Delete an existing Shopify metaobject entry by ID |
| `delete-product` | Write | Delete a product from the store. This action is irreversible. |
| `delete-product-images` | Write | Delete one or more images/media from a product |
| `delete-redirect` | Write | Delete a URL redirect by ID |
| `delete-variant` | Write | Delete a specific variant from a product. Cannot delete the last variant. |
| `detach-file-from-product` | Write | Remove an existing Shopify MediaImage file from a product without deleting the library file |
| `draft-orders` | Read | Get draft orders by ID or list/search draft orders. Use 'id' for single lookup, or use filters (status, query) to search. Draft orders are used for quotes, manual orders, and B2B pricing. |
| `find-products-by-metafield` | Read | List products that have, or do not have, a specific metafield set. Scans the catalog page by page (use the returned nextCursor to continue) since metafield-absence is not a server-side filter. Use 'present' to choose with/without/both. |
| `get_blog_post` | Read | Read one blog post and its HTML body; changes nothing. |
| `get_navigation_menu` | Read | Read one navigation menu and its items; changes nothing. |
| `get_page` | Read | Read one online-store page, including HTML body; changes nothing. |
| `get-bulk-operation-results` | Read | Download and parse results from a completed bulk operation. Returns summary, sample, or full data (capped at 1000 objects). |
| `get-bulk-operation-status` | Read | Check the status of a bulk operation. Returns progress info and download URL when complete. |
| `get-collections` | Read | List collections with optional filtering by title and type (smart/custom) |
| `get-customers` | Read | Get customers or search by name/email |
| `get-file-upload-session` | Read | Inspect the state of a remote browser upload session and the resulting Shopify file |
| `get-files` | Read | List Shopify Files library entries, including uploaded images and generic documents |
| `get-inventory-levels` | Read | Get inventory levels across locations, optionally filtered by product |
| `get-locations` | Read | Get all store locations. Use this to find location IDs needed for inventory operations. |
| `get-metafield-options` | Read | Resolve the selectable options for a metafield in one call. For metaobject-reference metafields it returns the available metaobject entries (id, handle, displayName). For choice-list metafields it returns the allowed choices. Saves chaining list-metafield-definitions -> list-metaobject-definitions -> list-metaobjects. |
| `get-metafields` | Read | Get metafields for a product, variant, customer, order, collection, or shop. Use `key`+`namespace` (single field) or `keys: ["namespace.key", …]` (multi) for server-side filtering via Shopify's metafields(keys:) arg — otherwise the response is truncated to `limit` (default 50) with no filter, which the agent may misread. Reminder for writes (set-metafield): `list.*_reference` types (e.g. custom.vehicle_year) expect a JSON array string value like '["gid://shopify/Metaobject/123"]'; singular `*_reference` types take a plain GID string. |
| `get-metaobject` | Read | Get a single Shopify metaobject entry by ID |
| `get-metaobject-definition` | Read | Inspect a single Shopify metaobject definition by type, including description, access, capabilities, and field definitions |
| `get-product-issues` | Read | Audit products for common issues: zero inventory, low stock, missing images, zero price. Returns counts and sample products for each issue. |
| `get-redirects` | Read | List URL redirects with optional filtering by path |
| `get-status` | Read | Get MCP connection status, store info, server mode, and granted scopes. Use this to verify the connection is working and see what store is connected. |
| `get-store-counts` | Read | Get comprehensive store counts in a single call: products (by status), variants, orders (by status), customers, and collections (by type). |
| `graphql_admin` | Query or mutation | Run any Admin GraphQL query or mutation within granted scopes. Mutations change store data and are refused in read-only mode; schema and variables are validated. |
| `list_automatic_discounts` | Read | List automatic discounts with status and pagination; changes nothing. |
| `list_blog_posts` | Read | Read blog posts and pagination; filter with a Shopify article search query. |
| `list_blogs` | Read | Read blogs and pagination to obtain a blog ID; changes nothing. |
| `list_code_discounts` | Read | List code discounts with status and pagination; changes nothing. |
| `list_fulfillment_orders` | Read | Read an order’s fulfillment orders, assigned locations and remaining line items; changes nothing. |
| `list_navigation_menus` | Read | Read navigation menus and up to three item levels; changes nothing. |
| `list_pages` | Read | Read online-store pages and pagination; changes nothing. |
| `list_shipping_profiles` | Read | Read delivery-profile IDs and rate counts; changes nothing. |
| `list_themes` | Read | Read themes and their publication roles; changes nothing. |
| `list-metafield-definitions` | Read | List metafield definitions (schema) for a given owner type so you can discover what custom metafields have been defined for products, collections, customers, orders, etc. Each definition now includes `constraints` — e.g. `{key:"category", values:["vp-2","vp-2-2-3",…]}` means the metafield only applies to products in those taxonomy categories. If you set such a metafield on a product outside the allowed categories, Shopify silently filters the value out on read. |
| `list-metaobject-definitions` | Read | List available Shopify metaobject definitions so you can discover which types and fields exist before creating entries |
| `list-metaobjects` | Read | List entries for an existing Shopify metaobject definition |
| `manage-collection-products` | Write | Add products to a collection, remove products from a collection, or list products in a collection |
| `orders` | Read | Get orders by ID, customer, or status. Use 'id' for single order lookup, 'customerId' to filter by customer, or 'status' to filter by order status. |
| `products` | Read | Get products by ID or search/filter products. Use 'id' for single product lookup, or use filters (title, status, vendor, tags, etc.) to search. |
| `read_shipping_rates` | Read | Read zones/rates in one profile location group. Nested cursors expose truncation; changes nothing. |
| `read_theme_files` | Read | Read theme files, including text/base64/URL bodies. Use filenames to select specific files; changes nothing. |
| `refund_order` | Write | Create an order refund; supplied transactions can move money. Supply exact line items, shipping and amounts. |
| `reorder-draft-product-media` | Write | Safely reorder the complete MediaImage order of a DRAFT product; preserves media IDs, alt text, files, and associations |
| `search-taxonomy` | Read | Search Shopify's standardized product taxonomy categories. Use to find category IDs for setting product categories. Call with no arguments to get top-level categories. Set includeAttributes to also see each category's attributes and option values. |
| `set_order_note` | Write | Replace an order’s note; does not change payment or fulfillment. |
| `set-metafield` | Write | Create or update a metafield on a product, variant, customer, order, collection, or shop. Use this to store custom data. |
| `shop_info` | Read | Read shop identity, currency, timezone, plan and granted app scopes; changes nothing. |
| `shop_policies` | Read | Read the published shipping, refund, privacy and terms policies; changes nothing. |
| `shopifyql_query` | Read | Run a read-only ShopifyQL query and return tableData/parseErrors. Traffic queries should use WHERE human_or_bot_session = 'human'. Requires read_reports and Shopify Level2 access. |
| `start-bulk-export` | Write | Start an async bulk export operation. Returns immediately with operation ID. Use get-bulk-operation-status to check progress. |
| `update_automatic_discount` | Write | Change an existing automatic discount (basic, buy-X-get-Y or free shipping). Changes checkout pricing; supply dates, value and eligibility deliberately. |
| `update_blog` | Write | Change a blog title, handle or settings. |
| `update_blog_post` | Write | Change a blog post; publishing or changing a published post affects the public store. |
| `update_code_discount` | Write | Change an existing code discount (basic, buy-X-get-Y or free shipping). Changes checkout pricing; supply dates, value and eligibility deliberately. |
| `update_fulfillment_tracking` | Write | Change tracking on an existing fulfillment; customer notification defaults to false. |
| `update_navigation_menu` | Write | Replace a menu’s item tree and change its title/handle. Read the existing tree first. |
| `update_page` | Write | Change an existing online-store page; published content changes publicly. |
| `update_url_redirect` | Write | Change an existing URL redirect’s source path or destination. |
| `update-collection` | Write | Update an existing collection's title, description, image, rules, or sort order |
| `update-customer` | Write | Update a customer's information |
| `update-draft-order` | Write | Update an existing draft order. Can modify line items, addresses, discounts, and more. |
| `update-inventory` | Write | Update inventory quantity at a specific location. Use delta to adjust by an amount, or setQuantity to set an exact value. |
| `update-inventory-item-customs` | Write | Update only country/province of origin and harmonized system code on one inventory item, then verify the write with a fresh read |
| `update-inventory-item-shipping` | Write | Update native weight and/or requiresShipping on one inventory item, then verify the write with a fresh read |
| `update-metafield-definition-access` | Write | Update only a metafield definition's Storefront API access and verify with a fresh read. |
| `update-metaobject` | Write | Update fields on an existing Shopify metaobject entry. Only the fields you pass are changed; omitted fields keep their current values. |
| `update-metaobject-definition` | Write | Add fields to an existing Shopify metaobject definition. This typed tool is additive-only and independently verifies every created field. |
| `update-order` | Write | Update an existing order with new information |
| `update-product` | Write | Update an existing product - can modify title, description, vendor, type, tags, status, price, SKU, and more |
