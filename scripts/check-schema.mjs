import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  buildSchema,
  Kind,
  NoUnusedFragmentsRule,
  parse,
  specifiedRules,
  validate,
} from "graphql";
import { adminOperations } from "../dist/tools/adminTools.js";
const schema = buildSchema(
  fs.readFileSync(
    new URL("../schema/admin-2026-10.graphql", import.meta.url),
    "utf8",
  ),
);
const issues = [],
  dynamic = [];
let checked = 0;
function check(document, label) {
  checked++;
  try {
    const ast = parse(document);
    const fragmentOnly = ast.definitions.every(
      (d) => d.kind === Kind.FRAGMENT_DEFINITION,
    );
    const rules = fragmentOnly
      ? specifiedRules.filter((r) => r !== NoUnusedFragmentsRule)
      : specifiedRules;
    const errors = validate(schema, ast, rules).map((e) => e.message);
    if (errors.length) issues.push({ label, errors });
  } catch (error) {
    issues.push({ label, errors: [error.message] });
  }
}
function walkDirectory(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(file);
      continue;
    }
    if (!file.endsWith(".ts")) continue;
    const text = fs.readFileSync(file, "utf8"),
      source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function walk(node) {
      if (
        ts.isTaggedTemplateExpression(node) &&
        node.tag.getText(source) === "gql"
      ) {
        const label =
          file +
          ":" +
          (source.getLineAndCharacterOfPosition(node.pos).line + 1);
        if (ts.isNoSubstitutionTemplateLiteral(node.template))
          check(node.template.text, label);
        else dynamic.push(label);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
}
walkDirectory("src");
for (const operation of adminOperations)
  check(operation.document, operation.name);
console.log(
  JSON.stringify(
    {
      schema: "2026-10",
      checked,
      issues,
      dynamicDocuments: dynamic,
      runtimeGuard:
        "All dispatched documents, including dynamic/generic requests, are validated before Shopify fetch",
    },
    null,
    2,
  ),
);
if (issues.length) process.exitCode = 1;
