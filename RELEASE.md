# Releasing a new version

Every release gets a version number, a changelog entry, a `vX.Y.Z` tag and a GitHub release. The tag, the release and the OpenAI ZIP are created automatically when the release PR is merged.

## 1. Bump the version and add a changelog entry

On a new branch from `main`, run:

```bash
node .github/scripts/bump-version.mjs patch 'Change 1', 'Change 2'
```

Use `patch`, `minor` or `major`, or an exact version such as `0.2.0`. Each quoted argument becomes one bullet. Use single quotes so backticks stay literal. The script sets the version in all four manifests (`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `openai/plugin.json` and `gemini-extension.json`) and adds a section for it at the top of `CHANGELOG.md`. That section becomes the GitHub release notes, so write it for people who use the plugin. You can still edit it before committing.

## 2. Open the pull request

The [Validate plugin](https://github.com/polarsource/agent-toolkit/actions/workflows/validate.yml) workflow checks that the four versions match and that `CHANGELOG.md` has a section for the new version. It also installs and validates the plugin in Claude Code, Codex, Cursor, Gemini CLI and Antigravity, and checks every `polar` CLI command the docs mention against the published CLI. Merge once it passes.

## 3. Check the release run

Merging runs the **Release** workflow. In the repository's Actions tab, check that it:

1. passed the plugin checks,
2. created the `vX.Y.Z` tag and GitHub release with your changelog notes,
3. attached the `polar-openai-X.Y.Z` ZIP to the run as an artifact.

If it fails, fix the cause on `main`, then start it again from **Actions → Release → Run workflow**. It skips the release if the tag already exists and always rebuilds the ZIP.

## 4. Update each listing

| Where | What to do |
| --- | --- |
| Anthropic's plugin directory | Nothing. It rescans `main`, and a reviewer approves the new version. Check its status at [claude.ai/directory/manage](https://claude.ai/directory/manage). |
| OpenAI's plugin directory | Only if skills, test cases, listing metadata or the MCP URL changed: download the `polar-openai-X.Y.Z` artifact from the release run, upload it at [platform.openai.com/plugins](https://platform.openai.com/plugins) and submit it for review. Changes to the MCP server's tools need no upload. OpenAI rescans the server daily and holds new tools for review. |
| Cursor Marketplace | Cursor reviews every update. Check the plugin's status in Cursor's publisher dashboard, and resubmit at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) if the new version doesn't show up for review. |
| Gemini CLI extension gallery | Nothing. It indexes new tags daily, as long as the repository has the `gemini-cli-extension` topic. |
| GitHub installs | Nothing. Users of Claude Code, Codex, Cursor, Gemini CLI and Antigravity get the new version when they update the plugin. |

## Recording a new demo video

OpenAI's review needs a demo video of the test cases in `openai/plugin.json`. When the test cases or the tools they use change, record a new one and store its link as a repository secret:

```bash
gh secret set OPENAI_DEMO_RECORDING_URL --repo polarsource/agent-toolkit
```

Then rebuild the ZIP from **Actions → Release → Run workflow**. The link must open without signing in, and the video shouldn't show the review account's login code.

## Changing the MCP server URLs

Each agent reads the servers from a different file, so update all four: `.mcp.json`, `gemini-extension.json`, `mcp_config.json` and `openai/mcp.json`. The plugin checks fail if they disagree.
