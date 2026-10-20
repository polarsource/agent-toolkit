import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SDK_VERSION = process.env.POLAR_SDK_VERSION || "latest";
const DEPENDENCIES = [`@polar-sh/sdk@${SDK_VERSION}`, "typescript@5.9.3", "vitest@3.2.4", "@types/node@24"];
const FENCE_START = /^(\s*)```(ts|typescript)\s*$/;
const FENCE_END = /^\s*```\s*$/;
const USES_SDK = /@polar-sh\/sdk|\bpolar\.|\bevent\./;
const ELIDED = /^\s*\/\/ \.\.\./m;
const CLIENT = /^export const polar\b/m;
const WEBHOOK_CASE = /^case /;
const TSC_ERROR = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const MISSING_RELATIVE_MODULE = /^Cannot find module '\.\.?\//;
const CLIENT_DECLARATION = `declare const polar: typeof import("./polar").polar;\n`;
const PRELUDE = `declare function getUserId(request: Request): Promise<string | undefined>;
declare function recordMigratedSubscription(ids: { stripeSubscriptionId: string; polarSubscriptionId: string }): Promise<void>;
declare const polarCustomerId: string;
declare const appCustomerId: string;
declare const productId: string;
declare const email: string;
declare const name: string;
`;
const TSCONFIG = {
  compilerOptions: {
    target: "es2023",
    lib: ["es2023"],
    module: "preserve",
    moduleResolution: "bundler",
    moduleDetection: "force",
    resolveJsonModule: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["*.ts"],
};

function codeBlocks(path) {
  const blocks = [];
  let block = null;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (!block) {
        const start = line.match(FENCE_START);
        if (start) block = { path, line: index + 1, indent: start[1].length, lines: [] };
      } else if (FENCE_END.test(line)) {
        blocks.push({ ...block, code: block.lines.join("\n") });
        block = null;
      } else {
        block.lines.push(line.slice(block.indent));
      }
    });
  return blocks;
}

const documents = readdirSync("skills").map((skill) => join("skills", skill, "SKILL.md"));
const blocks = documents.flatMap(codeBlocks);
const checked = blocks.filter((block) => USES_SDK.test(block.code) && !ELIDED.test(block.code));
const client = checked.find((block) => CLIENT.test(block.code));
const sdkModule = client?.code.match(/"(@polar-sh\/sdk[^"]*)"/)?.[1];
const compiled = checked.filter((block) => sdkModule || !WEBHOOK_CASE.test(block.code));

const directory = mkdtempSync(join(tmpdir(), "polar-samples-"));
const files = new Map();
for (const block of compiled) {
  const file = block === client ? "polar.ts" : `${block.path.split("/")[1]}-${block.line}.ts`;
  const prefix = WEBHOOK_CASE.test(block.code)
    ? [`import { webhooks } from "${sdkModule}";`, "export async function handle(event: webhooks.WebhookPayload) {", "switch (event.type) {"]
    : [];
  const suffix = prefix.length > 0 ? ["}", "}"] : [];
  files.set(file, { ...block, offset: prefix.length });
  writeFileSync(join(directory, file), [...prefix, block.code, ...suffix, ""].join("\n"));
}
writeFileSync(join(directory, "prelude.d.ts"), (client ? CLIENT_DECLARATION : "") + PRELUDE);
writeFileSync(join(directory, "tsconfig.json"), JSON.stringify(TSCONFIG));

execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error", ...DEPENDENCIES], {
  cwd: directory,
  stdio: "inherit",
});
const sdk = JSON.parse(readFileSync(join(directory, "node_modules/@polar-sh/sdk/package.json"), "utf8"));
console.log(`Type-checking ${compiled.length} of ${blocks.length} TypeScript samples against @polar-sh/sdk ${sdk.version}`);

const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--pretty", "false"], {
  cwd: directory,
  encoding: "utf8",
});
const errors = tsc.stderr ? [{ location: "tsc", message: tsc.stderr.trim() }] : [];
if (!client) errors.push({ location: "skills", message: "No TypeScript sample exports the `polar` client that the other samples import" });
for (const output of tsc.stdout.split("\n")) {
  if (!output.includes("error TS")) continue;
  const match = output.match(TSC_ERROR);
  const block = match && files.get(match[1]);
  if (!block) {
    errors.push({ location: "tsc", message: output });
    continue;
  }
  const [, , line, column, code, message] = match;
  if (code === "TS2307" && MISSING_RELATIVE_MODULE.test(message)) continue;
  const documentLine = block.line + Number(line) - block.offset;
  errors.push({
    location: `${block.path}:${documentLine}:${Number(column) + block.indent}`,
    message: `${code} ${message}`,
    annotation: `file=${block.path},line=${documentLine}`,
  });
}

if (errors.length > 0) {
  for (const { location, message, annotation } of errors) {
    console.error(`✘ ${location} ${message}`);
    if (process.env.GITHUB_ACTIONS && annotation) console.log(`::error ${annotation}::${message}`);
  }
  process.exit(1);
}
console.log("✔ TypeScript samples compile");
