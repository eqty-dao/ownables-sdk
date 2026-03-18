# Ownables SDK (React)
SDK wallet/UI to develop and test Ownables (CosmWasm smart contracts running in-browser).

Stack: React + TypeScript app (Vite + Tailwind + BaseUI primitives).

## Project Structure
- `src/` — React app source (TypeScript, components, services).
- `ownables/` — Example Ownable packages (Rust/wasm or static).
- `bin/` — Helper scripts.
- `vite.config.ts`, `ownable-js.webpack.js` — Build config.

## Commands
- `npm i` — Install dependencies
- `npm run dev` — Dev server (runs `build:ownable.js` first, then `vite`)
- `npm test` — Tests (Jest + Testing Library)
- `npm run build` — Production build
- `npm run rustup` — Initialize Rust toolchain (optional, for ownable dev)
- `npm run ownables:build-all` / `--package=<name>` — Build ownables
- `npm run ownables:cid --package=<name>` — Compute CID for package zip

## When to Run Tests/Builds
- Run `npm test` when modifying `src/` or changing app logic.
- Run `npm run build` when touching TypeScript types, build config, or dependencies.
- Ownable builds only needed if changes rely on updated example packages.

## Code Style
- TypeScript strict mode; React function components and hooks.
- UI must use Tailwind utility classes + BaseUI primitives + `class-variance-authority` (`cva`) for variants.
- Prefer typed variant maps (`cva`) over ad-hoc conditional class strings for component states/sizes/intent.
- Avoid introducing MUI patterns/components in new or refactored UI code.
- Formatting: Prettier defaults (2 spaces, semicolons). Fix ESLint warnings.
- Error handling: `try/catch` in `src/services/*`; surface errors via Notistack.
- Keep components small, typed, with co-located styles and tests.

## Test-driven development

When implementing a feature or fixing a bug that affects the UI, write the Gherkin scenario before writing any implementation code.

1. Write a `.feature` file in `/features` describing the expected user interaction and outcome.
2. Run it with letsrunit to confirm it fails. If it passes, either the feature already exists or the scenario is not testing the right thing.
3. Implement until the scenario passes.
4. Do not modify the scenario to fit the implementation. If the test fails, fix the code.

If you cannot write the scenario before implementing, the requirements are not specific enough. Ask for clarification rather than making assumptions in code.

## Unit Testing
- Jest + React Testing Library. Prefer queries by role/label/text over test IDs.
- Write tests for logic-heavy hooks/services and critical UI flows.

## Making Changes
- Keep changes minimal and focused.
- Avoid new dependencies; prefer existing stack.
- If editing build config, verify both `npm run dev` and `npm run build`.

## Submission Checklist
- `npm run build` succeeds.
- `npm test` passes.
- No unnecessary files added; changes are minimal.
- Update README if new env vars or commands are introduced.
