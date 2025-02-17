# TSX-Transform

`tsx-transform` is a CLI tool designed to transpile TypeScript (`.ts` & `.tsx`) files into JavaScript using Babel while also generating TypeScript declaration files (`.d.ts`). It supports monorepos, watch mode, caching, and optimized TypeScript compilation.

## Features

- Transforms `.ts` and `.tsx` files to `.js` and `.jsx` using Babel
- Generates TypeScript declaration files (`.d.ts`)
- Supports a custom Babel and TypeScript configuration
- Watch mode for automatic re-transpilation on file changes
- Cleans the output directory before transpiling (optional)
- Works seamlessly within a monorepo setup
- Lightweight and fast with debounced file watching

## Installation

```sh
npm install -g tsx-transform
```

## Usage

### Basic Command

```sh
tsx-transform --src ./src --dist ./dist
```

### Options

| Option          | Alias | Type    | Description                                     | Required |
| --------------- | ----- | ------- | ----------------------------------------------- | -------- |
| `--src`         |       | string  | Path to the source directory                    | ✅ Yes   |
| `--dist`        |       | string  | Path to the output directory (default: `dist/`) | ❌ No    |
| `--watch`       | `-w`  | boolean | Enables watch mode                              | ❌ No    |
| `--clean`       |       | boolean | Cleans the output directory before transpiling  | ❌ No    |
| `--tsConfig`    |       | string  | Path to custom `tsconfig.json`                  | ❌ No    |
| `--babelConfig` |       | string  | Path to custom `babel.config.json`              | ❌ No    |
| `--version`     |       | boolean | Show CLI version                                | ❌ No    |

## Examples

### Transform TypeScript Files

```sh
tsx-transform --src ./src --dist ./build
```

### Transform and Watch for Changes

```sh
tsx-transform --src ./src --dist ./build --watch
```

### Clean Output Directory Before Transpiling

```sh
tsx-transform --src ./src --dist ./build --clean
```

### Use Custom TypeScript Config

```sh
tsx-transform --src ./src --dist ./build --tsConfig ./tsconfig.custom.json
```

### Use Custom Babel Config

```sh
tsx-transform --src ./src --dist ./build --babelConfig ./babel.custom.json
```

## Watch Mode

When using `--watch`, the CLI will monitor the source directory for changes and automatically recompile files when modifications are detected.

## Logging & Error Handling

- Uses `Logger` for structured logging.
- Displays errors clearly in case of transformation failure.
- Cleans the output directory if transformation fails.

## License

MIT License.
