#!/usr/bin/env node

// Globals
import { transformSync } from '@babel/core';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import yoctoSpinner from 'yocto-spinner';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ts from 'typescript';

import { Logger } from '../../utils/logger.js';
import { debounce } from '../../utils/debounce.js';
import packageJson from '../../../package.json' assert { type: 'json' };
import { defineCommand, runMain } from 'citty';

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transform a single TypeScript file using Babel (in-memory)
 * @param srcPath - Source file path
 * @param outPath - Output file path
 */
function transformFile(srcPath: string, outPath: string) {
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = transformSync(code, {
    filename: srcPath,
    configFile: path.resolve(__dirname, '../../../babel.config.json'),
  });

  if (result?.code) {
    fs.writeFileSync(
      outPath.replace('.tsx', '.jsx').replace('.ts', '.js'),
      result.code,
      'utf8'
    );
  }
}

/**
 * Recursively process all `.ts` and `.tsx` files in a directory
 * @param srcDir - The directory containing TypeScript files
 * @param outDir - The output directory for transformed files
 */
function transformDirectory(srcDir: string, outDir: string) {
  // ! Don't remove this, this will create the nested directory
  fs.mkdirSync(outDir, { recursive: true });
  fs.readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(srcDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      transformDirectory(srcPath, outPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      transformFile(srcPath, outPath);
    } else {
      // Copy asset files as-is
      fs.copyFileSync(srcPath, outPath);
    }
  });
}

function getAllTsFiles(srcDir: string): string[] {
  let results: string[] = [];

  fs.readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(srcDir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(getAllTsFiles(srcPath)); // Recursive call
    } else if (srcPath.endsWith('.ts') || srcPath.endsWith('.tsx')) {
      results.push(srcPath);
    }
  });

  return results;
}

/**
 * Generate TypeScript declaration files in-memory
 * @param srcDir - The path of the directory for which we need to generate .d.ts
 * @param outDir - Path where to output the generated declarations
 */
function generateDeclarationsNatively(srcDir: string, outDir: string) {
  const files = getAllTsFiles(srcDir);

  const program = ts.createProgram(files, {
    outDir: outDir,
    strict: true,
    esModuleInterop: true,
    declaration: true,
    declarationMap: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    rootDir: srcDir,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
  });

  const result = program.emit();

  if (result.diagnostics.length !== 0) {
    Logger.Error(`Error generating declaration files:, ${result.diagnostics}`);
  }
}

/**
 * Wrapper function for calling all the steps in transformation
 * @param srcDir - directory which needs to be transformed
 * @param outDir - output directory
 */
async function startTransformation(srcDir: string, outDir: string) {
  const spinner = yoctoSpinner({
    spinner: { interval: 60, frames: ['🌕 ', '🌗 ', '🌑 '] },
    text: chalk.blue('🐬 Transformation started!'),
  }).start();

  try {
    // Step 1. -> Transform Typescript to Javascript and copy all assets files
    await Promise.all([
      transformDirectory(srcDir, outDir),
      generateDeclarationsNatively(srcDir, outDir),
    ]);

    spinner.success('🦄 Transformation completed!');
    // Step 2. -> Generate Type declaration files
  } catch (error) {
    //If process has failed clean out the build directory
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    spinner.error('🐛 Transformation failed!');
    Logger.Error(`Error building package:, ${error}`);
    process.exit(1);
  }
}

const cli = defineCommand({
  meta: {
    name: 'tsx:transform',
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

    startTransformation(srcDir, outDir);

    if (args.watch) {
      const debouncedTransformation = debounce(() => {
        startTransformation(srcDir, outDir);
      }, 500);

      chokidar.watch(srcDir, { ignoreInitial: true }).on('all', () => {
        Logger.Info('🔄 Detected changes, rebuilding...');
        debouncedTransformation();
      });
    }
  },
});

runMain(cli);
