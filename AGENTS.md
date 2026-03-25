# Ownables SDK (React)
SDK wallet/UI to develop and test Ownables (CosmWasm smart contracts running in-browser).

Stack: React + TypeScript app (Vite + Tailwind + BaseUI primitives).

## Project Structure
- `src/` — React app source (TypeScript, components, services).
- `ownables/` — Example Ownable packages (Rust/wasm or static).
- `bin/` — Helper scripts.
- `vite.config.ts`, `ownable-js.webpack.js` — Build config.

## Commands
- `yarn install` — Install dependencies
- `yarn dev` — Dev server (runs `build:ownable.js` first, then `vite`)
- `yarn test:e2e` — Cucumber E2E tests
- `yarn build` — Production build
- `yarn rustup` — Initialize Rust toolchain (optional, for ownable dev)
- `yarn ownables:build` — Build all ownables
- `yarn ownables:build <name>` — Build a single ownable package
- `yarn ownables:cid --package=<name>` — Compute CID for package zip

## When to Run Tests/Builds
- Run `yarn test:e2e` when modifying `src/` or changing app logic.
- Run `yarn build` when touching TypeScript types, build config, or dependencies.
- Ownable builds only needed if changes rely on updated example packages.

## Code Style
- TypeScript strict mode; React function components and hooks.
- UI must use Tailwind utility classes + BaseUI primitives + `class-variance-authority` (`cva`) for variants.
- Prefer typed variant maps (`cva`) over ad-hoc conditional class strings for component states/sizes/intent.
- Avoid introducing MUI patterns/components in new or refactored UI code.
- Formatting: Prettier defaults (2 spaces, semicolons). Fix ESLint warnings.
- Error handling: `try/catch` in `src/services/*`; surface errors via Notistack.
- Keep components small, typed, with co-located styles and tests.

## Making Changes
- Keep changes minimal and focused.
- Avoid new dependencies; prefer existing stack.
- If editing build config, verify both `yarn dev` and `yarn build`.

## Submission Checklist
- `yarn build` succeeds.
- `yarn test:e2e` passes.
- No unnecessary files added; changes are minimal.
- Update README if new env vars or commands are introduced.

