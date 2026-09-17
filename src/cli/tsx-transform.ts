#!/usr/bin/env node

// Globals
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

// @ts-ignore
import packageJson from '../../package.json' with { type: 'json' };
import { defineCommand, runMain } from 'citty';

import { Logger } from '../utils/logger.js';
import { isExcludedSource } from '../utils/exclude.js';
import {
  generateJavascriptFiles,
  transformFile,
  computeOutPath,
  isTsSource,
  isTypeInput,
  getOutputPaths,
  validateOutputs,
} from '../tools/ts-transformer/make.js';
import {
  generateDeclarationsNatively,
  startTypesWatcher,
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
}) {
  const spinner = yoctoSpinner({
    spinner: { interval: 60, frames: ['🌕 ', '🌗 ', '🌑 '] },
    text: chalk.blue(
      params.witty ? "🐬 Don't Panic, Too late" : '🐬 Transformation started!'
    ),
  }).start();

  try {
    generateJavascriptFiles({
      srcDir: params.srcDir,
      outDir: params.outDir,
      babelConfig: params.babelConfig,
    });
    if (!params.skipDeclarations) {
      generateDeclarationsNatively({
        srcDir: params.srcDir,
        outDir: params.outDir,
        tsConfig: params.tsConfig,
      });
    }

    spinner.success(
      params.witty
        ? '🦄 Generated Mostly Harmless JS files'
        : '🦄 Transformation completed!'
    );
  } catch (error) {
    spinner.error(
      params.witty
        ? '🦄 What the photon did you just wrote ?'
        : '🐛 Transformation failed!'
    );
    Logger.Error(`Error building package:, ${error}`);
    throw error;
  }
}

function startIncrementalWatchers(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
  babelConfig?: string;
}) {
  const typesWatcher = startTypesWatcher({
    srcDir: params.srcDir,
    outDir: params.outDir,
    tsConfig: params.tsConfig,
  });

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
      Logger.Info(`Transformed ${path.relative(params.srcDir, srcPath)}`);
    } catch (error) {
      Logger.Error(
        `Failed to process ${path.relative(params.srcDir, srcPath)}: ${error}`
      );
    }
  }

  // Batch rename events so deleting foo.js cannot delete the new foo.ts output.
  // Keep rejected events pending; the next edit can resolve a collision.
  const pending = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  function flush() {
    try {
      const ownedOutputs = validateOutputs(params.srcDir, params.outDir);
      for (const srcPath of pending) {
        if (fs.existsSync(srcPath)) {
          onUpsert(srcPath);
          if (isTypeInput(srcPath)) typesWatcher.addFile(srcPath);
        } else {
          for (const output of getOutputPaths(
            srcPath,
            params.srcDir,
            params.outDir
          )) {
            if (!ownedOutputs.has(output)) fs.rmSync(output, { force: true });
          }
          if (isTypeInput(srcPath)) typesWatcher.removeFile(srcPath);
        }
      }
      pending.clear();
    } catch (error) {
      Logger.Error(`Failed to update package: ${error}`);
    }
  }

  chokidar
    .watch(params.srcDir, { ignoreInitial: true })
    .on('ready', () => Logger.Info(`Watching ${params.srcDir} for changes...`))
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

const cli = defineCommand({
  meta: {
    name: 'tsx-transform',
    description: 'A CLI to transform TypeScript/TSX files to JavaScript.',
    version: packageJson.version,
  },
  args: {
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
  },
  async run({ args }) {
    const srcDir = path.resolve(args.src);
    const outDir = path.resolve(args.dist ?? path.resolve(srcDir, '../dist'));

    if (!fs.existsSync(srcDir)) {
      Logger.Error(`Error: Source directory "${srcDir}" does not exist.`);
      process.exit(1);
    }

    if (args.clean) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    try {
      await runInitialBuild({
        srcDir,
        outDir,
        babelConfig: args.babelConfig,
        tsConfig: args.tsConfig,
        witty: args.witty,
        // In watch mode, the TS watch program emits .d.ts on its own
        // initial pass, so the eager full-program pass would be
        // redundant double work.
        skipDeclarations: args.watch,
      });
    } catch (error) {
      if (args.watch) {
        Logger.Warning(
          'Initial build failed. Watch mode is active — fix the error and save to retry.'
        );
      } else {
        if (fs.existsSync(outDir)) {
          fs.rmSync(outDir, { recursive: true, force: true });
        }
        process.exit(1);
      }
    }

    if (args.watch) {
      startIncrementalWatchers({
        srcDir,
        outDir,
        babelConfig: args.babelConfig,
        tsConfig: args.tsConfig,
      });
    }
  },
});

runMain(cli);
