# spokay-app-starter

A CLI for scaffolding OIDC-ready starter projects: an Angular SPA, a Spring Boot resource
server, or both wired to each other.

## Installation

```bash
npm install -g spokay-app-starter
```

Local development:

```bash
npm install
npm link
```

## Usage

```bash
spokay-app-starter list                              # what can be scaffolded
spokay-app-starter create angular "My App"           # Angular 22 SPA with OIDC
spokay-app-starter create resource-server "My API"   # Spring Boot 4 resource server
spokay-app-starter create fullstack "My Project"     # both, pointing at each other
```

Each command prompts for what it needs. The project directory is derived from the name:
`"My App"` becomes `my-app`.

### Fullstack

`create fullstack` is the reason this CLI is not two CLIs. It asks for the OIDC authority,
client id and the two URLs **once**, then writes them into both projects:

```
my-project/
├── frontend/     Angular SPA
├── backend/      Spring Boot resource server
└── README.md     how to run both
```

The frontend's `secureRoutes` and the backend's `cors.allowed-origins` and `server.port` are
derived from the same answers, so the pair works on first run instead of after a round of
manual reconciliation.

### Running unattended

Every prompt has a flag. Supply what matters and add `--yes` to take defaults for the rest:

```bash
spokay-app-starter create resource-server "My API" \
  --oidc-authority https://idp.example.com/realms/demo \
  --client-id my-client \
  --base-package com.example.api \
  --yes --no-git
```

`--yes` refuses to guess an OIDC authority or client id — there is no sensible default — and
tells you which flags are missing.

| flag | applies to |
|---|---|
| `--oidc-authority`, `--client-id`, `--frontend-url`, `--backend-url` | all |
| `--no-proxy`, `--vcs`, `--pkg`, `--node-version` | angular, fullstack |
| `--group-id`, `--base-package`, `--java-version`, `--context-path` | resource-server, fullstack |
| `-p, --path`, `-t, --template`, `--force`, `--no-git`, `-y, --yes` | all |

## Adding a template

Templates are data, not code paths. `src/templates/<id>.js` describes one:

| field | purpose |
|---|---|
| `repo` | git URL to clone |
| `questions` | inquirer questions, each with a `flag` name |
| `files(answers)` | files to run token replacement over |
| `fileGlobs(answers)` | globs for the same, e.g. `src/**/*.java` |
| `renames(answers)` | directory renames, applied **before** replacement |
| `tokens(answers)` | the `__TOKEN__` map |
| `postSteps` | extra work, e.g. deleting the unused CI config |
| `install(answers)` | package manager to run, or `null` |

Register it in `src/templates/registry.js`. The generator and the CLI pick it up with no
further changes.

## Development

```bash
npm test              # structural and validator tests
npm run lint
npm run format:check
```

The run skill exercises the whole thing against the real template repositories, served
locally so nothing hits the network:

```bash
node .claude/skills/run-spokay-app-starter-cli/driver.mjs matrix   # every template
node .claude/skills/run-spokay-app-starter-cli/driver.mjs tui      # the real prompts
node .claude/skills/run-spokay-app-starter-cli/driver.mjs flags    # the unattended path
```
