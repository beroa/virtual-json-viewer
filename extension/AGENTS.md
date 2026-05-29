# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React browser extension. Source lives in `src/`, grouped by extension surface: `viewer/` for JSON rendering, `options/` for settings, `content/` for page activation/loading, and `launcher/` for wrappers. Shared utilities are in `src/viewer/commons/`, hooks in `src/viewer/hooks/`, and translations in `src/viewer/localization/translations/`. Static assets and the manifest template are in `public/`; HTML entry pages are in `pages/`. Builds go to `dist/chrome/` and `dist/firefox/`.

## Build, Test, and Development Commands

Use Yarn for project commands.

- `yarn dev`: start the Vite dev server for local UI development.
- `yarn build:chrome`: build the Chrome extension into `dist/chrome/`.
- `yarn build:firefox`: build the Firefox extension into `dist/firefox/`.
- `yarn build:all`: build both targets.
- `yarn package:all`: create release ZIPs.
- `yarn fix`: run Prettier, TypeScript checking, and ESLint auto-fixes.
- `yarn clean`: remove generated files from `dist/`.

There is no `test` script; use `yarn tsc --noEmit` and `yarn eslint .` as minimum validation.

## Coding Style & Naming Conventions

Code is TypeScript and React with ES modules. Prettier enforces 2-space indentation, semicolons, double quotes, trailing commas, organized imports, and Tailwind class ordering. Components and component files use PascalCase, for example `TreeViewer.tsx`; hooks use `Use...` names, such as `UseStorage.ts`. Prefer the `@/` alias for imports from `src/`.

ESLint uses recommended JavaScript, TypeScript, and React JSX runtime rules. Prefix intentionally unused parameters or variables with `_`.

## Testing Guidelines

No automated test framework is configured. For behavior changes, add manual verification notes to the PR and validate relevant extension surfaces and browser targets when practical. At minimum, run `yarn fix` and a target build such as `yarn build:chrome`. For viewer changes, check tree view, raw view, search, URL fragments, and touched options persistence paths.

## Commit & Pull Request Guidelines

Recent history uses short, imperative commit subjects, often with PR numbers, for example `Fix runtime circular dependency (#114)`, plus release tags like `v2.2.1`. Keep commits focused.

Pull requests should include a summary, validation commands, affected browser target(s), and screenshots or recordings for UI changes. Link related issues when available. Do not commit generated `dist/` artifacts unless release work requires them.

## Security & Configuration Tips

Treat `public/manifest.json` as a template; `vite.build.ts` patches browser-specific fields and package version during builds. Keep permission changes minimal and call them out in PRs. Do not edit vendored WASM files unless intentionally updating jq.
