import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const MANIFESTS = [
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  "openai/plugin.json",
  "gemini-extension.json",
];
const NAMED_FILES = [...MANIFESTS, "plugin.json"];
const MARKETPLACES = [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json"];
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const MAX_FILES = 512;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_FILE_BYTES = 256 * 1024;
const PIPE_TO_SHELL = /(curl|wget)\b[^\n]*\|\s*(ba|z)?sh\b|\|\s*iex\b/;
const JUNK_FILES = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX)(\/|$)/;
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkNames() {
  for (const path of NAMED_FILES) {
    if (readJson(path).name !== "polar") fail(`${path}: name must be "polar"`);
  }
  for (const path of MARKETPLACES) {
    const names = readJson(path).plugins.map((plugin) => plugin.name);
    if (names.join() !== "polar") fail(`${path}: must list exactly the "polar" plugin`);
  }
}

function checkVersions() {
  const versions = Object.fromEntries(MANIFESTS.map((path) => [path, readJson(path).version]));
  if (new Set(Object.values(versions)).size !== 1) {
    fail(`versions differ: ${JSON.stringify(versions)}`);
  }
}

function serverUrls(path, key) {
  const servers = readJson(path).mcpServers;
  return Object.fromEntries(Object.entries(servers).map(([name, server]) => [name, server[key]]));
}

function checkMcpServers() {
  const expected = serverUrls(".mcp.json", "url");
  const variants = {
    "gemini-extension.json": serverUrls("gemini-extension.json", "httpUrl"),
    "mcp_config.json": serverUrls("mcp_config.json", "serverUrl"),
  };
  for (const [path, servers] of Object.entries(variants)) {
    if (JSON.stringify(servers) !== JSON.stringify(expected)) {
      fail(`${path}: servers ${JSON.stringify(servers)} differ from .mcp.json ${JSON.stringify(expected)}`);
    }
  }
  if (readJson(".cursor-plugin/plugin.json").mcpServers !== "./.mcp.json") {
    fail(`.cursor-plugin/plugin.json: mcpServers must point at ./.mcp.json`);
  }
  const openai = serverUrls("openai/mcp.json", "url");
  const expectedOpenai = { polar: `${expected.polar}?codemode=false` };
  if (JSON.stringify(openai) !== JSON.stringify(expectedOpenai)) {
    fail(`openai/mcp.json: expected ${JSON.stringify(expectedOpenai)}, got ${JSON.stringify(openai)}`);
  }
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const field = lines[i].match(/^([a-z-]+):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].trim();
    if (value === "|" || value === ">") {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(" ");
    }
    fields[field[1]] = value.replace(/^["']|["']$/g, "");
  }
  return fields;
}

function checkSkills() {
  for (const directory of readdirSync("skills")) {
    const path = join("skills", directory, "SKILL.md");
    const fields = frontmatter(readFileSync(path, "utf8"));
    if (!fields) {
      fail(`${path}: missing frontmatter`);
      continue;
    }
    if (fields.name !== directory) fail(`${path}: name "${fields.name}" must match its folder`);
    if (!SKILL_NAME.test(directory) || directory.length > 64) {
      fail(`${path}: folder name must be lowercase kebab-case, at most 64 characters`);
    }
    const length = fields.description?.length ?? 0;
    if (length < 1 || length > 1024) fail(`${path}: description must be 1-1024 characters, is ${length}`);
  }
}

function checkFiles() {
  const files = execFileSync("git", ["ls-files", "-s"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => line.match(/^(\d+) \S+ \d+\t(.+)$/));
  if (files.length > MAX_FILES) fail(`${files.length} files, the directory limit is ${MAX_FILES}`);
  for (const [, mode, path] of files) {
    if (mode === "120000") fail(`${path}: symlinks are not allowed`);
    if (mode === "160000") fail(`${path}: submodules are not allowed`);
    if (JUNK_FILES.test(path)) fail(`${path}: remove OS junk files`);
    if (mode !== "100644" && mode !== "100755") continue;
    const size = statSync(path).size;
    const image = IMAGE_EXTENSIONS.has(extname(path).toLowerCase());
    if (size > MAX_FILE_BYTES) fail(`${path}: ${size} bytes, the limit is ${MAX_FILE_BYTES}`);
    if (!image && size > MAX_TEXT_FILE_BYTES) fail(`${path}: ${size} bytes, the limit for non-images is ${MAX_TEXT_FILE_BYTES}`);
    if (!image && PIPE_TO_SHELL.test(readFileSync(path, "utf8"))) {
      fail(`${path}: pipes a download into a shell, which plugin scanners flag`);
    }
  }
}

function codeSnippets(text) {
  const snippets = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) snippets.push(line);
    else for (const [, code] of line.matchAll(/`([^`\n]+)`/g)) snippets.push(code);
  }
  return snippets;
}

function cliCommands() {
  const commands = new Map();
  const documents = ["README.md", ...readdirSync("skills").map((directory) => join("skills", directory, "SKILL.md"))];
  for (const document of documents) {
    for (const snippet of codeSnippets(readFileSync(document, "utf8"))) {
      for (const [, rest] of snippet.matchAll(/(?:^|[\s($])polar ([^#|;&>)]*)/g)) {
        const tokens = rest.trim().split(/\s+/);
        const path = [];
        for (const token of tokens) {
          if (path.length === 2 || !/^[a-z][a-z-]*$/.test(token)) break;
          path.push(token);
        }
        if (path.length === 0) continue;
        const command = path.join(" ");
        const flags = commands.get(command) ?? new Set();
        for (const token of tokens) if (token.startsWith("--")) flags.add(token.split("=")[0]);
        commands.set(command, flags);
      }
    }
  }
  return commands;
}

function checkCli(binary) {
  for (const [command, flags] of cliCommands()) {
    const help = execFileSync(binary, [...command.split(" "), "--help"], { encoding: "utf8" });
    if (!new RegExp(`USAGE\\s+polar ${command}\\b`).test(help)) {
      fail(`polar ${command}: no such command in the published CLI`);
      continue;
    }
    for (const flag of flags) {
      if (!new RegExp(`${flag}\\b`).test(help)) fail(`polar ${command}: no ${flag} flag in the published CLI`);
    }
    console.log(`polar ${command} ${[...flags].join(" ")}`.trim());
  }
}

const cliFlag = process.argv.indexOf("--cli");
if (cliFlag === -1) {
  checkNames();
  checkVersions();
  checkMcpServers();
  checkSkills();
  checkFiles();
} else {
  checkCli(process.argv[cliFlag + 1]);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `✘ ${error}`).join("\n"));
  process.exit(1);
}
console.log("✔ Plugin checks passed");
