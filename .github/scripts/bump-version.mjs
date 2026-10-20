import { readFileSync, writeFileSync } from "node:fs";

const MANIFESTS = [
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  "openai/plugin.json",
  "gemini-extension.json",
];
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const USAGE = 'Usage: node .github/scripts/bump-version.mjs <patch|minor|major|X.Y.Z> "<change>" ["<change>" ...]';

function exit(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

function nextVersion(current, bump) {
  const [, major, minor, patch] = current.match(VERSION).map(Number);
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "major") return `${major + 1}.0.0`;
  if (!VERSION.test(bump)) exit(`"${bump}" is not patch, minor, major or an X.Y.Z version.`);
  return bump;
}

function isNewer(candidate, current) {
  const [a, b] = [candidate, current].map((version) => version.match(VERSION).slice(1).map(Number));
  const index = a.findIndex((part, i) => part !== b[i]);
  return index !== -1 && a[index] > b[index];
}

const [bump, ...changes] = process.argv.slice(2);
if (!bump) exit("Missing the version to bump to.");
if (changes.length === 0) exit("Describe at least one change for the changelog.");

const current = JSON.parse(readFileSync(MANIFESTS[0], "utf8")).version;
const version = nextVersion(current, bump);
if (!isNewer(version, current)) exit(`${version} must be newer than the current version, ${current}.`);

const changelog = readFileSync("CHANGELOG.md", "utf8");
if (changelog.includes(`\n## ${version}\n`)) exit(`CHANGELOG.md already has a ${version} section.`);
if (!changelog.startsWith("# Changelog\n\n")) exit('CHANGELOG.md must start with a "# Changelog" heading.');

for (const path of MANIFESTS) {
  const manifest = readFileSync(path, "utf8");
  writeFileSync(path, manifest.replace(/"version": "[^"]+"/, `"version": "${version}"`));
}

const section = `## ${version}\n\n${changes.map((change) => `- ${change}`).join("\n")}\n\n`;
writeFileSync("CHANGELOG.md", changelog.replace("# Changelog\n\n", `# Changelog\n\n${section}`));

console.log(`Bumped ${current} → ${version} in ${MANIFESTS.join(", ")} and added it to CHANGELOG.md.`);
