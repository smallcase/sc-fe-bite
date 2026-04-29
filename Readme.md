# BITE

`bite` is a CLI tool designed to transform TypeScript (`.ts` & `.tsx`) files into JavaScript using Babel while also generating TypeScript declaration files (`.d.ts`). It supports monorepos, watch mode, caching, and optimized TypeScript compilation.

## Features

- Transforms `.ts` and `.tsx` files to `.js` and `.jsx` using `Babel`
- Generates TypeScript declaration files (`.d.ts`)
- Supports a custom Babel and TypeScript configuration
- Watch mode for automatic re-transpilation on file changes
- Cleans the output directory before transpiling (optional)
- Works seamlessly within a monorepo setup
- Lightweight and fast with debounced file watching
- Includes a "witty" mode for fun logging messages

## Installation

```sh
npm install @smallcase/bite
```

## Usage

### Basic Command

```sh
bite-tsx-transform --src ./lib --dist ./dist
```

### Options

| Option          | Alias | Type    | Description                                     | Required |
| --------------- | ----- | ------- | ----------------------------------------------- | -------- |
| `--src`         |       | string  | Path to the source directory (default: `src/`)  | ❌ No    |
| `--dist`        |       | string  | Path to the output directory (default: `dist/`) | ❌ No    |
| `--watch`       | `-w`  | boolean | Enables watch mode                              | ❌ No    |
| `--clean`       |       | boolean | Cleans the output directory before transpiling  | ❌ No    |
| `--tsConfig`    |       | string  | Path to custom `tsconfig.json`                  | ❌ No    |
| `--babelConfig` |       | string  | Path to custom `babel.config.json`              | ❌ No    |
| `--version`     |       | boolean | Show CLI version                                | ❌ No    |
| `--witty`       |       | boolean | Enables witty logging messages                  | ❌ No    |

## Examples

### Transform TypeScript Files

```sh
bite-tsx-transform  --src ./src --dist ./build
```

### Transform and Watch for Changes

```sh
bite-tsx-transform  --src ./src --dist ./build --watch
```

### Clean Output Directory Before Transpiling

```sh
bite-tsx-transform --src ./src --dist ./build --clean
```

### Use Custom TypeScript Config

```sh
bite-tsx-transform  --src ./lib --dist ./build --tsConfig ./tsconfig.custom.json
```

### Use Custom Babel Config

```sh
bite-tsx-transform --src ./lib --dist ./build --babelConfig ./babel.custom.json
```

### Enable Witty Logging

```sh
bite-tsx-transform  --src ./lib --dist ./build --witty
```

## Workspace-root ambient declarations

Bite walks up from the source directory looking for a workspace-root marker (`lerna.json`, `pnpm-workspace.yaml`, or a `package.json` with a `workspaces` field). If one is found, any `*.d.ts` files sitting at that root (e.g. `module.d.ts` declaring `*.module.css`, `*.svg`, `*.png`, etc.) are automatically included in every package's TypeScript program.

This means a single root-level `module.d.ts` covers every package in the workspace — you don't need to symlink it into each `packages/*/src/`. Package-local `*.d.ts` files (under each package's `src/`) are still picked up as before; the two sets are merged in the program (TS treats `declare module` blocks additively). Files are deduped by `realpath`, so a symlink-into-`src/` of the same root file doesn't enter the program twice.

## Excluded source files

Bite skips a few classes of source files entirely — they are neither transpiled to `dist/` nor included in the TypeScript program:

- `*.stories.{ts,tsx,js,jsx,mjs,cjs}`
- `*.test.{ts,tsx,js,jsx,mjs,cjs}`
- `*.spec.{ts,tsx,js,jsx,mjs,cjs}`
- anything inside a `__tests__/` directory
- anything inside a `__snapshots__/` directory

These are dev-only files that consumers of the published package should never import. Excluding them keeps `dist/` clean and prevents a recurring footgun: stories or tests that import the package's own public name (e.g. `import { Foo } from '@smallcase/components'` from inside the components package) drag the package's own `dist/*.d.ts` back into the TypeScript program through workspace symlinks, producing TS5055 emit failures or noisy diagnostics.

## Watch Mode

When using `--watch`, the CLI monitors the source directory and processes changes **incrementally — per file**:

- On **edit** (`change`) of a `.ts`/`.tsx`, only that file is re-transpiled via Babel and written to `dist/`. A persistent `ts.createWatchProgram` instance re-emits the corresponding `.d.ts` (and `.d.ts.map`) for just the files it considers affected.
- On **add** of a `.ts`/`.tsx`, the file is transpiled and TypeScript's watch program is updated with the new root file.
- On **delete** (`unlink`) of a `.ts`/`.tsx`, the matching `.jsx`/`.js`, `.d.ts`, and `.d.ts.map` artifacts in `dist/` are removed.
- Non-TS files (assets) are copied/removed in the same way.

Type errors are logged but **do not crash the watcher or wipe `dist/`** — fix and save to continue. If the **initial** (non-watch) build fails, the CLI still cleans the output directory and exits non-zero, matching the previous behavior.

## Logging & Error Handling

- Uses `Logger` for structured logging.
- Displays errors clearly in case of transformation failure.
- Cleans the output directory if transformation fails.
- Supports an optional witty logging mode (`--witty`) for fun messages.

## License

MIT License.

**NOTE** - The old command `tsx-transform` has been deprecated and will be removed in next major version
