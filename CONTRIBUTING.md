# Contributing to ArchIt

Pull requests are welcome. This file describes how this repo actually works —
the toolchain it needs, the checks that gate `main`, and the conventions that
reviews look for.

## Requirements

Node **22.18 or newer**. This is not a soft floor: the test files are `.mjs` but
import `.ts` modules directly, which only works with Node's native type
stripping. On older Node, `npm test` fails at the import, not at an assertion.
The floor is enforced by `engines.node` in [`package.json`](package.json);
[`.nvmrc`](.nvmrc) pins the line CI resolves from, so `nvm use` puts you on the
same series the workflow builds against.

There is no test framework — suites run on `node --test`.

## Setup

```bash
npm ci
cp .env.example .env.local   # then fill it in
npm run dev
```

`.env.example` lists all nine variables, and the README's environment table says
what each one is for. Fill in at least the Supabase and Clerk
values before expecting Find or Designer to load — Clerk wraps the whole app and
every data route reads Supabase, so a partially filled file mostly produces
runtime errors rather than a degraded-but-working app.

## Before you open a pull request

Run all four. CI runs exactly these, in this order, and nothing merges without
them:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

The build step is the one most likely to surprise you — `next build` evaluates
every route module to collect page data, so code that touches a client at module
scope fails the build even though it works in `next dev`. See the lazy Supabase
client note in the README before adding a new module-scope client.

This version of Next.js has breaking changes relative to older releases, so
check the guides bundled in `node_modules/next/dist/docs/` rather than working
from memory — see [`AGENTS.md`](AGENTS.md). Note that middleware lives in
[`proxy.ts`](proxy.ts) here, not `middleware.ts`.

## How `main` is protected

`main` is governed by a checked-in ruleset,
[`.github/rulesets/main-protection.json`](.github/rulesets/main-protection.json):

- Pull request required — no direct pushes
- `build-and-test` must pass, with a strict up-to-date policy, so your branch
  has to be rebased on `main` before it can merge
- All review threads resolved
- Squash merges only, linear history
- No force-push, no branch deletion

Three review gates are deliberately switched off because a single maintainer
cannot satisfy them — GitHub does not let you approve your own pull request.
[`.github/rulesets/README.md`](.github/rulesets/README.md) explains which ones
and when they get turned back on; don't re-litigate it here.

Because of the strict up-to-date policy, rebase rather than merge `main` into
your branch. The squash merge collapses the branch anyway, so a clean rebase
costs you nothing.

## Conventions

**Commit messages and comments explain _why_.** The diff already shows what
changed. A commit body should say what was broken or missing and why this is the
fix; a comment should explain the constraint that makes the code look the way it
does, not narrate the line below it. Comments that restate the code get removed
in review. The recent commit bodies are the best guide to the house style; older
history is less consistent, so read the newest ones.

Use conventional-commit prefixes (`feat`, `fix`, `chore`, `ci`, `docs`,
`refactor`) with an optional scope. Most of the recent history follows this, but
not all of it — follow the convention rather than the exceptions. Keep the
subject line short and in the imperative.

**Migrations are forward-only.** Files in
[`supabase/migrations/`](supabase/migrations) have been applied to production
and are never edited or removed — fix a mistake with a new migration on top.
Write them so a replay is safe (`if not exists`, idempotent backfills); several
existing ones do exactly that.

**The server owns every price.** Clients send a purpose, never an amount.
If your change touches payments, fees, or entitlements, keep the amount out of
the request body and derive entitlements from the purchase ledger. Those paths
are listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) for a reason.

**Row Level Security is deny-all on purpose.** New tables get RLS enabled with
no policies; access goes through server routes that stamp `user_id` from the
Clerk session, never from the request body.

## Reporting bugs

Use the issue forms — [bug
report](.github/ISSUE_TEMPLATE/bug_report.yml) or [feature
request](.github/ISSUE_TEMPLATE/feature_request.yml). For bugs, the browser and
GPU fields matter more than they usually would: both Find and Designer are WebGL
surfaces, and a lot of "the map is blank" reports come down to a specific
GPU/driver or a failed tile fetch rather than app logic.

## License

Contributions are made under the [MIT License](LICENSE).
