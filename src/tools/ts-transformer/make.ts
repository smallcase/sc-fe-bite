// Globals
import { transformSync } from '@babel/core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { isExcludedSource } from '../../utils/exclude.js';

// Manually define __dirname for ESM: FUCK YOU NODE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isTsSource(filePath: string): boolean {
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

function walkFiles(srcDir: string): string[] {
  const results: string[] = [];
  const stack: string[] = [srcDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else results.push(full);
    }
  }
  return results;
}

/**
 * Process all `.ts`/`.tsx` files in a directory (full tree) and copy
 * non-TS assets through as-is. Used for the initial build.
 */
function generateJavascriptFiles(params: {
  srcDir: string;
  outDir: string;
  babelConfig?: string;
}) {
  fs.mkdirSync(params.outDir, { recursive: true });
  for (const srcPath of walkFiles(params.srcDir)) {
    if (isExcludedSource(srcPath)) continue;
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
  }
}

export { generateJavascriptFiles, transformFile, computeOutPath, isTsSource };
