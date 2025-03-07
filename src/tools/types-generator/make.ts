import path from 'path';
import fs from 'fs';
import ts from 'typescript';

import { Logger } from '../../utils/logger.js';

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
    Logger.Error(
      `Error generating declaration files:, ${JSON.stringify(
        result.diagnostics
      )}`
    );

    throw new Error(JSON.stringify(result.diagnostics));
  }
}

export { generateDeclarationsNatively };
