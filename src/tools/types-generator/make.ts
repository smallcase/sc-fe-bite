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

function getCompilerOptions(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
}): ts.CompilerOptions {
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
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };

  if (params.tsConfig && fs.existsSync(params.tsConfig)) {
    compilerOptions = JSON.parse(
      fs.readFileSync(params.tsConfig, 'utf8')
    ).compilerOptions;
  }

  return {
    ...compilerOptions,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
  };
}

/**
 * Generate TypeScript declaration files for the entire srcDir in one pass.
 * Used for the initial/one-shot build.
 */
function generateDeclarationsNatively(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
}) {
  const files = getAllTsFiles(params.srcDir);
  const compilerOptions = getCompilerOptions(params);

  const program = ts.createProgram(files, compilerOptions);

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

export type TypesWatcher = {
  addFile: (srcPath: string) => void;
  removeFile: (srcPath: string) => void;
  close: () => void;
};

function startRawWatchProgram(
  rootFiles: string[],
  compilerOptions: ts.CompilerOptions
) {
  const host = ts.createWatchCompilerHost(
    rootFiles,
    compilerOptions,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    (diagnostic) => {
      Logger.Error(formatDiagnostic(diagnostic));
    },
    (diagnostic) => {
      Logger.Info(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      );
    }
  );
  return ts.createWatchProgram(host);
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && diagnostic.start !== undefined) {
    const { line, character } = ts.getLineAndCharacterOfPosition(
      diagnostic.file,
      diagnostic.start
    );
    return `${diagnostic.file.fileName}(${line + 1},${
      character + 1
    }): TS${diagnostic.code}: ${message}`;
  }
  return `TS${diagnostic.code}: ${message}`;
}

/**
 * Start a persistent TypeScript watch program that incrementally emits
 * .d.ts files for changed sources. Diagnostics are logged but never
 * throw — a type error won't kill the watcher.
 *
 * Call addFile / removeFile when sources are added or removed (from
 * chokidar add/unlink). This restarts the underlying `ts.watchProgram`
 * with the updated root file list (debounced), because
 * `updateRootFileNames` on its own does not reliably trigger emission
 * for newly-added files. `change` events don't need a call — TS's own
 * file watcher sees them.
 */
function startTypesWatcher(params: {
  srcDir: string;
  outDir: string;
  tsConfig?: string;
}): TypesWatcher {
  let rootFiles = getAllTsFiles(params.srcDir);
  const compilerOptions = getCompilerOptions(params);

  let watchProgram = startRawWatchProgram(rootFiles, compilerOptions);

  let restartTimer: NodeJS.Timeout | null = null;
  function scheduleRestart() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      watchProgram.close();
      watchProgram = startRawWatchProgram(rootFiles, compilerOptions);
    }, 200);
  }

  return {
    addFile(srcPath: string) {
      if (!rootFiles.includes(srcPath)) {
        rootFiles.push(srcPath);
        scheduleRestart();
      }
    },
    removeFile(srcPath: string) {
      const idx = rootFiles.indexOf(srcPath);
      if (idx >= 0) {
        rootFiles.splice(idx, 1);
        scheduleRestart();
      }
    },
    close() {
      if (restartTimer) clearTimeout(restartTimer);
      watchProgram.close();
    },
  };
}

export { generateDeclarationsNatively, startTypesWatcher };
