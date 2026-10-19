---
name: polar-testing
description: |
  Guide for testing Polar payment integrations using the sandbox environment. Use this skill when: (1) Setting up the Polar sandbox for development; (2) Testing checkout flows without real payments; (3) Using Stripe test cards with Polar; (4) Writing integration tests for payment flows; (5) Testing webhooks locally with the Polar CLI (`polar listen`, `polar trigger`) and generating webhook fixtures; (6) Mocking Polar in unit tests; (7) Setting up CI/CD pipelines with Polar sandbox; (8) Debugging payment issues in sandbox.
---

# Polar Testing Guide

Test Polar integrations safely using the sandbox environment - a fully isolated server where you can experiment without affecting production data or processing real payments.

## Sandbox Environment

### Access

- **Dashboard**: https://sandbox.polar.sh
- **API**: https://sandbox-api.polar.sh/v1

The sandbox is completely isolated from production. You need separate:
- User account
- Organization
- Access tokens
- Webhook endpoints

### Setup Steps

1. Go to https://sandbox.polar.sh/start
2. Create a new account (or use "Go to sandbox" from org switcher)
3. Create a test organization
4. Generate an access token in Settings → Developers

### SDK Configuration

```typescript
// TypeScript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox", // Switch to "production" for live
});
```

```python
# Python
from polar_sdk import Polar

polar = Polar(
    access_token=os.environ["POLAR_ACCESS_TOKEN"],
    server="sandbox",
)
```

```go
// Go
s := polargo.New(
    polargo.WithServer("sandbox"),
    polargo.WithSecurity(os.Getenv("POLAR_ACCESS_TOKEN")),
)
```

### Sandbox Limitations

- Subscriptions auto-cancel after 90 days
- No real money is processed
- Data is isolated from production

## Test Cards

Polar uses Stripe for payment processing. Use these test card numbers:

### Successful Payments

| Card Number | Brand | CVC | Expiry |
|-------------|-------|-----|--------|
| 4242 4242 4242 4242 | Visa | Any 3 digits | Any future date |
| 5555 5555 5555 4444 | Mastercard | Any 3 digits | Any future date |
| 3782 822463 10005 | Amex | Any 4 digits | Any future date |
| 6011 1111 1111 1117 | Discover | Any 3 digits | Any future date |

### Declined Payments

| Card Number | Decline Reason |
|-------------|----------------|
| 4000 0000 0000 0002 | Generic decline |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0000 0000 9987 | Lost card |
| 4000 0000 0000 9979 | Stolen card |
| 4000 0000 0000 0069 | Expired card |
| 4000 0000 0000 0127 | Incorrect CVC |

### 3D Secure Testing

| Card Number | Behavior |
|-------------|----------|
| 4000 0027 6000 3184 | Requires 3DS authentication |
| 4000 0000 0000 3220 | Requires 3DS authentication |

## Local Webhook Testing

Use the Polar CLI. It forwards your organization's webhook events straight to your local server: no tunnel, no public URL, and no webhook endpoint in the dashboard.

### Install and sign in

```bash
npm install -g @polar-sh/cli

polar auth login --sandbox
```

