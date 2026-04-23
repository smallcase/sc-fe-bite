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

/**
 * Returns a `ts.System` that pretends every file under `outDir` does
 * not exist. Without this, TypeScript can resolve package-internal
 * self-imports (e.g. `import { Foo } from '@smallcase/components'`
 * from inside the components package) back into the package's own
 * `dist/*.d.ts`, add those files to the program as inputs, and then
 * refuse to emit them with TS5055 ("would overwrite input file") —
 * meaning `.d.ts` never updates even when sources change.
 *
 * Writes still pass through so emission itself is unaffected.
 */
function createOutDirAwareSystem(outDir: string): ts.System {
  const normalizedOutDir = outDir.endsWith('/') ? outDir : `${outDir}/`;
  // Resolve symlinks on both sides before comparing. Critical for
  // self-importing packages where TS reaches the package's own dist
  // via `node_modules/<name>` (a symlink back into the repo) — that
  // path is not textually under outDir but resolves to the same real
  // location.
  const resolveReal = (p: string) =>
    ts.sys.realpath ? ts.sys.realpath(p) : p;
  const realOutDir = resolveReal(outDir);
  const normalizedRealOutDir = realOutDir.endsWith('/')
    ? realOutDir
    : `${realOutDir}/`;
  const isUnderOutDir = (p: string) => {
    if (p === outDir || p.startsWith(normalizedOutDir)) return true;
    const real = resolveReal(p);
    return real === realOutDir || real.startsWith(normalizedRealOutDir);
  };

  return {
    ...ts.sys,
    fileExists: (p) => (isUnderOutDir(p) ? false : ts.sys.fileExists(p)),
    readFile: (p, encoding) =>
      isUnderOutDir(p) ? undefined : ts.sys.readFile(p, encoding),
    directoryExists: (p) =>
      isUnderOutDir(p)
        ? false
        : ts.sys.directoryExists
          ? ts.sys.directoryExists(p)
          : false,
    readDirectory: (rootDir, extensions, excludes, includes, depth) =>
      isUnderOutDir(rootDir)
        ? []
        : ts.sys.readDirectory(rootDir, extensions, excludes, includes, depth),
    getDirectories: (p) =>
      isUnderOutDir(p)
        ? []
        : ts.sys.getDirectories
          ? ts.sys.getDirectories(p)
          : [],
  };
}

function startRawWatchProgram(
  rootFiles: string[],
  compilerOptions: ts.CompilerOptions,
  outDir: string
) {
  const host = ts.createWatchCompilerHost(
    rootFiles,
    compilerOptions,
    createOutDirAwareSystem(outDir),
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

  let watchProgram = startRawWatchProgram(rootFiles, compilerOptions, params.outDir);

  let restartTimer: NodeJS.Timeout | null = null;
  function scheduleRestart() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      watchProgram.close();
      watchProgram = startRawWatchProgram(rootFiles, compilerOptions, params.outDir);
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
