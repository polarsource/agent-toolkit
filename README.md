# Polar Agent Toolkit

[![Validate plugin](https://github.com/polarsource/agent-toolkit/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/polarsource/agent-toolkit/actions/workflows/validate.yml)
[![Skill drift review](https://github.com/polarsource/agent-toolkit/actions/workflows/drift.yml/badge.svg)](https://github.com/polarsource/agent-toolkit/actions/workflows/drift.yml)
[![Latest release](https://img.shields.io/github/v/release/polarsource/agent-toolkit)](https://github.com/polarsource/agent-toolkit/releases/latest)
[![License](https://img.shields.io/github/license/polarsource/agent-toolkit)](https://github.com/polarsource/agent-toolkit/blob/main/LICENSE)

Polar's plugin for AI coding agents. It connects your agent to [Polar](https://polar.sh), the open-source payment infrastructure platform, so it can set up products, checkouts, customer portals and webhooks in your app, test them against the Polar sandbox, and help you migrate from another payment provider.

The skills follow the [Agent Skills](https://agentskills.io/) format, so they also work in agents that don't support plugins.

## What's included

### MCP servers

| Server | URL | Use it for |
| --- | --- | --- |
| `polar` | `https://mcp.polar.sh/mcp/polar-mcp` | Your live Polar organization |
| `polar-sandbox` | `https://mcp.polar.sh/mcp/polar-sandbox` | Test data on [sandbox.polar.sh](https://sandbox.polar.sh) |

Both servers use OAuth. Nothing connects until you sign in to Polar and authorize an organization.

### Skills

| Skill | What it does |
| --- | --- |
| `setup-polar` | Guided setup from scratch: connects the MCP server, creates an organization and a first product, then hands off to `polar-integration`. |
| `polar-integration` | Adds Checkout, Customer Portal and Webhooks endpoints with `@polar-sh/sdk` to any TS/JS framework, including Next.js, Express, Hono, Astro, SvelteKit, Remix, Nuxt and Cloudflare Workers. |
| `polar-testing` | Tests an integration against the sandbox: test cards, local webhooks with the Polar CLI (`polar webhook listen`, `polar webhook trigger`), mocks and CI. |
| `polar-migration` | Guides a migration to Polar: Polar's assisted migration from Stripe Billing, or recreating the catalog and moving customers from Paddle, Lemon Squeezy and others. |

## Installation

### Claude Code

```
/plugin install polar --marketplace polarsource/agent-toolkit
```

Then run `/mcp`, select `polar` or `polar-sandbox` and sign in to Polar in your browser. Skills are available as `/polar:setup-polar`, `/polar:polar-integration` and so on, and Claude also uses them on its own when a task matches.

### Codex

```bash
codex plugin marketplace add polarsource/agent-toolkit
codex plugin add polar@polar
```

Then sign in to Polar in your browser with `codex mcp login polar` or `codex mcp login polar-sandbox`. Codex uses the skills on its own when a task matches.

### Cursor

In Cursor, open **Customize**, choose **From GitHub Repository** and enter `https://github.com/polarsource/agent-toolkit`. Then sign in to `polar` or `polar-sandbox` from Cursor's MCP settings.

### Gemini CLI

```bash
gemini extensions install https://github.com/polarsource/agent-toolkit
```

Then sign in to Polar with `/mcp auth polar` or `/mcp auth polar-sandbox`.

### Antigravity

```bash
agy plugin install https://github.com/polarsource/agent-toolkit
```

Then sign in to `polar` or `polar-sandbox` from Antigravity's MCP settings.

### Other agents

Install the skills with [skills](https://github.com/vercel-labs/skills):

```bash
npx skills add https://github.com/polarsource/agent-toolkit
```

Then connect the MCP server by following the [Polar MCP guide](https://polar.sh/docs/integrate/mcp) for your client.

## Example prompts

- "Add Polar checkout and a webhook handler for my Pro plan to this Next.js app"
- "What's my MRR this month, and how does churn compare to last month?"
- "Why are customers canceling their subscriptions? Break it down by reason."
- "Send a sandbox `order.paid` event to my local webhook handler and check that it works"
- "Create a 25% off launch discount for my yearly plan"

## Data and privacy

The plugin contains instructions and MCP server configuration only. It runs no scripts or hooks on your machine and sends no telemetry itself. The scripts in `.github/` are for maintaining this repository, and the plugin never runs them.

When you use the MCP servers, your agent sends requests to `mcp.polar.sh` over HTTPS. They read and change data in the Polar organization you authorized, such as products, customers, subscriptions and orders, within the permissions you granted. To disconnect, clear the server's authentication in `/mcp` in Claude Code, run `codex mcp logout <server>` in Codex, or uninstall the plugin. Polar handles this data under its [Privacy Policy](https://polar.sh/legal/privacy-policy) and [Terms of Service](https://polar.sh/legal/master-services-terms).

The skills also ask your agent to run commands and write code that talk to these services:

- **Polar API** (`api.polar.sh`, `sandbox-api.polar.sh`): the integration code, tests and Polar CLI commands the skills set up call it with your own access token or CLI login.
- **Polar CLI telemetry** (PostHog): `setup-polar` and `polar-testing` install the [Polar CLI](https://polar.sh/docs/integrate/cli/introduction), which sends one anonymous event per command, such as the command name, duration, CLI version and OS. It never sends access tokens, organization IDs, URLs or payloads. Opt out with `POLAR_CLI_TELEMETRY_OPTOUT=1`.
- **npm registry**: to install `@polar-sh/cli` and `@polar-sh/sdk`.
- **Your current payment provider** (Stripe, Paddle or Lemon Squeezy): `polar-migration` may read your existing billing code and data with your own API keys to map customers and products to Polar. Stripe migrations themselves run in Polar's dashboard.

## Support

- [Polar documentation](https://polar.sh/docs)
- [Contact Polar support](https://polar.sh/docs/support)
- [Report an issue with this plugin](https://github.com/polarsource/agent-toolkit/issues)

## License

[MIT](LICENSE)