For other install methods, see the [CLI docs](https://polar.sh/docs/integrate/cli/introduction).

`polar auth login` opens a browser, so ask the user to run it. Check the result with `polar auth whoami --json`: `environments` lists the signed-in environments and `organization` is the active one.

Where no browser is available (CI, remote machines, cloud agents), an organization access token replaces `auth login`:

```bash
export POLAR_ACCESS_TOKEN=polar_oat_...   # scopes: webhooks:read, webhooks:write, organizations:read
export POLAR_ENVIRONMENT=sandbox
```

### Forward events to your app

```bash
polar listen 3000/api/polar/webhook
```

`listen` takes a port, a `port/path`, or a full URL. It runs until stopped, so start it in its own terminal or as a background process and keep it running while you test. It forwards every webhook event for the organization, including the ones real sandbox activity produces, such as completing a test checkout.

### Set the webhook secret

`listen` signs forwarded events with a local secret, not a dashboard endpoint's secret. Write it to `.env` without printing it:

```bash
secret=$(polar listen --print-secret) && echo "POLAR_WEBHOOK_SECRET=$secret" >> .env
```

If `.env` already has a `POLAR_WEBHOOK_SECRET` line, replace it instead of appending, then restart the dev server. Deployed environments use the secret of their dashboard webhook endpoint.

### Send test events

```bash
polar trigger order.paid
```

`trigger` sends a sample event through the running `listen`. When your handler doesn't accept it (a non-2xx response, a connection error, or a redirect), it prints the handler's response body and exits with status 1. Read that output, fix the handler, and run the same command again until it exits with 0.

A redirect usually means auth middleware is intercepting the webhook route. Exclude the route from it: Polar never follows redirects when delivering webhooks.

```bash
polar trigger --list --json                     # every event you can send
polar trigger order.paid --override data.customer.email=jane@example.com
polar trigger order.paid --seed 7               # the same IDs on every run
```

`--override` takes `path=value` and can be repeated. The API rejects paths that don't exist in the payload.

## Integration Testing

### Test Checkout Flow

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Polar } from "@polar-sh/sdk";

describe("Polar Checkout", () => {
  const polar = new Polar({
    accessToken: process.env.POLAR_SANDBOX_TOKEN!,
    server: "sandbox",
  });

  let testProductId: string;

  beforeAll(async () => {
    // Create test product
    const product = await polar.products.create({
      name: "Test Product",
      organizationId: process.env.POLAR_ORG_ID!,
      prices: [{
        type: "one_time",
        amountType: "fixed",
        priceAmount: 1000,
        priceCurrency: "usd",
      }],
    });
    testProductId = product.id;
  });

  it("should create checkout session", async () => {
    const checkout = await polar.checkouts.create({
      products: [testProductId],
      successUrl: "http://localhost:3000/success",
      customerEmail: "test@example.com",
    });

    expect(checkout.status).toBe("open");
    expect(checkout.url).toBeDefined();
    expect(checkout.url).toContain("sandbox");
  });

  it("should retrieve checkout", async () => {
    const checkout = await polar.checkouts.create({
      products: [testProductId],
      successUrl: "http://localhost:3000/success",
    });

    const retrieved = await polar.checkouts.get({ id: checkout.id });
    expect(retrieved.id).toBe(checkout.id);
  });
});
```

### Test Webhook Handler

Generate fixtures from real payloads instead of writing them by hand. `--json` prints the payload without sending it, so `listen` doesn't need to be running:

```bash
mkdir -p test/fixtures
polar trigger order.paid --json --seed 1 > test/fixtures/order.paid.json
polar trigger subscription.created --json --seed 1 > test/fixtures/subscription.created.json
```

Sign them the way Polar does ([Standard Webhooks](https://www.standardwebhooks.com/)): an HMAC-SHA256 of `id.timestamp.body`, base64-encoded and keyed with the secret string. This test calls the webhook route from `polar-integration` Recipe 3 directly:

```typescript
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";

const secret = "test_webhook_secret";
let POST: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", secret);
  ({ POST } = await import("../app/api/polar/webhook/route"));
});

const sign = (id: string, timestamp: number, body: string) =>
  `v1,${createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64")}`;

const webhookRequest = (body: string, signature?: string) => {
  const id = "msg_test";
  const timestamp = Math.floor(Date.now() / 1000);
  return new Request("http://localhost/api/polar/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": signature ?? sign(id, timestamp, body),
    },
    body,
  });
};

