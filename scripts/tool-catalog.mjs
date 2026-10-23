import { writeFileSync } from "node:fs";
import { toolsForMode } from "../dist/toolRegistry.js";
import { READ_ONLY_TOOL_NAMES, WRITE_TOOL_NAMES } from "../dist/toolAccess.js";
const tools = toolsForMode(true)
  .map((t) => ({
    name: t.name,
    access:
      t.name === "graphql_admin"
        ? "Query or mutation"
        : READ_ONLY_TOOL_NAMES.has(t.name) && !WRITE_TOOL_NAMES.has(t.name)
          ? "Read"
          : "Write",
    description: t.description.replaceAll("|", "\\|").replaceAll("\n", " "),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const output =
  "# Remote tool catalog\n\n" +
  tools.length +
  " tools. Available definitions do not imply that Shopify granted every scope. `graphql_admin` is query-only in read-only mode. The local-only upload tool is excluded remotely.\n\n| Tool | Access | Description |\n|---|---|---|\n" +
  tools
    .map((t) => `| \`${t.name}\` | ${t.access} | ${t.description} |`)
    .join("\n") +
  "\n";
writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), output);
console.log(
  JSON.stringify({
    remoteTools: tools.length,
    read: tools.filter((t) => t.access === "Read").length,
    write: tools.filter((t) => t.access === "Write").length,
    generic: 1,
  }),
);
