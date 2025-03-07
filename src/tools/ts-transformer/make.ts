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

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transform a single TypeScript file using Babel (in-memory)
 * @param srcPath - Source file path
 * @param outPath - Output file path
 */
function transformFile(params: {
  srcPath: string;
  outPath: string;
  babelConfig?: string;
}) {
  const code = fs.readFileSync(params.srcPath, 'utf8');

  const result = transformSync(code, {
    filename: params.srcPath,
    configFile:
      params.babelConfig ??
      path.resolve(__dirname, '../../../babel.config.json'),
  });

  if (result?.code) {
    fs.writeFileSync(
      params.outPath.replace('.tsx', '.jsx').replace('.ts', '.js'),
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
function transformDirectory(params: {
  srcDir: string;
  outDir: string;
  babelConfig?: string;
}) {
  // ! Don't remove this, this will create the nested directory
  fs.mkdirSync(params.outDir, { recursive: true });
  fs.readdirSync(params.srcDir, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(params.srcDir, entry.name);
    const outPath = path.join(params.outDir, entry.name);

    if (entry.isDirectory()) {
      transformDirectory({
        srcDir: srcPath,
        outDir: outPath,
        babelConfig: params.babelConfig,
      });
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      transformFile({
        srcPath,
        outPath,
        babelConfig: params.babelConfig,
      });
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
function generateDeclarationsNatively(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
}) {
  const files = getAllTsFiles(params.srcDir);

  let compilerOptions: ts.CompilerOptions = {
    outDir: params.outDir,
    strict: true,
    esModuleInterop: true,
    declaration: true,
    declarationMap: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    rootDir: params.srcDir,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
  };

  if (params.tsConfig && fs.existsSync(params.tsConfig)) {
    compilerOptions = JSON.parse(
      fs.readFileSync(params.tsConfig, 'utf8')
    ).compilerOptions;
  }

  const program = ts.createProgram(files, {
    ...compilerOptions,
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
      transformDirectory({
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

export { startTransformation };
