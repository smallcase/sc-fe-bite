#!/usr/bin/env node

// Globals
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';

import { debounce } from '../utils/debounce.js';
import packageJson from '../../package.json' with { type: 'json' };
import { defineCommand, runMain } from 'citty';

import { Logger } from '../utils/logger.js';
import { startTransformation } from '../tools/ts-transformer/make.js';


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
      required: true,
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

      // HACK TO MAKE STORYBOOK AND WATCH MODE WORK => Figure out later to use with concurrently
      // process.exit(0);
    }
  },
});

runMain(cli);
