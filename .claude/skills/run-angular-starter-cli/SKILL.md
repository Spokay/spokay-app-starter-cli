---
name: run-angular-starter-cli
description: Build, run, and drive the angular-starter-oidc CLI. Use when asked to run the CLI, scaffold a test project with it, exercise its prompts, verify token replacement / app-config generation / CI file selection, or run its tests.
---

`angular-starter-oidc` is a Node CLI that scaffolds an Angular app by cloning
`angular-starter-app-template` and replacing `__TOKEN__` placeholders. It has **no
non-interactive flags** — every setting is an inquirer prompt — so the driver
(`.claude/skills/run-angular-starter-cli/driver.mjs`) provides two ways in:

- `scaffold` — calls the `src/` module pipeline directly with a config object (~10s, no TTY).
- `tui` — drives the real `bin/cli.js` through **tmux**, answering the actual prompts.

Both end in the same assertions over the generated project. The template is served
from a **local dumb-HTTP git server** built out of the sibling
`angular-starter-app-template` checkout, so runs are offline and test the CLI against
the template it must stay in sync with.

All paths below are relative to `angular-starter-cli/`.

## Prerequisites

Nothing to `apt-get`; the driver uses only `node:` built-ins. Verified:

```bash
node -v     # v24.20.0  -- the CLI is ESM and requires Node >=22
tmux -V     # tmux 3.5a   (only needed for the `tui` command)
git --version
```

## Setup

```bash
npm install
npm link      # optional: exposes the global `angular-starter-oidc` command
```

## Run (agent path)

```bash
# fast: module pipeline + 10 assertions on the generated project
node .claude/skills/run-angular-starter-cli/driver.mjs scaffold

# all four proxy x vcs combinations
node .claude/skills/run-angular-starter-cli/driver.mjs matrix

# end-to-end through the real interactive CLI under tmux (slow: runs npm install)
node .claude/skills/run-angular-starter-cli/driver.mjs tui
```

Verified `scaffold` output:

```
template  : http://localhost:8899/tpl.git  (bare clone of .../angular-starter-app-template)
✔ Configuration tokens replaced!
✔ CI configured for github!
✔ app-config.json generated!

verifying /tmp/run-angular-starter-cli/out/my-test-app  (proxy=true, vcs=github)
✓ project directory is the package name, not the display name
✓ the template's own development artifacts are not inherited
✓ package.json name replaced
✓ package-lock.json name replaced
✓ angular.json is valid JSON again  proxyConfig="src/proxy.conf.json"
✓ index.html title is the display name
✓ footer shows the display name
✓ proxy.conf.json points at the resource server
✓ app-config.json matches the answers
✓ CI configured for github
✓ no unexpected __TOKEN__ left in the generated project  (only in docs: CLAUDE.md, .prettierignore)

11/11 checks passed
```

| command | what it does | time |
|---|---|---|
| `driver.mjs scaffold [--proxy false] [--vcs gitlab] [--pkg pnpm] [--install]` | direct module pipeline + verify | ~10s |
| `driver.mjs matrix` | scaffold+verify all 4 proxy × vcs combos (4 × 11 checks) | ~40s |
| `driver.mjs tui [--proxy false] [--vcs gitlab]` | real `bin/cli.js` over tmux + verify | 2–4 min |
| `driver.mjs verify <dir> [--proxy false] [--vcs gitlab]` | assertions only, on an existing generated project | instant |
| `driver.mjs serve` | just the local git template server (foreground) | — |
| `driver.mjs clean` | delete the workspace | — |

Generated projects land in `/tmp/run-angular-starter-cli/out/my-test-app` (override with
`WORKSPACE=`). Other env overrides: `TEMPLATE_SRC=` (path to the template checkout,
defaults to `../angular-starter-app-template`), `GIT_PORT=` (default 8899).

**Which path for which change:** touching `validators/`, `template/token-replacer.js`,
`template/ci-configurator.js` or `config/app-config-generator.js` → `scaffold` (or
`matrix`). Touching `prompts/user-config.js`, `bin/cli.js`, `scaffold/git-initializer.js`
or prompt ordering → `tui`, because `scaffold` bypasses the prompt layer entirely.

### Driving the CLI by hand over tmux

