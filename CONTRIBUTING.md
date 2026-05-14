# Contributing

## Commits (Conventional Commits)

This repository uses [Conventional Commits](https://www.conventionalcommits.org/). Pull requests are checked with **commitlint** (see `.github/workflows/commitlint.yml` and `commitlint.config.mjs`).

### Allowed commit types

The `type-enum` includes: **`feat`**, **`fix`**, **`helm`**, plus the usual **`chore`**, **`docs`**, **`style`**, **`refactor`**, **`perf`**, **`test`**, **`build`**, **`ci`**, **`revert`**.

Examples:

- `feat(api): add weather cache`
- `fix(app): correct map restore`
- `helm(api): bump resources for OpenShift`
- `chore: update dependencies`

### Releases (release-please)

The **Release Please** workflow runs on pushes to `main` **only when** the pushed range includes at least one commit whose subject matches:

- `feat: …` or `feat(scope): …` (optional `!` for breaking)
- `fix: …` or `fix(scope): …`
- `helm: …` or `helm(scope): …`

Or a **release-please merge** subject matching `chore(...): release...` (so the bot can finish a release after you merge its PR).

If you only land `chore:` / `docs:` / etc. commits, **release-please is skipped** for that push.

**Note:** Release Please’s semver bump still follows its conventional-commit rules (`feat` → minor, `fix` → patch). The custom type **`helm`** is allowed by commitlint and opens the release workflow when it is the head-line type; if you find `helm:` does not bump the version as expected, use **`fix(helm): ...`** for a guaranteed patch bump.

### Helm chart versions

`release-please` bumps `api/package.json`, `app/package.json`, and syncs **`version`** / **`appVersion`** in:

- `api/helm/titan-v-api/Chart.yaml`
- `app/helm/titan-v-app/Chart.yaml`

via `extra-files` in `release-please-config.json`.
