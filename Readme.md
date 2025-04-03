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

## Watch Mode

When using `--watch`, the CLI will monitor the source directory for changes and automatically recompile files when modifications are detected. The file-watching is debounced to prevent excessive rebuilds.

## Logging & Error Handling

- Uses `Logger` for structured logging.
- Displays errors clearly in case of transformation failure.
- Cleans the output directory if transformation fails.
- Supports an optional witty logging mode (`--witty`) for fun messages.

## License

MIT License.

**NOTE** - The old command `tsx-transform` has been deprecated and will be removed in next major version