```bash
node .claude/skills/run-angular-starter-cli/driver.mjs serve &     # http://localhost:8899/tpl.git
tmux new-session -d -s cli -x 200 -y 50
tmux send-keys -t cli 'node bin/cli.js create "My Test App" --template http://localhost:8899/tpl.git --path /tmp/out' Enter
timeout 30 bash -c 'until tmux capture-pane -t cli -p | grep -q "OIDC authority URL"; do sleep 0.2; done'
tmux send-keys -t cli -l 'http://localhost:9999/realms/demo'; tmux send-keys -t cli Enter
tmux capture-pane -t cli -p
```

Send text with `send-keys -l` (literal) — without `-l`, tmux parses parts of a URL as key
names. List prompts (VCS host, package manager) take `Down`/`Up` then `Enter`.

## Run (human path)

```bash
angular-starter-oidc create "My App"     # after npm link; prompts, then scaffolds into ./my-app
```

Default template is `https://github.com/Spokay/angular-starter-app-template.git` (needs network).

## Test

```bash
npm test           # node test/basic-test.js -- 7 structural/validator tests, all pass
npm run lint       # eslint, clean
npm run format:check
```

## Gotchas

- **Piping answers into stdin does not work.** `printf 'a\nb\n...' | node bin/cli.js create ...`
  makes inquirer echo the characters into the *wrong* prompt and then hang — the first
  answer and the second get concatenated into the authority field. Use tmux (a real TTY)
  or the `scaffold` path.
- **Only `tui` exercises the prompt layer, and it catches things `scaffold` cannot.** The
  inquirer 14 upgrade dropped the legacy `list` prompt type in favour of `select`; the
  module pipeline passed every check while the real CLI died with
  `Prompt type "list" is not registered`. Run `tui` after touching anything under
  `src/prompts/`.
- **`isValidGitUrl` rejects filesystem paths.** `--template /path/to/template` and
  `--template file:///path` both fail with `Invalid template URL format`; only
  `https?://`, `git://` and `git@` match. That's why the driver serves a bare clone over
  HTTP instead of just pointing at the sibling directory. (`git daemon` is *not* installed
  here, so `git://` isn't an option either.)
- **An in-process HTTP server cannot serve the clone.** `template/cloner.js` uses
  `spawnSync`, which blocks the Node event loop — a server started in the same process
  never answers and the clone hangs forever with no output. The driver `fork()`s the
  server into its own process.
- **The driver tests the template's committed HEAD, not its working tree.** It bare-clones
  the sibling checkout. Uncommitted template edits are invisible to the CLI; commit them
  first.
- **Only documentation may still contain `__TOKEN__`.** The driver asserts zero tokens in
  the generated project except in `CLAUDE.md` and `.prettierignore`, which *describe* the
  templating (`DOCUMENTS_TOKENS` in the driver). A token anywhere else is a bug —
  `package-lock.json` used to be one until it was added to `filesToReplace`.
- **The clone strips the template's `.git` *and* `.claude`.** Both are development
  artifacts of the template repository; a generated project inheriting the template's run
  skill gets tooling that drives the wrong thing. `cloner.js` removes both.
- **`--path` is the parent directory, not the project directory.** The CLI appends the
  derived package name, so `--path /tmp/out` with `"My Test App"` produces
  `/tmp/out/my-test-app`.
- **The display name is converted, not validated as-is.** `"My Test App"` →
  `my-test-app`; camelCase, underscores and stray punctuation are all folded. Only a name
  that reduces to an empty string is rejected.
- **`pkill -f` matches this shell's own wrapper.** `pkill -f "http.server 8899"` kills the
  Bash tool's own `bash -c` process (its command line contains the pattern) and the tool
  call dies with exit 144. Kill by PID from `ss -ltnp` instead.

## Troubleshooting

- **Driver produces no output and then dies at the timeout**: Node buffers stdout when it
  is piped, and the buffer is lost on SIGTERM. Redirect to a file
  (`driver.mjs scaffold > /tmp/x.log 2>&1`) instead of piping to `head`/`tail` when
  debugging a hang.
- **`git server exited with null` / `EADDRINUSE`**: port 8899 is still held by a previous
  run. `ss -ltnp | grep 8899`, kill that PID, or re-run with `GIT_PORT=8898`.
- **`no git checkout at .../angular-starter-app-template`**: the sibling template repo
  isn't there. Point at one with `TEMPLATE_SRC=/path/to/angular-starter-app-template`.
- **`tui` prints `error connecting to /tmp/tmux-1000/default (No such file or directory)`**:
  harmless — that's the driver's initial `tmux kill-session` on a server that isn't
  running yet.
- **`tui` times out waiting for `Initialize git repository`**: `npm install` in the
  generated project is still running (2–4 min cold). Watch it with
  `tmux attach -t run-cli`.
