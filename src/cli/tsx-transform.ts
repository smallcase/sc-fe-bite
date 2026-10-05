#!/usr/bin/env node

// Globals
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

// @ts-ignore
import packageJson from '../../package.json' with { type: 'json' };
import { defineCommand, parseArgs, runMain, type ArgsDef } from 'citty';

import { Logger } from '../utils/logger.js';
import { isExcludedSource } from '../utils/exclude.js';
import {
  readBuildConfig,
  isWithin,
  resolveBuildPath,
} from '../utils/build-config.js';
import { findWorkspacePackages } from '../utils/workspace.js';
import {
  generateJavascriptFiles,
  transformFile,
  computeOutPath,
  isTsSource,
  isTypeInput,
  getOutputPaths,
  validateOutputs,
  hasStaleDeclarations,
} from '../tools/ts-transformer/make.js';
import {
  generateDeclarationsNatively,
  startTypesWatcher,
  type TypesWatcher,
} from '../tools/types-generator/make.js';
import yoctoSpinner from 'yocto-spinner';
import chalk from 'chalk';

async function runInitialBuild(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
  babelConfig?: string;
  witty?: boolean;
  // In watch mode, skip the full declarations pass — the watch
  // program's own initial emit covers it (and then handles
  // incremental updates for each edit).
  skipDeclarations?: boolean;
  onlyStale?: boolean;
  label?: string;
}) {
  // One process watches many packages with --workspace; skip the spinner.
  const spinner = params.label
    ? undefined
    : yoctoSpinner({
        spinner: { interval: 60, frames: ['🌕 ', '🌗 ', '🌑 '] },
        text: chalk.blue(
          params.witty
            ? "🐬 Don't Panic, Too late"
            : '🐬 Transformation started!'
        ),
      }).start();

  try {
    generateJavascriptFiles({
      srcDir: params.srcDir,
      outDir: params.outDir,
      babelConfig: params.babelConfig,
      tsConfig: params.tsConfig,
      onlyStale: params.onlyStale,
    });
    if (!params.skipDeclarations) {
      generateDeclarationsNatively({
        srcDir: params.srcDir,
        outDir: params.outDir,
        tsConfig: params.tsConfig,
      });
    }

    spinner?.success(
      params.witty
        ? '🦄 Generated Mostly Harmless JS files'
        : '🦄 Transformation completed!'
    );
  } catch (error) {
    spinner?.error(
      params.witty
        ? '🦄 What the photon did you just wrote ?'
        : '🐛 Transformation failed!'
    );
    throw error;
  }
}

function startIncrementalWatchers(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
  babelConfig?: string;
  label?: string;
}) {
  const tag = labelPrefix(params.label);
  // A TS watch program loads the package plus every imported/@types file and
  // watches all of them. Start it on the package's first edit, so idle
  // packages in a monorepo-wide watch cost just a chokidar watcher.
  // ponytail: programs stay alive once started; close idle ones if memory matters.
  let typesWatcher: TypesWatcher | undefined;
  const types = () => (typesWatcher ??= startTypesWatcher(params));

  function onUpsert(srcPath: string) {
    try {
      if (isTsSource(srcPath)) {
        transformFile({
          srcPath,
          outPath: computeOutPath(srcPath, params.srcDir, params.outDir),
          babelConfig: params.babelConfig,
        });
      } else {
        const outPath = path.join(
          params.outDir,
          path.relative(params.srcDir, srcPath)
        );
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.copyFileSync(srcPath, outPath);
      }
      Logger.Info(`${tag}Transformed ${path.relative(params.srcDir, srcPath)}`);
    } catch (error) {
      Logger.Error(
        `${tag}Failed to process ${path.relative(params.srcDir, srcPath)}: ${error}`
      );
    }
  }

  // Batch rename events so deleting foo.js cannot delete the new foo.ts output.
  // Keep rejected events pending; the next edit can resolve a collision.
  const pending = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  function flush() {
    try {
      const ownedOutputs = validateOutputs(
        params.srcDir,
        params.outDir,
        params.tsConfig
      );
      const selected = new Set(readBuildConfig(params).sourceFiles);
      for (const srcPath of pending) {
        if (fs.existsSync(srcPath) && !selected.has(srcPath)) continue;
        if (fs.existsSync(srcPath)) {
          onUpsert(srcPath);
          if (isTypeInput(srcPath) || /\.jsx?$/.test(srcPath))
            types().addFile(srcPath);
        } else {
          for (const output of getOutputPaths(
            srcPath,
            params.srcDir,
            params.outDir
          )) {
            if (!ownedOutputs.has(output)) fs.rmSync(output, { force: true });
          }
          if (isTypeInput(srcPath) || /\.jsx?$/.test(srcPath))
            types().removeFile(srcPath);
        }
      }
      pending.clear();
    } catch (error) {
      Logger.Error(`${tag}Failed to update package: ${error}`);
    }
  }

  chokidar
    .watch(params.srcDir, {
      ignoreInitial: true,
      ignored: (file) =>
        isWithin(params.outDir, file) ||
        file
          .split(path.sep)
          .some((part) => part === 'node_modules' || part === '.git'),
    })
    .on('ready', () =>
      Logger.Info(`${tag}Watching ${params.srcDir} for changes...`)
    )
    .on('all', (event, srcPath) => {
      if (
        !['add', 'change', 'unlink'].includes(event) ||
        isExcludedSource(srcPath)
      )
        return;
      pending.add(srcPath);
      clearTimeout(timer);
      timer = setTimeout(flush, 100);
    });
}

