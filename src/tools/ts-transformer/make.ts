// Globals
import { transformSync } from '@babel/core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
function generateJavascriptFiles(params: {
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
      generateJavascriptFiles({
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

export { generateJavascriptFiles };
