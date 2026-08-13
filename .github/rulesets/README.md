# Branch rulesets

`main-protection.json` mirrors the ruleset currently active on `main`. It is
checked in so the configuration is reviewable, and so it can be re-imported if
the ruleset is ever deleted (Settings → Rules → New ruleset → Import).

Keep this file equal to what is applied. A file that enables more than
production does is worse than no file, because re-importing it silently locks
the default branch.

Apply or update it with:

```
gh api repos/<owner>/<repo>/rulesets --method POST --input .github/rulesets/main-protection.json
```

## What is active

- Pull request required; no direct pushes to `main`
- `build-and-test` must pass, with a strict up-to-date policy (branch must be
  rebased on `main` before merging)
- All review threads resolved
- Squash-only merges, linear history
- No branch deletion, no force-push

## Deliberately off

Three review gates are unsatisfiable with a single maintainer, because GitHub
does not allow approving your own pull request. Enabling any of them blocks
every merge into `main`:

- `required_approving_review_count` (set to `0`)
- `require_code_owner_review`
- `require_last_push_approval`

Raise all three the day a second person gets write access. `.github/CODEOWNERS`
is already in place, so `require_code_owner_review` will attach correctly.

`required_signatures` is also off. Commits are signed locally already
(`gpg.format ssh`, `commit.gpgsign true`), but GitHub reports them as
`Unverified` until the SSH signing key is registered on the account under
Settings → SSH and GPG keys → **New SSH key** with key type **Signing Key**.
Enabling the rule before that blocks every merge. Once commits show `Verified`,
add it:

```
gh api repos/<owner>/<repo>/rulesets/<id> --method PUT \
  --input <(node -e 'const r=require("./.github/rulesets/main-protection.json");r.rules.push({type:"required_signatures"});console.log(JSON.stringify(r))')
```

and append `{ "type": "required_signatures" }` to `main-protection.json` in the
same pull request, so this file keeps matching production.
