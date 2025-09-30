# Repository Guidelines

## Project Structure & Module Organization
The TypeScript source lives in `src/`, with UI orchestration in `src/app.ts`, API helpers in `src/api.ts`, and shared types in `src/types.ts`. Conversation starter assets are under `public/templates/` as JSONL files that webpack copies into the build. Static shell files (`index.html`, `styles.css`) sit at the repo root, while bundler and tooling configs (`webpack.config.js`, `tsconfig.json`, `eslint.config.js`) control builds and linting. Production bundles land in `dist/` after a build.

## Build, Test, and Development Commands
Run `pnpm dev` for the hot-reloading webpack dev server and keep the browser console open for API errors. Use `pnpm build` to emit a production bundle, and `pnpm start` when you want webpack-dev-server to open a browser tab automatically. Quality gates: `pnpm lint` (or `pnpm lint:fix`) for ESLint, `pnpm format:check` for Prettier verification, and `pnpm format` to rewrite files.

## Coding Style & Naming Conventions
The codebase targets TypeScript with 2-space indentation and semicolons. Favor top-level arrow functions and module-scoped helpers over classes; colocate derived types in `types.ts` and interfaces alongside their usage. Use camelCase for variables/functions, PascalCase for exported types, and uppercase snake case for constants such as `MODEL_INFO`. Always run Prettier and ESLint before pushing to keep imports ordered and string quotes consistent.

## Testing Guidelines
No automated test runner ships with the project yet, so treat manual verification as required. Launch `pnpm dev`, load a known template like `public/templates/meta-template.jsonl`, and confirm conversation playback, token accounting, and OAuth flows. When modifying templates, validate JSONL formatting with a quick load in the UI; malformed lines will fail silently.

## Commit & Pull Request Guidelines
Match the existing imperative voice used in history (`Allow settings modifications during conversation (#24)`). Keep subjects under ~60 characters, optionally referencing the issue or PR in parentheses. Each PR should describe the change, list manual tests executed, and include screenshots or GIFs for UI-affecting work. Highlight migrations or template changes in the description so reviewers can replicate locally.

## Security & Configuration Tips
API keys are stored in browser localStorage; never commit them or share screenshots that expose keys. Document new configuration toggles in the README and surface defaults in the UI. When adding templates, prefer anonymized example prompts and double-check that file names stay kebab-cased for predictable ordering.
