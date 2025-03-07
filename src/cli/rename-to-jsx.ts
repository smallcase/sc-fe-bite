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
import yoctoSpinner from 'yocto-spinner';
import chalk from 'chalk';
import { renameToJSX } from '../tools/js-to-jsx/make.js';

/**
 * Wrapper function for calling all the steps in transformation
 * @param srcDir - directory which needs to be transformed
 * @param outDir - output directory
 */
async function startTransformation(params: { srcDir: string; witty: boolean }) {
  const spinner = yoctoSpinner({
    spinner: { interval: 60, frames: ['🌕 ', '🌗 ', '🌑 '] },
    text: chalk.blue(
      params.witty ? "🐬 Don't Panic, Too late" : '🐬 Transformation started!'
    ),
  }).start();

  try {
    renameToJSX(params.srcDir);

    spinner.success(
      params.witty
        ? '🦄 Generated Mostly Harmless JSX files'
        : '🦄 Transformation completed!'
    );
  } catch (error) {
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
    name: 'rename-to-jsx',
    description: 'A CLI to rename JS files containing jsx to .JSX',
    version: packageJson.version,
  },
  args: {
    src: {
      type: 'string',
      description: 'Path to the source directory',
      required: true,
    },
    watch: {
      type: 'boolean',
      description: 'Enable watch mode',
      alias: 'w',
    },
    version: {
      type: 'boolean',
      description: 'Show the CLI version',
    },
    witty: {
      type: 'boolean',
      description: 'Try it out!',
    },
  },
  async run({ args }) {
    const srcDir = path.resolve(args.src);

    if (!fs.existsSync(srcDir)) {
      Logger.Error(`Error: Source directory "${srcDir}" does not exist.`);
      process.exit(1);
    }

    startTransformation({ srcDir, witty: args.witty });

    if (args.watch) {
      const debouncedTransformation = debounce(() => {
        startTransformation({ srcDir, witty: args.witty });
      }, 500);

      chokidar.watch(srcDir, { ignoreInitial: true }).on('all', () => {
        Logger.Info('🔄 Detected changes, rebuilding...');
        debouncedTransformation();
      });
    }
  },
});

runMain(cli);
