#!/usr/bin/env node

// Globals
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

import { debounce } from '../utils/debounce.js';
// @ts-ignore
import packageJson from '../../package.json' assert { type: 'json' };
import { defineCommand, runMain } from 'citty';

import { Logger } from '../utils/logger.js';
import { generateJavascriptFiles } from '../tools/ts-transformer/make.js';
import { generateDeclarationsNatively } from '../tools/types-generator/make.js';
import yoctoSpinner from 'yocto-spinner';
import chalk from 'chalk';

/**
 * Wrapper function for calling all the steps in transformation
 * @param srcDir - directory which needs to be transformed
 * @param outDir - output directory
 */
async function startTransformation(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
  babelConfig?: string;
  witty: boolean;
}) {
  const spinner = yoctoSpinner({
    spinner: { interval: 60, frames: ['🌕 ', '🌗 ', '🌑 '] },
    text: chalk.blue(
      params.witty ? "🐬 Don't Panic, Too late" : '🐬 Transformation started!'
    ),
  }).start();

  try {
    // Step 1. -> Transform Typescript to Javascript and copy all assets files
    await Promise.all([
      generateJavascriptFiles({
        srcDir: params.srcDir,
        outDir: params.outDir,
        babelConfig: params.babelConfig,
      }),
      generateDeclarationsNatively({
        srcDir: params.srcDir,
        outDir: params.outDir,
        tsConfig: params.tsConfig,
      }),
    ]);

    spinner.success(
      params.witty
        ? '🦄 Generated Mostly Harmless JS files'
        : '🦄 Transformation completed!'
    );
    // Step 2. -> Generate Type declaration files
  } catch (error) {
    //If process has failed clean out the build directory
    if (fs.existsSync(params.outDir)) {
      fs.rmSync(params.outDir, { recursive: true, force: true });
    }

    spinner.error(
      params.witty
        ? '🦄 What the photon did you just wrote ?'
        : '🐛 Transformation failed!'
    );
    Logger.Error(`Error building package:, ${error}`);
    process.exit(1);
  }
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

    startTransformation({
      srcDir,
      outDir,
      babelConfig: args.babelConfig,
      tsConfig: args.tsConfig,
      witty: args.witty,
    });

    if (args.watch) {
      const debouncedTransformation = debounce(() => {
        startTransformation({
          srcDir,
          outDir,
          babelConfig: args.babelConfig,
          tsConfig: args.tsConfig,
          witty: args.witty,
        });
      }, 500);

      chokidar.watch(srcDir, { ignoreInitial: true }).on('all', () => {
        Logger.Info('🔄 Detected changes, rebuilding...');
        debouncedTransformation();
      });
    }
  },
});

runMain(cli);
