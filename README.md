# svbkmonorepo

Monorepo for the SVBK school fee management platform.

## Layout

```
.
├── apps/
│   ├── api/          # @svbk/api        — NestJS, school admin API
│   ├── parent-api/   # @svbk/parent-api — NestJS, parent OTP API
│   ├── admin/        # @svbk/admin      — Next.js, admin web portal     (port 3001)
│   └── parent/       # @svbk/parent     — Next.js, parent web portal    (port 3002)
├── packages/         # shared libraries (types, ui, config) — empty for now
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Tooling

- **pnpm workspaces** for dependency management
- **Turborepo** for task orchestration and caching
- **Node 20** (see `.nvmrc`)

## Getting started

```bash
npm install -g pnpm     # if you don't have pnpm
pnpm install            # install all workspace deps
pnpm dev                # run all dev servers in parallel
pnpm build              # build everything
```

### Run a single app

```bash
pnpm --filter @svbk/api dev
pnpm --filter @svbk/admin dev
pnpm --filter @svbk/parent dev
pnpm --filter @svbk/parent-api dev
```

## Common scripts (root)

| Script | What it does |
|---|---|
| `pnpm dev` | Run `dev` in every workspace that has it |
| `pnpm build` | Build all apps (NestJS → `dist/`, Next.js → `.next/`) |
| `pnpm lint` | Lint all apps |
| `pnpm test` | Test all apps |
| `pnpm typecheck` | TypeScript check across all apps |
| `pnpm clean` | Remove build outputs and root `node_modules` |

## Environment files

Each app keeps its own `.env`. Real `.env` files are gitignored — commit
only `.env.example` files showing the required variables.

## Sharing code between apps

Drop a folder under `packages/` (e.g. `packages/types`) with its own
`package.json` named `@svbk/types`. Reference it from any app:

```json
{ "dependencies": { "@svbk/types": "workspace:*" } }
```

Then run `pnpm install`.
