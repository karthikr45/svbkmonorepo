# svbkmonorepo

Monorepo containing the API and the two web portals.

## Layout

```
.
├── apps/
│   ├── api/      # backend API service
│   ├── admin/    # admin portal (web)
│   └── parent/   # parent portal (web)
├── packages/     # shared libraries (types, ui, config, etc.)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Tooling

- **pnpm workspaces** for dependency management.
- **Turborepo** for task orchestration and caching.
- **Node 20** (see `.nvmrc`).

## Getting started

```bash
# install pnpm if you don't have it
npm install -g pnpm

# install all workspace deps
pnpm install

# run all dev servers
pnpm dev

# build everything
pnpm build
```

## Adding your existing projects

Each app lives under `apps/<name>/` and must have its own `package.json`
with a unique `name` field. To migrate an existing project into this repo:

1. Copy the project's source into the matching folder:
   - API           → `apps/api/`
   - Admin portal  → `apps/admin/`
   - Parent portal → `apps/parent/`

   You can use:
   ```bash
   # from the project's current location
   rsync -a --exclude node_modules --exclude .git ./ /path/to/svbkmonorepo/apps/<name>/
   ```

   Or, to preserve git history, use `git subtree add` or
   [`git filter-repo`](https://github.com/newren/git-filter-repo).

2. Make sure each app's `package.json` has a unique `name`, e.g.
   `@svbk/api`, `@svbk/admin`, `@svbk/parent`.

3. Add `build`, `dev`, `lint`, `test`, `typecheck` scripts to each app's
   `package.json` so Turborepo can run them. Example:
   ```json
   {
     "name": "@svbk/api",
     "scripts": {
       "dev": "your-dev-command",
       "build": "your-build-command",
       "lint": "your-lint-command",
       "test": "your-test-command",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

4. From the repo root, run `pnpm install`. pnpm will hoist shared deps
   into the root `node_modules` and link workspace packages together.

5. Commit. Done.

## Sharing code between apps

Create a folder under `packages/` (e.g. `packages/types`) with its own
`package.json` whose `name` is `@svbk/types`. Reference it from any app:

```json
{
  "dependencies": {
    "@svbk/types": "workspace:*"
  }
}
```

Then `pnpm install` and import as `@svbk/types`.
