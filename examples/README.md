# Examples

## Scaffold an Angular SPA

```bash
spokay-app-starter create angular "My App"
```

## Scaffold a resource server

```bash
spokay-app-starter create resource-server "My API"
```

## Scaffold both, wired together

```bash
spokay-app-starter create fullstack "My Project"
```

Produces `my-project/frontend` and `my-project/backend` sharing one OIDC configuration,
plus a README explaining how to start each.

## Unattended

```bash
spokay-app-starter create angular "My App" \
  --oidc-authority https://idp.example.com/realms/demo \
  --client-id my-spa \
  --vcs gitlab --pkg pnpm --no-proxy \
  --yes
```

## A different template repository

```bash
spokay-app-starter create angular "My App" --template https://github.com/you/your-fork.git
```

The URL must be a git URL — `https://`, `git://` or `git@`. A filesystem path is rejected.
