# Operant

> A small learning mind — "the Sim" — lives inside a space it did not choose ("the Substrate").
> It moves. It learns. Every visitor who has ever been here has shaped it a little, permanently,
> through reward and punishment. Nothing about it is ever undone.

Operant is an art installation and an engineering portfolio piece: one persistent
reinforcement-learning agent, running continuously on a server, shaped forever by every Observer
who visits. It is inspired by Sun Yuan & Peng Yu's _Can't Help Myself_ and by simulation theory.

The full concept lives in [`DESIGN.md`](./DESIGN.md); the authoritative build brief and hard
constraints live in [`CLAUDE.md`](./CLAUDE.md).

## Status

Build-order **step 1: project scaffold**. The structure, tooling, tests, and CI are in place; the
Q-learning core, persistence, simulation host, 3D scene, and narrator are not implemented yet — they
are the subsequent build-order steps in `CLAUDE.md`.

## Repository layout

This is a [pnpm](https://pnpm.io/) workspace monorepo:

| Package         | What it is                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/core` | Framework-agnostic RL engine + shared domain types. **No React, no Three.js.** Unit-tested in isolation. |
| `apps/server`   | The always-on **simulation host**: owns the single Sim, ticks it forever, persists it, streams state.    |
| `apps/client`   | The **Observer's** React + react-three-fiber view. A rendering layer only — never owns the sim loop.     |

The RL core / simulation host must stay decoupled from the rendering layer. That boundary is
enforced mechanically by ESLint (`no-restricted-imports`), not just by convention: importing React
or Three.js into `packages/core` or `apps/server` is a lint **error**.

## Prerequisites

- **Node.js 22+** (see [`.nvmrc`](./.nvmrc))
- **pnpm** — this repo pins its version via `packageManager`; the easiest way to get it is Corepack,
  which ships with Node:

  ```sh
  corepack enable
  ```

## Getting started

```sh
pnpm install            # install all workspace dependencies
cp .env.example .env    # then fill in local values (never commit .env)

pnpm run check          # format check + lint + type-check + test across all packages
```

### Common scripts (run from the repo root)

| Command               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `pnpm run lint`       | ESLint across the whole monorepo                              |
| `pnpm run typecheck`  | `tsc --noEmit` in every package                               |
| `pnpm run test`       | Vitest (unit + integration) in every package                  |
| `pnpm run build`      | Build every package (`tsup` for core/server, Vite for client) |
| `pnpm run dev:server` | Run the simulation host in watch mode                         |
| `pnpm run dev:client` | Run the Vite dev server for the Observer client               |

## Configuration & secrets

Local configuration uses a gitignored `.env`; [`.env.example`](./.env.example) documents every
variable with no real values. In production, secrets are set as **Railway** environment variables
(simulation host) and **Vercel** environment variables (client). Real keys are never committed —
this repo is public.

## Continuous integration

Every push and pull request runs format-check, lint, type-check, test, and build via GitHub Actions
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

## License

© Aaron Simo — [aaronsimo.com](https://aaronsimo.com). All rights reserved.
