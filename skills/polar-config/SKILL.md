---
name: polar-config
description: |
  Manage a Polar catalog as code with a billing config file (polar.config.ts, polar_config.py or polar.config.json) and the "polar config" commands of the Polar CLI. Use this skill whenever the user wants to: (1) create or edit a Polar billing config; (2) add or change meters, benefits, products or prices in it; (3) write the config from their app's pricing; (4) preview or apply it with polar config plan, apply or publish; (5) fix an issue those commands report; (6) retire a meter, benefit or product with deprecated and polar config prune.
---

# Polar billing config

A billing config is one file that declares an organization's meters, benefits and products. The Polar CLI compares the file with what is on Polar and applies the difference, so a pricing change is reviewed like any other code change.

| File | Language |
| --- | --- |
| `polar.config.ts` | TypeScript |
| `polar_config.py` | Python. Meters only for now. |
| `polar.config.json` | JSON, for any other project |

## Who decides what

You do the engineering: write the file, run the commands, fix what they report. The user decides the business.

- Never invent a product, a price, a currency, a billing interval or a benefit. Take them from the app (the pricing page, plan constants, existing checkout code) or from the user. If the app shows no pricing, ask.
- `polar config plan` changes nothing. Run it as often as you need.
- `polar config init`, `apply`, `publish` and `disable` change the organization. Run each only after the user has said yes to what it will do.
- Work in sandbox until the user asks for production.

## Step 1: Find the config

Look for `polar.config.ts`, `polar_config.py` or `polar.config.json` in the project. If there is one, go to Step 2.

If there is none, `polar config init` writes it from the organization's existing meters, benefits and products. Tell the user what it does and wait for a yes:

- It turns on config for the organization. From then on products and benefits are edited in the file, not in the dashboard. `polar config disable` undoes this, but only until a second catalog version is published.
- Existing meters, benefits and products without an external ID get one. The config refers to them by that ID from then on.

```bash
polar auth whoami --json
polar config init --sandbox --json
```

`whoami` shows the active organization and environment. If the CLI is not signed in, ask the user to run `polar auth login --sandbox`, which opens a browser. Pass `--org <slug>` when the account has several organizations.

`init` picks the language from the project: TypeScript with a `package.json`, Python with a `pyproject.toml`, JSON otherwise. Pass `--format ts`, `--format py` or `--format json` when the project has both or the user wants another one. For TypeScript it also installs the package the config imports.

Read the result:

| `status` | What to do |
| --- | --- |
| `written` | The file is at `file`. Tell the user what `imported` counts and list everything in `skipped`: those resources stay on Polar as they are and are not in the file. |
| `external_ids_required` | Nothing was written. Show the user the suggested IDs in `external_ids`. Run `polar config init --json --confirm` to accept them all, or pass `--external-id <id>=<external ID>` for each one they want to name. |

## Step 2: Edit the file

Three rules hold in every language:

- **The key is the external ID.** It is how Polar matches an entry to an existing resource. Changing a key creates a new resource, so never rename one. To change what customers see, change the name.
- **External IDs** start with a letter or digit and contain only letters, digits, `.`, `_`, `:` and `-`. In Python the attribute name is the ID, so use snake_case.
- **A section you leave out is left alone. A products section you include is the whole catalog:** a live product missing from it is left out of the next catalog version. Meters and benefits missing from their section stay on Polar untouched.

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

### Python

Declare the meters as attributes of a `MeterSet` subclass and assign the config to a module-level variable named `config`. The attribute name is the external ID.

```python
from polar.config import Config, Meter, MeterSet, Sum, eq


class Meters(MeterSet):
    api_calls = Meter("API calls", on="api_call")
    tokens = Meter(
        "Output tokens",
        on="completion",
        where=eq("status", "ok"),
        aggregate=Sum("output_tokens"),
        unit="token",
    )


config = Config(meters=Meters)
```

`on` is the event name. `where` takes `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `not_like`, `and_` and `or_`. `aggregate` takes `Count()` (the default), `Sum`, `Avg`, `Min`, `Max` and `Unique`. The CLI loads the file with `uv run` when the project has a `uv.lock`, and with `python3` otherwise, so `polar-sdk` must be installed in that environment.

### JSON

The file has the sections as lists, and each entry carries its `external_id`. Don't write the shape from memory: read an entry `init` wrote and follow it.

## Step 3: Plan, fix, show

```bash
polar config plan --json
```

- `entries` lists each resource with an `action` of `created`, `updated`, `unchanged` or `removed`, and for a change the `diff` of each field, `before` and `after`.
- `issues` lists problems with a `severity`, the `path` of the entry (`meters.tokens.name`), a `message` and the `location` in the file.

Fix every issue with severity `error` in the file and plan again. Show warnings to the user. "No events with this name have been received yet" is expected until the app sends that event; check the event name for a typo, then move on.

If the plan changes something you did not touch, the file is out of date with Polar. Stop and show the user instead of applying over it.

Then tell the user in plain words what would be created, updated and removed, with the old and new value of every price that changes.

## Step 4: Apply, then publish

Ask before each command. `--confirm` skips the CLI's own question, which a shell without a terminal cannot answer, so the user's yes to you is the confirmation.

```bash
polar config apply --confirm --json
polar config publish --confirm --json
```

- `apply` changes meters right away. Products and benefits are saved to a draft catalog, and nothing a customer sees changes yet. Until the draft is published, `plan` keeps listing them.
- `publish` makes the draft live: new checkouts sell it. Existing customers stay on the version they bought.

Production is a separate organization with its own catalog. When the user asks for it, have them run `polar auth login --production`, check `polar auth whoami --json`, then repeat Step 3 and Step 4 with the same file.

## Changing and retiring

| The user wants to | Do this |
| --- | --- |
| Rename what customers see | Change the name. Keep the key. |
| Change a price | Edit it, apply and publish. Existing subscribers keep their price. |
| Stop selling a product | Mark it deprecated, apply and publish. Don't delete the entry: a product with active subscriptions that is missing from the file is an error. |
| Change what a meter counts | Once a meter has billed usage, Polar rejects a change to its filter or aggregation, and `plan` reports it. Add a new meter under a new key and deprecate the old one. |
| Clean up the file | Run `polar config prune`. It removes deprecated entries nothing uses any more and changes nothing on Polar. |

Deprecate with `.deprecated()` in TypeScript, `deprecated=True` in Python and `"deprecated": true` in JSON. A deprecated entry stays for the customers who have it, and nothing new can use it.

## After the catalog is live

To sell the products, hand off to the `polar-integration` skill for the Checkout, Customer Portal and Webhooks endpoints, and to `polar-testing` to try them in sandbox.
