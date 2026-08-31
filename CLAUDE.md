# CLAUDE.md

Guidance for Claude Code working on `spokay-app-starter`, the CLI that scaffolds the
starter templates.

## What this CLI does

Scaffolds OIDC-ready projects from template repositories:

| template | repository |
|---|---|
| `angular` | `Spokay/angular-starter-app-template` — Angular 22 SPA |
| `resource-server` | `Spokay/resource-server-template` — Spring Boot 4 resource server |
| `fullstack` | both, generated together and cross-wired |

```bash
spokay-app-starter list
spokay-app-starter create <angular|resource-server|fullstack> <project-name> [flags]
```

The package is **ESM** (`"type": "module"`). Use `import`, JSON needs
`with { type: 'json' }`, and `__dirname` is `import.meta.dirname`.

## Architecture

Templates are **data**; the pipeline is generic. Adding a stack means adding a descriptor,
not a branch in the generator.

```
bin/cli.js                 commander surface; one subcommand per registry entry
src/commands/create.js     single template: prompt -> generate -> git
src/commands/fullstack.js  both templates + the root README (generateFullstack)
src/generator.js           clone -> renamePaths -> replaceTokens -> postSteps -> install
src/templates/registry.js  the map of id -> descriptor
src/templates/*.js         one descriptor per stack
src/prompts/shared.js      questions asked once and shared by both templates
src/prompts/ask.js         flags win over prompts; --yes takes defaults
```

### Template descriptor

| field | purpose |
|---|---|
| `repo` | git URL to clone |
| `questions` | inquirer questions, each carrying a `flag` name |
| `files(answers)` | files to run replacement over |
| `fileGlobs(answers)` | globs for the same, e.g. `src/**/*.java` |
| `renames(answers)` | directory renames, applied **before** replacement |
| `tokens(answers)` | the `__TOKEN__` map |
| `postSteps` | extra work: CI selection, app-config.json, deletions |
| `install(answers)` | package manager to run, or `null` |

### Ordering that matters

`renamePaths` runs **before** `replaceTokens`. The Java template ships its sources under a
directory literally named `__BASE_PACKAGE__`; replacing file contents first would leave
sources whose `package` declaration no longer matches their directory, which javac rejects.

## Token vocabulary

Shared between the templates on purpose — the fullstack command asks once and writes both.

| token | source |
|---|---|
| `__APP_NAME__` / `__ARTIFACT_ID__` | derived from the project name |
| `__APP_DISPLAY_NAME__` | the project name as typed |
| `__OIDC_AUTHORITY__`, `__CLIENT_ID__` | shared prompts |
| `__REDIRECT_URL__`, `__POST_LOGOUT_REDIRECT_URL__` | `frontendUrl` |
| `__BACKEND_URL__`, `__SERVER_PORT__` | `resourceServerUrl` |
| `__SECURE_ROUTES__`, `__PROXY_CONFIG__` | conditional on `useProxy` |
| `__CORS_ALLOWED_ORIGINS__` | `frontendUrl` |
| `__BASE_PACKAGE__`, `__GROUP_ID__`, `__JAVA_VERSION__`, `__CONTEXT_PATH__` | resource-server prompts |
| `__NODE_VERSION__`, `__PKG_MGR__`, `__PKG_MGR_RUN__` | angular prompts |

Changing where a token is used means updating the template repo **and** the descriptor's
`files`/`tokens` in the same change.

## Gotchas

- **Negated commander options carry a default.** `--no-proxy` gives `options.proxy === true`
  with source `default`, and there is no `options.noGit` — it is `options.git === false`.
  `presetsFrom` therefore filters on `command.getOptionValueSource(flag) === 'cli'`;
  reading the value alone silently answers the proxy question on every run and the prompt
  never appears.
- **`isValidGitUrl` rejects filesystem paths.** Only `https?://`, `git://`, `git@`. The run
  skill serves the sibling checkouts over a local HTTP git server for that reason.
- **The clone strips the template's `.git` and `.claude`.** Both are development artifacts
  of the template repo; a generated project inheriting the template's run skill gets tooling
  that drives the wrong thing.
- **Only files listed in the descriptor get replaced.** A token added to a template file
  that is not in `files`/`fileGlobs` silently survives into generated projects. The run
  skill asserts no `__TOKEN__` survives except in docs and the vendored Maven wrapper, which
  uses `__MVNW_CMD__` internally.
- **Prompt types are inquirer 14's**: `input`, `confirm`, `select`, `checkbox`, `number`,
  `password`, `search`. The legacy `list` type was removed.

## Testing

```bash
npm test              # structural and validator tests
npm run lint
npm run format:check
```

The real coverage is the run skill, which scaffolds against the actual template repos:

```bash
node .claude/skills/run-spokay-app-starter-cli/driver.mjs matrix    # every template + fullstack
node .claude/skills/run-spokay-app-starter-cli/driver.mjs tui       # the real prompts, over tmux
node .claude/skills/run-spokay-app-starter-cli/driver.mjs flags     # unattended, no TTY
```

`matrix` bypasses the prompt layer, so **run `tui` after touching anything under
`src/prompts/` or `bin/cli.js`** — that is how the inquirer `list`/`select` break was caught.
