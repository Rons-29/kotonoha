# Contributing

## Requirements

- Node.js
- npm

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

The build outputs `main.js` at the repository root and copies release assets to `plugin-dist/`.

To sync directly into a local Obsidian vault:

```bash
OBSIDIAN_PLUGIN_DIR="/path/to/Vault/.obsidian/plugins/kotonoha" npm run build
```

## Checks

```bash
npm run typecheck
npm run test:storage
npm run ui:check
npm run release:check -- <version>
```

`npm run ui:check` captures a mobile layout screenshot when Chrome or Chromium is available.

## Release

1. Update `manifest.json`, `package.json`, and `versions.json`.
2. Run all checks.
3. Push changes to GitHub.
4. Push a Git tag matching the manifest version.
5. GitHub Actions creates a release with:
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. Confirm the release assets and artifact attestations.
