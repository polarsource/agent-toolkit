---
name: polar-config
description: |
  Manage a Polar catalog as code with a billing config file (polar.config.ts or polar.config.json) and the "polar config" commands of the Polar CLI. Use this skill whenever the user wants to: (1) create or edit a Polar billing config; (2) add or change meters, benefits, products or prices in it; (3) write the config from their app's pricing; (4) check what would change, save it to the draft or publish it with polar config validate, draft or publish; (5) fix an issue those commands report; (6) retire a meter, benefit or product with deprecated and polar config prune; (7) generate the config's names for application code with polar config generate; (8) set up CI to show config changes on pull requests and draft or publish them when they merge.
---

# Polar billing config

A billing config is one file that declares an organization's meters, benefits and products. The Polar CLI compares the file with what is on Polar, then drafts and publishes the difference, so a pricing change is reviewed like any other code change.

| File | For |
| --- | --- |
| `polar.config.ts` | JavaScript and TypeScript projects |
| `polar.config.json` | Every other project: Python, Go, Ruby, PHP and so on |

There is no config language per programming language. A Python project uses the JSON file, plus a generated file of names for its code (Step 5).

A config file is one of two ways to manage a catalog. The other is the dashboard, which is how every organization works until `polar config init` turns config on. Use this skill when the project already has a config file or the user asks to manage the catalog in code. Don't move an organization to a config file on your own: suggest it when it fits, and let the user choose.

## Who decides what

You do the engineering: write the file, run the commands, fix what they report. The user decides the business.

- Never invent a product, a price, a currency, a billing interval or a benefit. Take them from the app (the pricing page, plan constants, existing checkout code) or from the user. If the app shows no pricing, ask.
- `polar config validate` changes nothing. Run it as often as you need.
- `polar config init`, `draft`, `publish` and `disable` change the organization. Run each only after the user has said yes to what it will do.
- Work in sandbox until the user asks for production.

## Step 1: Find the config

Look for `polar.config.ts` or `polar.config.json` in the project. If there is one, go to Step 2.

If there is none, `polar config init` writes it from the organization's existing meters, benefits and products. Tell the user what it does and wait for a yes:

- It turns on config for the organization. From then on products and benefits are edited in the file, not in the dashboard. `polar config disable` undoes this, but only until a second catalog version is published.
- Existing meters, benefits and products without an external ID get one. The config refers to them by that ID from then on.

The commands in this skill need the Polar CLI. If `polar` is not installed, install it with `npm install -g @polar-sh/cli`.

```bash
polar auth whoami --json
polar config init --sandbox --json
```

`whoami` shows the active organization and environment. Pass `--org <slug>` when the account has several organizations.

If the CLI is not signed in, and the user has not already told you in `setup-polar`, ask which of these applies before going further:

