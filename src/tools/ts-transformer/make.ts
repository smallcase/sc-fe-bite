// Globals
import { transformSync } from '@babel/core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { readBuildConfig } from '../../utils/build-config.js';

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isTsSource(filePath: string): boolean {
  return !isDeclarationFile(filePath) && isTypeInput(filePath);
}

function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith('.d.ts');
}

function isTypeInput(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

/**
 * Map a src file path to its corresponding dist path, swapping the
 * TypeScript extension for the JSX/JS equivalent. Non-TS files are
 * mirrored without extension changes.
 */
function computeOutPath(
  srcPath: string,
  srcDir: string,
  outDir: string
): string {
  const rel = path.relative(srcDir, srcPath);
  const out = path.join(outDir, rel);
  if (isDeclarationFile(srcPath)) return out;
  if (out.endsWith('.tsx')) return `${out.slice(0, -4)}.jsx`;
  if (out.endsWith('.ts')) return `${out.slice(0, -3)}.js`;
  return out;
}

/**
 * Transform a single TypeScript file using Babel (in-memory).
 * Writes directly to the given final outPath (.jsx or .js).
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
    fs.mkdirSync(path.dirname(params.outPath), { recursive: true });
    fs.writeFileSync(params.outPath, result.code, 'utf8');
  }
}

/** All artifacts owned by a source file, including generated declarations. */
function getOutputPaths(
  srcPath: string,
  srcDir: string,
  outDir: string
): string[] {
  const output = computeOutPath(srcPath, srcDir, outDir);
  if (!isTsSource(srcPath)) return [output];
  const base = output.replace(/\.jsx?$/, '');
  return [output, `${base}.d.ts`, `${base}.d.ts.map`];
}

function validateOutputs(
  srcDir: string,
  outDir: string,
  tsConfig?: string
): Set<string> {
  const owners = new Map<string, string>();
  for (const source of readBuildConfig({ srcDir, outDir, tsConfig })
    .sourceFiles) {
    for (const output of getOutputPaths(source, srcDir, outDir)) {
      const previous = owners.get(output);
      if (previous) {
        throw new Error(
          `Output collision: ${previous} and ${source} both produce ${output}. ` +
            'Remove the obsolete implementation or handwritten declaration.'
        );
      }
      owners.set(output, source);
    }
  }
  return new Set(owners.keys());
}

/** Transform implementations and copy JS, declarations and assets unchanged. */
function generateJavascriptFiles(params: {
  srcDir: string;
  outDir: string;
  babelConfig?: string;
  tsConfig?: string;
}) {
  validateOutputs(params.srcDir, params.outDir, params.tsConfig);
  fs.mkdirSync(params.outDir, { recursive: true });
  for (const srcPath of readBuildConfig(params).sourceFiles) {
    if (isTsSource(srcPath)) {
      transformFile({
        srcPath,
        outPath: computeOutPath(srcPath, params.srcDir, params.outDir),
        babelConfig: params.babelConfig,
      });
    } else {
      const outPath = computeOutPath(srcPath, params.srcDir, params.outDir);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.copyFileSync(srcPath, outPath);
    }
  }
}

export {
  generateJavascriptFiles,
  transformFile,
  computeOutPath,
  isTsSource,
  isTypeInput,
  getOutputPaths,
  validateOutputs,
};
