# Polar Agent Toolkit

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
| `polar-testing` | Tests an integration against the sandbox: test cards, local webhooks with the Polar CLI (`polar listen`, `polar trigger`), mocks and CI. |
| `polar-migration` | Plans and runs a migration from Stripe Billing, Paddle, Lemon Squeezy or Gumroad. |

## Installation

### Claude Code

```
/plugin install polar --marketplace polarsource/agent-toolkit
```

On Claude Code versions before 2.1.275, add the marketplace first:

```
/plugin marketplace add polarsource/agent-toolkit
/plugin install polar@polar
```

Then run `/mcp`, select `polar` or `polar-sandbox` and sign in to Polar in your browser. Skills are available as `/polar:setup-polar`, `/polar:polar-integration` and so on, and Claude also uses them on its own when a task matches.

### Other agents

Install the skills with [skills](https://github.com/vercel-labs/skills):

```bash
npx skills add https://github.com/polarsource/agent-toolkit
```

Then connect the MCP server by following the [Polar MCP guide](https://polar.sh/docs/integrate/mcp) for your client.

## Example prompts

```
Help me set up Polar in my Next.js app
```
```
Add a Polar webhook handler and test it locally
```
```
Help me migrate my subscriptions from Stripe to Polar
```

## Data and privacy

The plugin contains instructions and MCP server configuration only. It runs no scripts or hooks on your machine and sends no telemetry.

When you use the MCP servers, your agent sends requests to `mcp.polar.sh` over HTTPS. They read and change data in the Polar organization you authorized, such as products, customers, subscriptions and orders, within the permissions you granted. To disconnect, clear the server's authentication in `/mcp` or uninstall the plugin. Polar handles this data under its [Privacy Policy](https://polar.sh/legal/privacy-policy) and [Terms of Service](https://polar.sh/legal/master-services-terms).

## Support

- [Polar documentation](https://polar.sh/docs)
- [Contact Polar support](https://polar.sh/docs/support)
- [Report an issue with this plugin](https://github.com/polarsource/agent-toolkit/issues)

## License

[MIT](LICENSE)
