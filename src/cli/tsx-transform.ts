#!/usr/bin/env node

// Globals
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

// @ts-ignore
import packageJson from '../../package.json' assert { type: 'json' };
import { defineCommand, runMain } from 'citty';

import { Logger } from '../utils/logger.js';
import {
  generateJavascriptFiles,
  transformFile,
  computeOutPath,
  isTsSource,
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

function removeDistArtifacts(params: {
  srcPath: string;
  srcDir: string;
  outDir: string;
}) {
  const rel = path.relative(params.srcDir, params.srcPath);
  if (isTsSource(params.srcPath)) {
    const tsExt = params.srcPath.endsWith('.tsx') ? '.tsx' : '.ts';
    const jsExt = tsExt === '.tsx' ? '.jsx' : '.js';
    const baseOut = path
      .join(params.outDir, rel)
      .slice(0, -tsExt.length);
    const candidates = [
      `${baseOut}${jsExt}`,
      `${baseOut}.d.ts`,
      `${baseOut}.d.ts.map`,
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } else {
    const outPath = path.join(params.outDir, rel);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
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
      Logger.Info(
        `Transformed ${path.relative(params.srcDir, srcPath)}`
      );
    } catch (error) {
      Logger.Error(
        `Failed to process ${path.relative(params.srcDir, srcPath)}: ${error}`
      );
    }
  }

  function onUnlink(srcPath: string) {
    try {
      removeDistArtifacts({
        srcPath,
        srcDir: params.srcDir,
        outDir: params.outDir,
      });
      Logger.Info(
        `Removed dist artifacts for ${path.relative(params.srcDir, srcPath)}`
      );
    } catch (error) {
      Logger.Error(
        `Failed to clean up ${path.relative(params.srcDir, srcPath)}: ${error}`
      );
    }
  }

  chokidar
    .watch(params.srcDir, { ignoreInitial: true })
    .on('add', (srcPath) => {
      onUpsert(srcPath);
      if (isTsSource(srcPath)) typesWatcher.addFile(srcPath);
    })
    .on('change', (srcPath) => {
      onUpsert(srcPath);
      // TS watch program re-emits .d.ts on its own.
    })
    .on('unlink', (srcPath) => {
      onUnlink(srcPath);
      if (isTsSource(srcPath)) typesWatcher.removeFile(srcPath);
    });

  Logger.Info(`Watching ${params.srcDir} for changes...`);
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
    const outDir = args.dist ?? path.resolve(srcDir, '../dist');

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
