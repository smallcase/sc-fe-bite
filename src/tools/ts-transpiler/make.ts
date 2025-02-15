#!/usr/bin/env node

// Globals
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import yoctoSpinner from 'yocto-spinner';

// Internal modules
import { renameToJSX } from '../js-to-jsx/make.js';
import { Logger } from '../../utils/logger.js';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * function to generate the declaration files for a given folder
 * @param srcDir - the path of the directory for which we need to generate .d.ts
 * @param outDir - path where to output the generated declarations
 */
function generateDeclaration(srcDir: string, outDir: string) {
  const packageRoot = path.dirname(srcDir);
  const packageTsConfig = path.resolve(packageRoot, 'tsconfig.json');
  const globalPackageConfig = path.resolve(
    __dirname,
    '../tsconfig.package.json'
  );

  // Base Ts File which will be copied over to package
  const tsconfigContent = JSON.stringify(
    {
      compilerOptions: {
        outDir: outDir,
        target: 'ESNext',
        strict: true,
        esModuleInterop: true,
        declaration: true,
        declarationMap: true,
        emitDeclarationOnly: true,
        skipLibCheck: true,
        jsx: 'preserve',
      },
      include: [srcDir],
    },
    null,
    2
  );

  let tsConfigToUse: string;
  let tempConfig = false;

  if (fs.existsSync(packageTsConfig)) {
    tsConfigToUse = packageTsConfig;
  } else if (fs.existsSync(globalPackageConfig)) {
    tsConfigToUse = globalPackageConfig;
  } else {
    // If package doesn't have a ts config then add a temporary config to generate the declaration files
    tsConfigToUse = path.join(packageRoot, 'tsconfig.temp.json');
    tempConfig = true;
    fs.writeFileSync(tsConfigToUse, tsconfigContent);
  }

  const spinner = yoctoSpinner({
    spinner: {
      interval: 125,
      frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'],
    },
    text: chalk.blue(`Generating .d.ts files`),
  }).start();

  try {
    execSync(
      `npx tsc --emitDeclarationOnly --outDir ${outDir} --project ${tsConfigToUse}`,
      { stdio: 'inherit' }
    );

    spinner.success(chalk.green('Generated .d.ts files'));
  } catch (error) {
    spinner.error(chalk.red('Generation of .d.ts failed'));
    Logger.Error(`Error generating declaration files: ${error}`);
  } finally {
    // Clear out temp tsconfig file once types are generated
    if (tempConfig) {
      fs.unlinkSync(tsConfigToUse);
    }
  }
}

function transformToJavascript(srcDir: string, outDir: string) {
  const babelCmd = `npx babel ${srcDir} --out-dir ${outDir} --config-file ${path.resolve(
    __dirname,
    '../../../babel.config.json'
  )} --extensions ".ts,.tsx" --copy-files`;

  const spinner = yoctoSpinner({
    spinner: {
      interval: 125,
      frames: ['∙∙∙', '●∙∙', '∙●∙', '∙∙●', '∙∙∙'],
    },
    text: chalk.blue(`Transpiling Tsx to JS`),
  }).start();

  try {
    execSync(babelCmd, { stdio: 'inherit' });
    spinner.success(chalk.green('Transpilation completed!'));
  } catch (error) {
    spinner.error(chalk.red('Transpilation completed!'));
    Logger.Error(`Error transpiling files:, ${error}`);
    process.exit(1);
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
    transformToJavascript(srcDir, outDir);

    // Step 2. -> Generate Type declaration files
    generateDeclaration(srcDir, outDir);

    // Step 3. -> Rename js to jsx for better HMR support during development
    renameToJSX(outDir);
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
    chokidar.watch(srcDir, { ignoreInitial: true }).on('all', () => {
      Logger.Info('🔄 Detected changes, rebuilding...');
      startTransformation(srcDir, outDir);
    });
  }

  startTransformation(srcDir, outDir);
}

main();