describe("Polar webhook handler", () => {
  it("accepts a signed order.paid event", async () => {
    const body = await readFile("test/fixtures/order.paid.json", "utf8");
    const response = await POST(webhookRequest(body));
    expect(response.status).toBe(200);
  });

  it("rejects an invalid signature", async () => {
    const body = await readFile("test/fixtures/order.paid.json", "utf8");
    const response = await POST(webhookRequest(body, "v1,invalid"));
    expect(response.status).toBe(403);
  });
});
```

### Test License Key Validation

```typescript
describe("License Keys", () => {
  it("should validate license key", async () => {
    // First create a customer with a license key benefit
    // Then validate the key
    const result = await polar.licenseKeys.validate({
      key: "TEST-XXXX-XXXX-XXXX",
      organizationId: process.env.POLAR_ORG_ID!,
    });

    expect(result.valid).toBe(true);
    expect(result.customer).toBeDefined();
  });

  it("should reject invalid license key", async () => {
    const result = await polar.licenseKeys.validate({
      key: "INVALID-KEY",
      organizationId: process.env.POLAR_ORG_ID!,
    });

    expect(result.valid).toBe(false);
  });
});
```

## Mocking Polar in Unit Tests

### Mock SDK

```typescript
import { vi } from "vitest";

// Mock the entire SDK
vi.mock("@polar-sh/sdk", () => ({
  Polar: vi.fn().mockImplementation(() => ({
    checkouts: {
      create: vi.fn().mockResolvedValue({
        id: "checkout_mock",
        url: "https://sandbox.polar.sh/checkout/mock",
        status: "open",
      }),
      get: vi.fn().mockResolvedValue({
        id: "checkout_mock",
        status: "succeeded",
      }),
    },
    customers: {
      getState: vi.fn().mockResolvedValue({
        activeSubscriptions: [
          { id: "sub_mock", status: "active", productId: "prod_mock" },
        ],
        grantedBenefits: [],
      }),
    },
    subscriptions: {
      list: vi.fn().mockResolvedValue([]),
      cancel: vi.fn().mockResolvedValue({}),
    },
  })),
}));
```

### Mock Webhook Payloads

Load the fixtures generated with `polar trigger <event> --json` (see Test Webhook Handler). Hand-written payloads drift from the real shape, and `validateEvent` rejects them.

```typescript
import orderPaid from "./fixtures/order.paid.json";
import subscriptionCreated from "./fixtures/subscription.created.json";
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Polar Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    env:
      POLAR_ACCESS_TOKEN: ${{ secrets.POLAR_SANDBOX_TOKEN }}
      POLAR_WEBHOOK_SECRET: ${{ secrets.POLAR_SANDBOX_WEBHOOK_SECRET }}
      POLAR_ORG_ID: ${{ secrets.POLAR_SANDBOX_ORG_ID }}
      POLAR_SERVER: sandbox

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
```

### Environment Setup

Create sandbox credentials specifically for CI:

1. Create a dedicated sandbox organization for CI
2. Generate a CI-specific access token
3. Commit the webhook fixtures; handler tests sign them with a test secret and need no webhook endpoint
4. Store credentials in GitHub Secrets

## Debugging Tips

### Check Webhook Delivery

Locally, `polar listen` logs every forwarded event with your handler's status, and `polar trigger` prints the handler's response body when it fails.

For a deployed endpoint:

1. Go to sandbox.polar.sh → Settings → Webhooks
2. Click on your endpoint
3. View delivery history and payloads
4. Check response codes and errors

### Common Issues

**Webhook signature mismatch**
- Ensure you're using the sandbox webhook secret
- Locally, use the secret from `polar listen --print-secret` and restart the dev server after changing `.env`
- Check that the raw body is being passed (not parsed JSON)
- Verify timestamp is within tolerance (5 minutes)

**Checkout not completing**
- Use test cards, not real cards
- Check browser console for errors
- Verify successUrl is correct

**API returns 401**
- Verify you're using sandbox token with sandbox API
- Check token hasn't expired
- Ensure token has required scopes

### Enable Debug Logging

```typescript
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
  // Enable debug mode if available
});

// Log all requests
polar.checkouts.create({...}).then(console.log).catch(console.error);
```

## Test Checklist

Before going to production:

- [ ] Checkout flow completes successfully
- [ ] Webhooks received and processed
- [ ] Subscription lifecycle works (create, cancel, revoke)
- [ ] Benefits granted and revoked correctly
- [ ] License key validation works
- [ ] Error handling for declined payments
- [ ] Customer portal accessible
- [ ] Refund flow tested
