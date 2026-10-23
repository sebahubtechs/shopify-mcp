// Local workerd smoke-test entry point; never used by production wrangler.jsonc.
import "./shopify-fetch.mjs";
export { default, ShopifyMcpHost } from "../../cloudflare/worker.mjs";
