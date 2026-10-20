---
name: setup-polar
description: |
  Interactive onboarding wizard to set up Polar payment integration from scratch. Use this skill when: (1) User wants to "set up Polar" or "integrate Polar" in their project; (2) User is starting fresh with Polar and needs guided setup; (3) User asks "how do I get started with Polar"; (4) User wants to add payments/subscriptions/checkout to their app using Polar; (5) User needs help creating their first Polar product and checkout. This skill walks through MCP installation, authentication, product creation, and generates framework-specific integration code.
---

# Polar Setup Wizard

Interactive setup guide to get Polar payments working in your project.

## Setup Flow

Follow these steps in order:

### Step 1: Check MCP Availability

First, check if the Polar MCP server is available. Try listing products or organizations using MCP tools.

**If MCP tools work:** Skip to Step 3.

**If MCP not available:** Continue to Step 2.

### Step 2: Install Polar MCP

**Polar plugin installed:** the plugin already configures the Polar server (`polar`, plus `polar-sandbox` where available). Ask the user to sign in to it, preferring `polar-sandbox`: in Claude Code with `/mcp`, in Codex with `codex mcp login <server>`, in Cursor from its MCP settings, and in ChatGPT when prompted to connect. Then continue with the verification below.

Otherwise, guide the user to install the Polar MCP server based on their environment:

**Claude Code:**
```bash
# Production
claude mcp add --transport http polar https://mcp.polar.sh/mcp/polar-mcp

# Sandbox (recommended for setup)
claude mcp add --transport http polar-sandbox https://mcp.polar.sh/mcp/polar-sandbox
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "polar-sandbox": {
      "url": "https://mcp.polar.sh/mcp/polar-sandbox"
    }
  }
}
```

After installation, the user must:
1. Restart their editor/CLI
2. Authenticate when prompted (redirects to polar.sh)

Once authenticated, verify MCP works by listing organizations.

### Step 3: Gather Project Context

Ask the user:

1. **Framework**: What framework are you using?
   - Next.js (App Router)
   - Next.js (Pages Router)
   - Express.js
   - FastAPI (Python)
   - Other

2. **Environment**: Start with sandbox or production?
   - Sandbox (recommended for new setups)
   - Production

3. **Product type**: What are you selling?
   - Subscription (recurring)
   - One-time purchase
   - Both

### Step 4: Create Organization (if needed)

Use MCP to check if user has an organization. If not, guide them to create one at:
- Sandbox: https://sandbox.polar.sh/start
- Production: https://polar.sh/start

### Step 5: Create First Product

Use MCP to create a test product. Example for subscription:

```
Create a product with:
- Name: "Pro Plan"
- Monthly price: $29
- Organization: [user's org]
```

Store the returned product ID for checkout integration.

### Step 6: Generate Integration Code

Hand off to the `polar-integration` skill to generate the Checkout, Customer Portal, and Webhooks endpoints for the framework selected in Step 3. That skill has the canonical, framework-agnostic recipes plus per-framework variations.

Before invoking it, make sure the user has these environment variables ready (use whatever loader their framework provides):

```bash
POLAR_ACCESS_TOKEN=    # from polar.sh/settings (or sandbox)
POLAR_WEBHOOK_SECRET=  # created in Step 7
POLAR_SERVER=sandbox   # omit or set to "production" when going live
```

Pass along the product ID from Step 5 so checkout links can be tested in Step 8.

### Step 7: Set Up Webhooks

Use the Polar CLI to forward webhooks to the local dev server. It needs no tunnel and no dashboard endpoint. The `polar-testing` skill ("Local Webhook Testing") has the details.

1. Install the CLI (`npm install -g @polar-sh/cli`) and ask the user to run `polar auth login --sandbox`, which opens a browser.
2. Save the local signing secret without printing it, then restart the dev server:
   ```bash
   secret=$(polar webhook listen --print-secret) && echo "POLAR_WEBHOOK_SECRET=$secret" >> .env
   ```
3. Start `polar webhook listen <port>/<webhook-path>` in the background, using the path from the route generated in Step 6, and keep it running.
4. Run `polar webhook trigger order.paid`. It prints the handler's response and exits with status 1 when the handler fails. Fix the handler and repeat until it exits with 0.

When deploying, create a webhook endpoint for the public URL with MCP or in the dashboard (Settings → Webhooks), select `order.paid`, `subscription.created` and `subscription.canceled`, and use that endpoint's secret as `POLAR_WEBHOOK_SECRET` in the deployed environment.

### Step 8: Test the Integration

1. Start the dev server.
2. Visit the checkout URL with the product ID from Step 5 (path and query shape come from the route generated in Step 6).
3. Complete checkout using test card: `4242 4242 4242 4242`.
4. Verify that `polar webhook listen` shows `order.paid` with a 2xx status from the handler.
5. Check the success page displays correctly.

### Step 9: Next Steps

Once basic setup works, suggest:

1. **Add customer portal** - Let users manage subscriptions (Recipe 2 in `polar-integration`).
2. **Link to your auth** - Pass `externalCustomerId` in checkout.
3. **Add benefits** - License keys, file downloads, Discord roles.
4. **Go production** - Switch `POLAR_SERVER` from `sandbox` to `production`.
