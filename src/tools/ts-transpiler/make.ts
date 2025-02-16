#!/usr/bin/env node

// Globals
import { transformSync } from '@babel/core';
import { execSync } from 'child_process';
import path from 'path';
import fs, { read } from 'fs';
import chokidar from 'chokidar';
import yoctoSpinner from 'yocto-spinner';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ts from 'typescript';

import { Logger } from '../../utils/logger.js';
import { debounce } from '../../utils/debounce.js';
import packageJson from '../../../package.json' assert { type: 'json' };

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transpile a single TypeScript file using Babel (in-memory)
 * @param srcPath - Source file path
 * @param outPath - Output file path
 */
function transpileFile(srcPath: string, outPath: string) {
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
 * @param outDir - The output directory for transpiled files
 */
function transpileDirectory(srcDir: string, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });

  fs.readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(srcDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      transpileDirectory(srcPath, outPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      transpileFile(srcPath, outPath);
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

  const spinner = yoctoSpinner({
    spinner: { interval: 125, frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'] },
    text: chalk.blue(`Generating .d.ts files`),
  }).start();

  const result = program.emit();
  if (result.diagnostics.length === 0) {
    spinner.success(chalk.green('Generated .d.ts files'));
  } else {
    spinner.error(chalk.red('Failed to generate .d.ts files'));
    Logger.Error(`Error generating declaration files:, ${result.diagnostics}`);
  }
}

/**
 * Wrapper function for calling all the steps in transformation
 * @param srcDir - directory which needs to be transformed
 * @param outDir - output directory
 */
function startTransformation(srcDir: string, outDir: string) {
  try {
    // Step 1. -> Transform Typescript to Javascript and copy all assets files
    transpileDirectory(srcDir, outDir);
    // transformToJavascript(srcDir, outDir);

    // Step 2. -> Generate Type declaration files
    // generateDeclaration(srcDir, outDir);
    // measureExecutionTime('Generating .d.ts', () =>
    generateDeclarationsNatively(srcDir, outDir);
    // );

    // Step 3. -> Rename js to jsx for better HMR support during development
    // renameToJSX(outDir);
  } catch (error) {
    Logger.Error(`Error building package:, ${error}`);
    process.exit(1);
  }
}

function main() {
  // Get directory argument
  const args = process.argv.slice(2);

  if (args.length === 0) {
    Logger.Error('Usage: tsx-transpile <src-dir>');
    process.exit(1);
  }

  if (args.includes('--version')) {
    Logger.Info(`TSX Transpiler v${packageJson.version}`);
    process.exit(0);
  }

  const srcDir = path.resolve(args[0]);
  const outDir = path.resolve(srcDir, '../dist');

  // Ensure source directory exists
  if (!fs.existsSync(srcDir)) {
    Logger.Error(`Error: Source directory "${srcDir}" does not exist.`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  if (args.includes('--clean')) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (args.includes('--watch')) {
    const debouncedTransformation = debounce(() => {
      startTransformation(srcDir, outDir);
    }, 500);

    chokidar.watch(srcDir, { ignoreInitial: true }).on('all', () => {
      Logger.Info('🔄 Detected changes, rebuilding...');
      debouncedTransformation();
    });
  }

  startTransformation(srcDir, outDir);
}

main();