const args = {
  src: {
    type: 'string',
    description: 'Path to the source directory',
    required: false,
    default: 'src',
  },
  dist: {
    type: 'string',
    description: 'Path to dist directory',
  },
  watch: {
    type: 'boolean',
    description: 'Enable watch mode',
    alias: 'w',
  },
  clean: {
    type: 'boolean',
    description: 'Clean the output directory before transpiling',
  },
  version: {
    type: 'boolean',
    description: 'Show the CLI version',
  },
  tsConfig: {
    type: 'string',
    description: 'Path to custom ts config',
  },
  babelConfig: {
    type: 'string',
    description: 'Path to custom babel config',
  },
  witty: {
    type: 'boolean',
    description: 'Try it out!',
  },
  workspace: {
    type: 'boolean',
    description:
      "With --watch at a workspace root: watch every package whose build:watch runs this CLI, using that script's arguments, in one process",
  },
} as const satisfies ArgsDef;

type PackageOptions = {
  src: string;
  dist?: string;
  watch?: boolean;
  clean?: boolean;
  tsConfig?: string;
  babelConfig?: string;
  witty?: boolean;
};

function labelPrefix(label?: string) {
  return label ? chalk.dim(`[${label}] `) : '';
}

/** Build one package, then watch it with --watch. Paths are relative to baseDir. */
async function runPackage(
  options: PackageOptions,
  baseDir: string,
  label?: string
) {
  const resolve = (file?: string) => file && path.resolve(baseDir, file);
  const srcDir = resolveBuildPath(resolve(options.src)!);
  const outDir = resolveBuildPath(
    resolve(options.dist) ?? path.resolve(srcDir, '../dist')
  );
  const tsConfig = resolve(options.tsConfig);
  const babelConfig = resolve(options.babelConfig);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory "${srcDir}" does not exist.`);
  }

  // Validate configuration and directory boundaries before any cleanup.
  readBuildConfig({ srcDir, outDir, tsConfig });

  if (options.clean) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    await runInitialBuild({
      srcDir,
      outDir,
      babelConfig,
      tsConfig,
      witty: options.witty,
      label,
      // Watch mode starts the TS watch program on the first edit, so only
      // stale declarations are emitted up front, in a one-off program that
      // is released afterwards.
      skipDeclarations:
        options.watch && !hasStaleDeclarations({ srcDir, outDir, tsConfig }),
      // Outputs newer than their sources are left alone on watch startup.
      onlyStale: options.watch,
    });
  } catch (error) {
    if (!options.watch) {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      throw error;
    }
    Logger.Error(`${labelPrefix(label)}Error building package: ${error}`);
    Logger.Warning(
      `${labelPrefix(label)}Initial build failed. Watch mode is active — fix the error and save to retry.`
    );
  }

  if (options.watch) {
    startIncrementalWatchers({ srcDir, outDir, babelConfig, tsConfig, label });
  }
}

// The bite command and its arguments within a package script.
const BITE_COMMAND = /(?:^|[\s;&|(])(?:bite-)?tsx-transform\b([^;&|)]*)/;

/**
 * Watch every workspace package in this process. One process shares one
 * inotify instance and one copy of TypeScript and Babel; a process per
 * package exhausts fs.inotify.max_user_instances (EMFILE) in large repos.
 */
async function runWorkspace(root: string) {
  let watched = 0;
  for (const dir of findWorkspacePackages(root)) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    );
    const match = BITE_COMMAND.exec(pkg.scripts?.['build:watch'] ?? '');
    if (!match) continue;
    const label = path.basename(dir);
    try {
      const options = parseArgs<typeof args>(
        match[1].trim().split(/\s+/).filter(Boolean),
        args
      );
      await runPackage({ ...options, watch: true }, dir, label);
      watched++;
    } catch (error) {
      Logger.Error(`${labelPrefix(label)}${error}`);
    }
  }
  Logger.Info(`Watching ${watched} packages for changes...`);
}

const cli = defineCommand({
  meta: {
    name: 'tsx-transform',
    description: 'A CLI to transform TypeScript/TSX files to JavaScript.',
    version: packageJson.version,
  },
  args,
  async run({ args }) {
    if (args.workspace) {
      if (!args.watch) {
        Logger.Error('--workspace is only supported with --watch.');
        process.exit(1);
      }
      await runWorkspace(process.cwd());
      return;
    }
    try {
      await runPackage(args, process.cwd());
    } catch (error) {
      Logger.Error(`Error building package: ${error}`);
      process.exit(1);
    }
  },
});

runMain(cli);
