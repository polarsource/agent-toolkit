# Releasing a new version

Every release gets a version number, a changelog entry, a `vX.Y.Z` tag and a GitHub release. The tag, the release and the OpenAI ZIP are created automatically when the release PR is merged.

## 1. Bump the version and add a changelog entry

On a new branch from `main`:

* Set the new version in all four manifests: `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `openai/plugin.json` and `gemini-extension.json`.
* Add a `## X.Y.Z` section at the top of `CHANGELOG.md` with one bullet per change. That section becomes the release notes on GitHub and in the OpenAI ZIP, so write it for people who use the plugin.

## 2. Open the pull request

The [Validate plugin](https://github.com/polarsource/agent-toolkit/actions/workflows/validate.yml) workflow checks that the four versions match and that `CHANGELOG.md` has a section for the new version. It also installs and validates the plugin.

## 3. Merge the pull request

Merging runs the [Release](https://github.com/polarsource/agent-toolkit/actions/workflows/release.yml) workflow, which creates the `vX.Y.Z` tag and the GitHub release with your changelog notes, with the `polar-openai-X.Y.Z.zip` attached.

## 4. Update each listing

| Where | What to do |
| --- | --- |
| OpenAI | Download `polar-openai-X.Y.Z.zip` from the [GitHub release](https://github.com/polarsource/agent-toolkit/releases/latest), upload it at [platform.openai.com/plugins](https://platform.openai.com/plugins) and submit it for review. Skip this only if the release changed nothing in the ZIP, which holds `skills/`, `openai/`, `README.md` and the logo. Changes to the MCP server's tools ship from the Polar monorepo, and OpenAI picks those up on its own. |
| Cursor | Cursor reviews every update. Check the plugin's status in Cursor's publisher dashboard, and resubmit at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) if the new version doesn't show up for review. |
| Gemini | **Nothing**. It indexes new tags daily, as long as the repository has the `gemini-cli-extension` topic. |
| Anthropic | **Nothing**. It rescans `main`, and a reviewer approves the new version. Check its status at [claude.ai/directory/manage](https://claude.ai/directory/manage). |

## OpenAI: Recording a new demo video

OpenAI's review needs a video of the test cases in `openai/plugin.json`. Every ZIP reuses the current one, so only record a new video when the test cases change, the tools they call change, or OpenAI asks for it.

Record the test cases in the Codex app with the release ZIP installed, signed in as the review account. Upload the video to that account's Google Drive with link sharing, then run `gh secret set OPENAI_DEMO_RECORDING_URL --repo polarsource/agent-toolkit` and re-run the Release workflow.

## Changing the MCP server URLs

Each agent reads the servers from a different file, so update all four: `.mcp.json`, `gemini-extension.json`, `mcp_config.json` and `openai/mcp.json`. The plugin checks fail if they disagree.

## Repository scripts

The scripts CI runs (`check-plugin.mjs`, `check-samples.mjs` and `bump-version.mjs`) are embedded in `.github/actions/scripts/action.yml` instead of kept as `.mjs` files, so the repository only holds file types the Claude directory accepts. To run one locally, extract it by its `env` name first:

```bash
ruby -ryaml -e 'print YAML.load_file(".github/actions/scripts/action.yml").dig("runs", "steps", 0, "env", "CHECK_PLUGIN")' > /tmp/check-plugin.mjs && node /tmp/check-plugin.mjs
```
