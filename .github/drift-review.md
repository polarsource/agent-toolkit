# Weekly skill drift review

You maintain the Polar agent skills in `skills/`. Coding agents follow them to integrate Polar, so a wrong command, field or claim breaks real integrations. Polar's monorepo is checked out at `../polar`.

Find and fix significant drift between the skills and what Polar ships. Below this prompt are the results of this repository's checks and the monorepo commits merged since the last review.

## What to fix

- Every failing check below.
- Code, commands, flags, fields, event names, environment variables, URLs or dashboard paths that no longer match what Polar ships.
- Claims that contradict Polar's code or docs, such as limits, retry behavior or which events fire.
- A path Polar now recommends instead of the one a skill teaches.

## What to leave alone

- Wording, style, formatting and ordering.
- Polar features the skills don't cover yet.
- Anything not released yet. The skills target the latest published `@polar-sh/sdk` and `@polar-sh/cli` (`npm view <package> version`), so ignore `[Unreleased]` changelog entries. The API, MCP server and docs deploy from `main`.
- Anything you can't confirm in `../polar`. A missed fix is cheaper than a wrong one.

## How to work

1. Read every `skills/*/SKILL.md`.
2. Triage the commits by subject. For each one that could affect a skill, run `git -C ../polar show --stat <sha>`, then `git -C ../polar show <sha> -- <path>` for the files that matter. For SDK and CLI releases, read `../polar/sdk/CHANGELOG.md` and `../polar/clients/packages/cli/CHANGELOG.md`. For SDK usage, the SDK team's reference is `../polar/sdk/typescript/.agents/skills/polar-typescript-sdk/`.
3. Confirm each suspected drift in the current files under `../polar` before you change anything.
4. Edit only `skills/`, `README.md` and `CHANGELOG.md`. Keep each change minimal and match the surrounding style.
5. Run these until they pass, exactly as written, without pipes or `cd`:
   - `node .github/scripts/check-plugin.mjs`
   - `node .github/scripts/check-samples.mjs`
   - `node .github/scripts/check-plugin.mjs --cli <Polar CLI path from "This run">`
   - `node .github/scripts/check-plugin.mjs --links`
6. Record the changes as "This run" says: either run `node .github/scripts/bump-version.mjs patch '<change>' ...`, or add the lines to the top section of `CHANGELOG.md`. Write one line per change, for people who use the plugin.
7. Write `DRIFT_SUMMARY.md` in the repository root. It becomes the pull request description:
   - One bullet per change: the skill, what was wrong, what it says now, and the evidence. Link evidence as `https://github.com/polarsource/polar/blob/<monorepo commit>/<path>#L<line>`, or name the failing check.
   - A short "Checked, no change needed" list of the commits that looked relevant but weren't, one line each.

If nothing needs fixing, change no files and don't write `DRIFT_SUMMARY.md`.
