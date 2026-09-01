---
name: run-spokay-app-starter-cli
description: Build, run, and drive the spokay-app-starter CLI. Use when asked to run the CLI, scaffold a test project with it, exercise its prompts, verify token replacement / the template registry / fullstack cross-wiring, or run its tests.
---

`spokay-app-starter` scaffolds OIDC-ready projects from template repositories: an Angular
SPA, a Spring Boot resource server, or both wired to each other. The driver
(`.claude/skills/run-spokay-app-starter-cli/driver.mjs`) offers three ways in:

- `scaffold` / `fullstack` / `matrix` — call `generate()` from `dist/` directly (fast, no TTY)
- `tui` — drive the real `dist/cli.js` through **tmux**, answering the actual prompts
- `flags` — run the real binary fully flagged with stdin not a TTY
- `e2e` — scaffold a pair, **run both**, log in headlessly, and call the generated backend
  with the token the generated frontend obtained

Both templates are served from a **local dumb-HTTP git server** built out of the sibling
checkouts, so runs are offline and test the CLI against the templates it must stay in sync
with.

All paths below are relative to `spokay-app-starter-cli/`.

## Prerequisites

The CLI is TypeScript and every mode runs the build output, so the driver runs
`npm run build` itself before anything that loads `dist/` — no stale build can be tested.

Nothing to `apt-get`; the driver uses only `node:` built-ins. Verified:

```bash
node -v     # v24.20.0  -- the CLI is ESM and requires Node >=22
tmux -V     # tmux 3.5a   (only for `tui`)
git --version
```

The sibling template checkouts must exist next to this repo:
`../angular-starter-app-template` and `../resource-server-template`. Override with
`ANGULAR_SRC=` / `RESOURCE_SERVER_SRC=`.

## Setup

```bash
npm install
npm run build   # the driver does this too; needed by hand only for `node dist/cli.js`
npm link        # optional: exposes the global `spokay-app-starter` command
```

## Run (agent path)

```bash
# every template plus both fullstack wirings — the broad check
node .claude/skills/run-spokay-app-starter-cli/driver.mjs matrix

# one template
node .claude/skills/run-spokay-app-starter-cli/driver.mjs scaffold angular
node .claude/skills/run-spokay-app-starter-cli/driver.mjs scaffold resource-server

# the cross-wiring that justifies the command existing
node .claude/skills/run-spokay-app-starter-cli/driver.mjs fullstack
```

Verified `fullstack` output:

```
── frontend ──
✔ Configuration tokens replaced!
── backend ──
✔ Configuration tokens replaced!

verifying /tmp/run-spokay-app-starter-cli/out/my-test-app
✓ angular: development artifacts of the template are not inherited
✓ angular: package.json and lock file name replaced
✓ angular: angular.json is valid JSON again  proxyConfig="src/proxy.conf.json"
✓ angular: app-config.json matches the answers
✓ angular: CI configured for github
✓ angular: proxy config present only when the proxy is on
✓ angular: no unexpected __TOKEN__ left
✓ resource-server: package directory expanded from the token  com/acme/api
✓ resource-server: sources declare the chosen package
✓ resource-server: pom coordinates replaced
✓ resource-server: application.properties wired to the answers
✓ resource-server: no unexpected __TOKEN__ left
✓ fullstack: both sides point at the same OIDC authority  http://localhost:9999/realms/demo
✓ fullstack: both sides use the same client id  angular-starter
✓ fullstack: the backend's port is where the frontend expects it  8080
✓ fullstack: the backend allows the frontend's origin
✓ fullstack: a root README explains how to run both

17/17 checks passed
```

| command | what it does | time |
|---|---|---|
| `driver.mjs matrix` | 4 angular combos + resource-server + 2 fullstack wirings — **67 checks** | ~60s |
| `driver.mjs scaffold [angular\|resource-server] [--proxy false] [--vcs gitlab]` | one template + verify | ~10s |
| `driver.mjs fullstack [--proxy false]` | both templates + cross-wiring assertions | ~20s |
| `driver.mjs tui [angular\|resource-server\|fullstack]` | real prompts over tmux | 2–5 min |
| `driver.mjs flags` | real binary, every answer a flag, no TTY | ~10s |
| `driver.mjs e2e` | scaffold a pair, run both, log in, call the backend — **the only check that runs the generated projects** | 5–7 min |
| `driver.mjs serve` | just the local git server (foreground) | — |
| `driver.mjs clean` | delete the workspace | — |

Generated projects land in `/tmp/run-spokay-app-starter-cli/out/` (override with
`WORKSPACE=`); `GIT_PORT=` defaults to 8899.

**Which path for which change:** the registry, `generator.js`, `token-replacer.js` or a
template descriptor → `matrix`. Anything under `src/prompts/` or `src/cli.ts` → **`tui`**,
because the other paths bypass the prompt layer entirely. Flag handling → `flags`. Anything
touching how the two projects are wired to each other → **`e2e`**.

### The end-to-end run

```bash
node .claude/skills/run-spokay-app-starter-cli/driver.mjs e2e
```

