# Agent Notes

- The extension source and its development commands are under `extension/`. Read [`extension/AGENTS.md`](extension/AGENTS.md) before changing extension code.
- Root-level project documentation is in `README.md`; sample JSON and its generator are in `samples/`.
- Run extension commands from `extension/`. For code changes, use `yarn test`, `yarn tsc --noEmit`, `yarn eslint .`, and the relevant browser build.
- Do not commit generated `extension/dist/` output unless preparing a release.
