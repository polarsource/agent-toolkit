# Changelog

## 0.2.4

- `setup-polar` and `polar-integration` now start a first-time setup by asking whether you have a Polar organization, want the agent to create one, or will create it yourself, and suggest starting in sandbox.
- `setup-polar` and the README set agents up with `polar agent setup` from the Polar CLI instead of connecting the MCP server by hand.
- `setup-polar` and `polar-testing` no longer use `@example.com` email addresses, which Polar rejects at checkout.
- `polar-integration` tells agents to put the claim link and code in their reply, so the user can claim an organization the agent created.
- `polar-migration`: Stripe migrations are open to every organization that is ready to sell, so the skill no longer says they are rolling out gradually.

## 0.2.3

- Tell agents without a Polar account to read https://polar.sh/auth.md to sign up on their own in `polar-integration`.

## 0.2.2

- Update the Polar logo used by the plugins.

## 0.2.1

- Point access token instructions at the dashboard's new Settings → Access Tokens page in `polar-integration`, `polar-testing` and `setup-polar`.
- Offer `polar auth token` as a way to create the access token in the same skills.

## 0.2.0

- Update the skills to `@polar-sh/sdk` 1.x
- Rewrite `polar-migration` around Polar's assisted Stripe migration

## 0.1.0

- First release: the Polar MCP servers (`polar` and `polar-sandbox`) and the `setup-polar`, `polar-integration`, `polar-testing` and `polar-migration` skills, for Claude Code, Codex, Cursor, Gemini CLI and Antigravity.