Everything else checks generated *files*. This one runs the generated *projects*: it stands
up a full stub OIDC provider (`e2e.mjs`), scaffolds a fullstack pair against it, boots the
generated Spring Boot backend and `ng serve`s the generated Angular frontend, logs in
through the real authorization-code + PKCE flow in headless Chrome, and then calls the
backend through the dev proxy with the access token the frontend actually received.

```
✓ backend rejects an unauthenticated call
✓ the generated frontend completes a login against the generated backend's IdP
✓ the frontend shows the identity the IdP issued
✓ the backend accepts the access token the frontend obtained  via the dev proxy -> ["Music 1","Music 2","Music 3"]
✓ the proxied response is the backend's data

5/5 checks passed
```

Screenshots land in `/tmp/run-spokay-app-starter-cli/shots/`, logs in `backend.log` and
`frontend.log` beside them. It is slow mostly because the scaffold runs a real `npm install`
in the generated frontend.

**What it does not prove:** the Angular template has no UI that calls the resource server, so
the request is issued with the token read out of session storage rather than through
Angular's `HttpClient`. The library's interceptor — the thing that would attach the token in
a real app — is therefore not exercised.

### Driving the CLI by hand

```bash
node .claude/skills/run-spokay-app-starter-cli/driver.mjs serve &
# angular          http://localhost:8899/angular.git
# resource-server  http://localhost:8899/resource-server.git

node dist/cli.js create fullstack "My App" --path /tmp/out \
  --oidc-authority http://localhost:9999/realms/demo --client-id demo --yes --no-git
```

## Run (human path)

```bash
spokay-app-starter list
spokay-app-starter create fullstack "My Project"    # after npm link
```

Default template URLs point at GitHub, so this needs network.

## Test

```bash
npm test              # builds, then 7 structural/validator tests against `dist/`
npm run typecheck     # `tsc --noEmit` over `src/`
npm run lint
npm run format:check
```

## Gotchas

- **Only `tui` exercises the prompt layer, and it catches what nothing else can.** inquirer
  14 dropped the legacy `list` prompt type; the module pipeline passed every check while the
  real CLI died with `Prompt type "list" is not registered`. Run `tui` after touching
  `src/prompts/` or `src/cli.ts`.
- **Negated commander options carry a default.** `--no-proxy` leaves `options.proxy === true`
  with source `default`, and `--no-git` sets `options.git === false` (there is no
  `options.noGit`). Presets are filtered on
  `command.getOptionValueSource(flag) === 'cli'`; without that the proxy question is
  silently pre-answered and never appears, which desyncs the `tui` script.
- **`isValidGitUrl` rejects filesystem paths.** `--template /path` and `file:///path` both
  fail with `Invalid template URL format`; only `https?://`, `git://` and `git@` match. That
  is why the driver serves bare clones over HTTP. `git daemon` is not installed here either.
- **An in-process HTTP server cannot serve the clone.** `cloner.js` uses `spawnSync`, which
  blocks the event loop, so the server never answers and the clone hangs with no output. The
  driver `fork()`s it.
- **The driver tests the templates' committed HEAD, not their working trees.** It bare-clones
  the sibling checkouts, so uncommitted template edits are invisible — commit them first.
  It also follows whatever branch each sibling has checked out.
- **The Maven wrapper contains `__MVNW_CMD__`.** A naive "no `__TOKEN__` survives" check
  flags `mvnw.cmd`; it is a vendored batch variable, not a placeholder. The check excludes
  the wrapper and `.mvn/`, plus `CLAUDE.md` and `.prettierignore`, which document tokens.
- **Verify against the answers actually given.** The `tui` script types the Java groupId and
  base package rather than accepting defaults, so both paths assert the same values.
- **The e2e run needs three ports plus Chrome's**: 9999 (stub IdP), 8080 (generated
  backend), 4200 (generated frontend), 9222 (CDP). `mvnw` and `ng serve` both fork children,
  so the driver spawns them `detached` and kills the process group; killing only the parent
  leaks a JVM on 8080.
- **`pkill -f` matches this shell's own wrapper**, killing the calling Bash tool call (exit
  144, no output). Kill by PID from `ss -ltnp` instead.

## Troubleshooting

- **Driver dies at the timeout with no output**: Node buffers stdout when piped and loses it
  on SIGTERM. Redirect to a file rather than piping to `tail` when debugging a hang.
- **`git server exited with null` / `EADDRINUSE`**: port 8899 still held by a previous run.
  `ss -ltnp | grep 8899`, kill that PID, or set `GIT_PORT=8898`.
- **`no git checkout at .../angular-starter-app-template`**: a sibling template is missing.
  Point at it with `ANGULAR_SRC=` or `RESOURCE_SERVER_SRC=`.
- **`tui` times out waiting for `Initialize git repository`**: `npm install` in the generated
  Angular project is still running (2–4 min cold). Watch with `tmux attach -t run-cli`.
- **`--yes needs these to be supplied as flags: --oidc-authority`**: working as intended —
  there is no sensible default for an identity provider.
