---
name: polar-config-ci
description: |
  Set up CI for a Polar billing config (polar.config.ts or polar.config.json). Use this skill whenever the user wants to: (1) show the changes a pull request makes to the config as a comment on it, with polar config validate --pr-comment; (2) save the config to the draft or publish it when a pull request merges; (3) create the access tokens and repository secrets CI needs for that; (4) fix a config workflow that fails in GitHub Actions or Buildkite.
---

# Polar billing config in CI

This skill needs a billing config in the repository. If the project has no `polar.config.ts` or `polar.config.json` yet, use the `polar-config` skill first: it also explains what `validate`, `draft` and `publish` do.

CI can show every pricing change to a billing config on its pull request and release it when the pull request merges. Set this up when the user asks for it, and ask them two things first:

- **What should a merge do?** Save the draft only, so a person publishes it afterwards with `polar config publish` or in the dashboard, or draft and publish. Publishing from CI makes a merged pricing change live with no further step, so add it only when the user says so.
- **Which organization does CI release to?** Usually production. For a sandbox organization, set `POLAR_ENVIRONMENT: sandbox` on the steps that run `polar`.

CI signs in with organization access tokens instead of a login. Ask the user to create two and store them as repository secrets. Piping straight into `gh secret set` keeps the token off the screen:

```bash
polar auth token --scope organizations:read --scope meters:read --scope benefits:read --scope products:read | gh secret set POLAR_READ_TOKEN
polar auth token --scope organizations:write --scope meters:write --scope benefits:write --scope products:write | gh secret set POLAR_WRITE_TOKEN
```

The first can only read and is for pull requests. The second writes and is for the main branch. Add `custom_fields:read` and `custom_fields:write` when the config has custom fields.

A GitHub Actions workflow for a TypeScript config:

```yaml
name: Polar billing config

on:
  pull_request:
    paths: [polar.config.ts]
  push:
    branches: [main]
    paths: [polar.config.ts]

jobs:
  validate:
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm install -g @polar-sh/cli
      - run: polar config validate --pr-comment
        env:
          POLAR_ACCESS_TOKEN: ${{ secrets.POLAR_READ_TOKEN }}
          GITHUB_TOKEN: ${{ github.token }}

  release:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm install -g @polar-sh/cli
      - run: polar config draft --confirm
        env:
          POLAR_ACCESS_TOKEN: ${{ secrets.POLAR_WRITE_TOKEN }}
      - run: polar config publish --confirm
        env:
          POLAR_ACCESS_TOKEN: ${{ secrets.POLAR_WRITE_TOKEN }}
```

- Leave the `publish` step out when a merge should only save the draft.
- `validate --pr-comment` posts what would change as one comment on the pull request, updates it on every push and removes it when the config no longer changes anything. It needs `GITHUB_TOKEN` and the `pull-requests: write` permission. It fails the job when the config has errors, so a broken config cannot merge.
- The `validate` job skips pull requests from forks. They get no secrets, so the job would fail without a token.
- When the config is not at the repository root, set `working-directory` on the steps that run `polar` and use the file's full path in `paths`.
- `npm ci` is there because a TypeScript config imports its package. For a JSON config, drop it, point `paths` at `polar.config.json`, and add `polar config generate --check` to the `validate` job when the project generates names with `polar config generate`.
- `environment: production` is a GitHub environment. Suggest a required reviewer on it: a pricing change then needs a person's approval after the merge and before it reaches Polar.
- `draft` stops in CI too when the draft on Polar has changes the file does not have. Do not add `--force` on your own. Ask the user whether the main branch should always win over a draft someone saved from their machine, and add it only if they say yes.
- `--pr-comment` also works in Buildkite for a repository on GitHub. On any other CI system, run the same commands without it and read the job's output.