- **They have a Polar organization.** They run `polar auth login --sandbox`, which opens a browser.
- **They want you to create one.** Polar supports the [auth.md](https://polar.sh/auth.md) spec: read <https://sandbox.polar.sh/auth.md> for sandbox or <https://polar.sh/auth.md> for production, sign up on your own, ask what to call the organization and create it with `POST /v1/organizations/` (a `name` and a `slug`). Then run the commands in this skill with your access token in place of a login: `POLAR_ACCESS_TOKEN=<access token> POLAR_ENVIRONMENT=sandbox polar config init --json`. Hand the organization over with a claim once the catalog is in place: ask the user for the email address they will sign in to Polar with, and put the full `verification_uri` and the `user_code` in your reply, copied exactly. Once the claim succeeds, use the access token it returns, because the one you had stops working.
- **They will create it themselves.** Send them to <https://sandbox.polar.sh/start>, then they run `polar auth login --sandbox`.

`init` picks the format from the nearest project file: TypeScript with a `package.json`, JSON with a `pyproject.toml` or with neither. Pass `--format ts` or `--format json` when the project has both or the user wants the other one. For TypeScript it also installs the package the config imports.

`init` fails with "already exists" when the config file is there. That is not an error to work around: the file is the config, go to Step 2.

Read the result:

| `status` | What to do |
| --- | --- |
| `written` | The file is at `file`. Tell the user what `imported` counts and list everything in `skipped`: those resources stay on Polar as they are and are not in the file. For a new organization the sections are empty; Step 2 shows what goes in them. |
| `external_ids_required` | Nothing was written. Show the user the suggested IDs in `external_ids`. Run `polar config init --json --confirm` to accept them all, or pass `--external-id <id>=<external ID>` for each one they want to name. |

## Step 2: Edit the file

Three rules hold in both formats:

- **The external ID is the identity.** It is the key in TypeScript and the `external_id` field in JSON, and it is how Polar matches an entry to an existing resource. Changing it removes the old resource and creates a new one, so never rename one. To change what customers see, change the name.
- **External IDs** start with a letter or digit and contain only letters, digits, `.`, `_`, `:` and `-`. Prefer snake_case: it stays a valid name in generated code.
- **A section you leave out is left alone. A products section you include is the whole catalog:** an entry missing from a section you include is left out of the next catalog version, and `"products": []` takes every product off sale. `validate` lists these as removed, "not in config". Nothing is deleted on Polar and customers keep what they have, but treat every removal `validate` reports as something the user must have asked for.

### TypeScript

Each section is a function that receives its helpers and returns the entries by key. Amounts are in the currency's major unit: `usd(29)` is $29.00. Every price in a product must list the same currencies.

```ts
import { defineConfig, eq, eur, perThousand, usd } from '@polar-sh/polar'

export default defineConfig({
  meters: ({ meter }) => ({
    api_calls: meter('API calls').where(eq('name', 'api_call')).count(),
    tokens: meter('Output tokens')
      .where(eq('name', 'completion'))
      .unit('token')
      .sum('output_tokens'),
  }),
  benefits: ({ flag, credits }) => ({
    priority_support: flag('Priority support'),
    included_calls: credits('Included API calls').meter('api_calls').units(1000),
  }),
  products: ({ product, free, fixed, meter }) => ({
    free: product('Free').prices(free()).recurring('monthly'),
    pro: product('Pro')
      .prices(
        fixed().amount(usd(29), eur(27)),
        meter('api_calls')
          .flat()
          .amount(perThousand(usd(2)), perThousand(eur(1.9))),
      )
      .recurring('monthly')
      .grants(['priority_support', 'included_calls']),
  }),
})
```

- **Meters** filter events with `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `notLike`, `and`, `or`, then aggregate with `.count()`, `.sum(property)`, `.avg(property)`, `.min(property)`, `.max(property)` or `.unique(property)`. `eq('name', 'api_call')` matches the event name. A config with an `events` section, which gives each event a schema, selects events with `.on(events.api_call)` instead; follow whichever the file already uses.
- **Benefits** are `flag(name)`, a feature the app checks, or `credits(name).meter(key).units(n)`, usage included before a metered price charges. Add `.rollover()` to carry unused credits over.
- **Products** take `.prices(...)`, then `.recurring('monthly')`, `.recurring('yearly')`, `.recurring(3, 'months')` or `.once()`, and optionally `.grants([...])`, `.trial(14, 'days')` and `.description(text)`.
- **Prices** are `free()`, `fixed()`, `seats()`, `units()` and `meter(key)`. Tiered prices use `.graduated(...)` or `.volume(...)` with `tier()`.

The package is fully typed. For anything not shown here, read its type declarations in `node_modules` rather than guessing: a wrong helper is a type error, and a reference to a meter or benefit key that does not exist is one too.

### Settings

`init` also writes a `settings` section with the organization's default currency and tax behavior: `settings: { payments: { currency: 'usd', tax: 'location' } }` in TypeScript, and the same object under `"settings"` in JSON. `tax` is `location`, `inclusive` or `exclusive`. It applies to the whole organization and takes effect on `publish`, so leave it as `init` wrote it unless the user asks for a change.

### JSON

The file is one object. Each section is a list, and each entry carries its `external_id`. Entries refer to each other by external ID: a benefit names its `meter`, a product lists its `benefits`.

```json
{
  "meters": [
    {
      "external_id": "api_calls",
      "name": "API calls",
      "filter": {
        "conjunction": "and",
        "clauses": [{ "property": "name", "operator": "eq", "value": "api_call" }]
      },
      "aggregation": { "func": "count" }
    }
  ],
  "benefits": [
    {
      "external_id": "priority_support",
      "description": "Priority support",
      "type": "feature_flag"
    },
    {
      "external_id": "included_calls",
      "description": "1,000 API calls a month",
      "type": "meter_credit",
      "properties": { "meter": "api_calls", "units": 1000, "rollover": false }
    }
  ],
  "products": [
    {
      "external_id": "free",
      "name": "Free",
      "recurring_interval": "month",
      "prices": [{ "amount_type": "fixed", "price_currency": "usd", "price_amount": 0 }],
      "benefits": []
    },
    {
      "external_id": "pro",
      "name": "Pro",
      "recurring_interval": "month",
      "prices": [
        { "amount_type": "fixed", "price_currency": "usd", "price_amount": 2900 },
        { "amount_type": "metered_unit", "price_currency": "usd", "meter": "api_calls", "unit_amount": "0.2" }
      ],
      "benefits": ["priority_support", "included_calls"]
    },
    {
      "external_id": "credit_pack",
      "name": "5,000 API calls",
      "prices": [{ "amount_type": "fixed", "price_currency": "usd", "price_amount": 900 }],
      "benefits": []
    }
  ]
}
```

**Money is in cents, and this is where JSON configs go wrong.** There are no helpers like `usd(29)`, so check every amount twice.

| Field | Written as | Example |
| --- | --- | --- |
| `price_amount` on a fixed price | Whole cents, a number. `0` is free. | `2900` is $29.00 |
| `unit_amount` on a metered or tiered price | Cents per unit, a string, fractions allowed | `"0.2"` is $0.002 per call, so $2 per 1,000 |
| `cap_amount` | Whole cents, a number | `10000` caps the charge at $100.00 |

`validate` prints amounts as money (`$29 per month`, `$2 per 1,000`). Run `polar config validate` without `--json` once to see them, and read each one back against what the user said: the JSON output only has the raw numbers.

- **Meters.** `filter` holds `clauses` joined by `conjunction` (`and` or `or`). A clause has a `property`, an `operator` (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `not_like`) and a `value`. The property `name` is the event name; any other property is read from the event's metadata. `aggregation` is `{ "func": "count" }`, or `sum`, `avg`, `min`, `max` or `unique` with a `"property"`. `unit` is optional: `scalar` (the default), `token`, or `custom` with a `custom_label`.
- **Benefits.** `type` is `feature_flag`, a feature the app checks, or `meter_credit`, usage included before a metered price charges, with `properties` naming the `meter`, the `units` and whether unused units `rollover`.
- **Products.** `recurring_interval` is `day`, `week`, `month` or `year`; add `recurring_interval_count` for every 3 months. Leave `recurring_interval` out for a one-time purchase. It cannot change once the product exists. Optional: `description`, and a trial with `trial_interval` and `trial_interval_count`.
- **Prices.** `amount_type` is `fixed`, `metered_unit`, `metered_tiers`, `seat_based` or `unit_based`. A free plan is a fixed price of `0`. A metered price needs a recurring product.
- **Tiers** (for `metered_tiers`, `seat_based` and `unit_based`) go in `"tiers": { "type": "graduated", "tiers": [...] }`, with `volume` as the other type. Each tier has a `unit_amount` and a `bound`, the last unit it covers; the last tier has no `bound`.
- **Several currencies.** Add one price object per currency. Every currency must have the same set of price types.

Keys the format does not know are rejected, and so are comments and trailing commas. For anything not shown here, write your best guess and run `polar config validate`: an error names the field and lists the values it accepts. When the organization already has resources, the entries `init` wrote are the most reliable examples.

## Step 3: Validate, fix, show

```bash
polar config validate --json
```

- `entries` lists each resource with an `action` of `created`, `updated`, `unchanged` or `removed`, and for a change the `diff` of each field, `before` and `after`.
- `issues` lists problems with a `severity`, the `path` of the entry (`meters.tokens.name`), a `message` and the `location` in the file.

Fix every issue with severity `error` in the file and validate again. Show warnings to the user. "No events with this name have been received yet" is expected until the app sends that event; check the event name for a typo, then move on.

If `validate` reports a change to something you did not touch, the file is out of date with Polar. Stop and show the user instead of drafting over it.

Then tell the user in plain words what would be created, updated and removed, with the old and new value of every price that changes.

## Step 4: Draft, then publish

Ask before each command. `--confirm` skips the CLI's own question, which a shell without a terminal cannot answer, so the user's yes to you is the confirmation.

```bash
polar config draft --confirm --json
polar config publish --confirm --json
```

- `draft` saves meters, benefits, products and settings to the draft catalog, and nothing a customer sees changes yet.
- `publish` makes the draft live: new checkouts sell it. Existing customers stay on the version they bought.

Normally `draft` just updates the draft. It stops with a conflict when the draft on Polar contains changes that the local config file does not have, for example because a teammate drafted a change from their own copy of the file and has not committed it. Carrying on would throw their changes away. With `--json` the result has `"status": "conflict"` and a `conflicts` list naming each resource and whether the draft added, changed or removed it. Do not pick a way out on your own: show the user that list and ask which of these they want.

- `polar config draft --force` makes the draft on Polar match the local file and discards the other changes.
- `polar config reset` rewrites the local config file to match what is on Polar: the draft when there is one, the live catalog otherwise. It replaces the whole file, so comments and anything that is not on Polar are lost. Without a terminal it needs `--confirm`, like the other commands that change something.

Between `draft` and `publish`, four things look wrong and are not:

- `validate` still lists the drafted changes and still says to run `draft`. It compares the file with the live catalog, not with the draft. The next step is `publish`.
- `draft` run again reports the same entries as created or updated.
- A meter that is new in the draft does not count usage until `publish`. A customer's balance for it does not move while the catalog is only a draft, so publish before you test usage.
- Each `publish` makes a new catalog version (`v1`, `v2`, ...). A product that changed gets a new ID on Polar and the old one stays for the customers who bought it, which is why application code uses external IDs (Step 5).

`publish` ships the draft, not the file. If the file changed after the last `draft`, run `draft` again first. To check, run `polar config publish` without `--confirm` and without `--json`: it prints a "Not in the draft" section listing what differs, then stops for confirmation. Without a terminal it exits with an error at that point, which is expected. Publish with `--confirm` only when that section is absent. If the user took a change back after it was drafted, say so and show them that section; do not publish over it.

Production is a separate organization with its own catalog. When the user asks for it, have them run `polar auth login --production`, check `polar auth whoami --json`, then repeat Step 3 and Step 4 with the same file.

## Changing and retiring

| The user wants to | Do this |
| --- | --- |
| Rename what customers see | Change the name. Keep the key. |
| Change a price | Edit it, draft and publish. Existing subscribers keep their price. |
| Stop selling a product | Mark it deprecated, draft and publish. Don't delete the entry: a product with active subscriptions that is missing from the file is an error. |
| Change what a meter counts | Once a meter has billed usage, Polar rejects a change to its filter or aggregation, and `validate` reports it. Add a new meter under a new key and deprecate the old one. |
| Clean up the file | Run `polar config prune`. It removes deprecated entries nothing uses any more and changes nothing on Polar. |

Deprecate with `.deprecated()` in TypeScript and `"deprecated": true` in JSON. A deprecated entry stays for the customers who have it, and nothing new can use it. A live product cannot grant a deprecated benefit: take the benefit out of the product's list first.

## Step 5: Names for application code

Application code refers to the config by external ID: the product to sell, the benefit to check, the meter to read, the event to send. A typo in one of those strings fails silently at run time.

With a TypeScript config the package types these for you. With a JSON config, generate them:

```bash
polar config generate
```

It writes one file next to the config with the external IDs and event names as constants and types. For a Python project that is `polar_types.py`:

```python
from polar_types import Benefits, Events, Meters, Products

Products.pro          # "pro"
Events.api_call       # "api_call", from the meters' filters
```

- The language comes from the project (`pyproject.toml`, `requirements.txt`, `setup.py` or `Pipfile` means Python). Pass `--language py` when it cannot tell. Python is the only language so far; in another language, use the external IDs as plain strings.
- `--out src/myapp/polar_types.py` puts the file elsewhere. It never replaces a file it did not write.
- Run it again after every change to the config, and commit the file. `polar config generate --check` writes nothing and fails when the file is missing or out of date; add it to CI, with the same `--out` if you used one.
- Never edit the generated file.

The API takes external IDs directly from version 2027-01, so the app never stores Polar's own IDs. In Python that is `from polar.v2027_01 import Polar`, then for example `external_products=[Products.pro]` when creating a checkout, `external_benefit_id=Benefits.priority_support` when listing a customer's benefit grants and `external_meter_id=Meters.api_calls` when reading a customer's meter. In TypeScript, import the client from `@polar-sh/sdk/2027-01` and pass `external_products: ["pro"]` to `polar.checkouts.create`.

Never put a Polar product ID in the app's code or env file. Each publish gives a changed product a new ID, and a checkout created with the old one fails with "Product is no longer sold".

## Step 6: Review and release from CI

Once the config is in the repository, CI can show every pricing change on its pull request and release it when the pull request merges. Set this up when the user asks for it, and ask them two things first:

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
- `npm ci` is there because a TypeScript config imports its package. For a JSON config, drop it, point `paths` at `polar.config.json`, and add `polar config generate --check` to the `validate` job when the project generates names (Step 5).
- `environment: production` is a GitHub environment. Suggest a required reviewer on it: a pricing change then needs a person's approval after the merge and before it reaches Polar.
- `draft` stops in CI too when the draft on Polar has changes the file does not have. Do not add `--force` on your own. Ask the user whether the main branch should always win over a draft someone saved from their machine, and add it only if they say yes.
- `--pr-comment` also works in Buildkite for a repository on GitHub. On any other CI system, run the same commands without it and read the job's output.

## After the catalog is live

To sell the products, hand off to the `polar-integration` skill for the Checkout, Customer Portal and Webhooks endpoints, and to `polar-testing` to try them in sandbox. Follow "Projects with a billing config" in its Checkout recipe, so the app sells by external ID. That skill is written for TypeScript. In another language, build the same three endpoints from the SDK's documentation and the [API reference](https://polar.sh/docs/api-reference), using the external IDs from Step 5.
