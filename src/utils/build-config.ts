import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { isExcludedSource } from './exclude.js';

export type BuildParams = { srcDir: string; outDir: string; tsConfig?: string };

// Resolve existing ancestors too, so a not-yet-created dist through a symlink
// is compared against the same physical source directory before --clean.
export function resolveBuildPath(file: string): string {
  const absolute = path.resolve(file);
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute);
  const parent = path.dirname(absolute);
  return parent === absolute
    ? absolute
    : path.join(resolveBuildPath(parent), path.basename(absolute));
}

export function isWithin(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

export function readBuildConfig(params: BuildParams) {
  const srcDir = resolveBuildPath(params.srcDir);
  const outDir = resolveBuildPath(params.outDir);
  if (isWithin(outDir, srcDir)) {
    throw new Error(
      'Output directory must not equal or contain the source directory.'
    );
  }
  const configPath = params.tsConfig
    ? resolveBuildPath(params.tsConfig)
    : undefined;
  const configDir = configPath ? path.dirname(configPath) : srcDir;
  const parsed = configPath
    ? ts.getParsedCommandLineOfConfigFile(
        configPath,
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            throw new Error(
              ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
            );
          },
        }
      )
    : undefined;
  if (parsed?.errors.length) {
    // A JS-only package may have no TS inputs while allowJs is disabled.
    const errors = parsed.errors.filter((error) => error.code !== 18003);
    if (errors.length)
      throw new Error(
        errors
          .map((error) =>
            ts.flattenDiagnosticMessageText(error.messageText, '\n')
          )
          .join('\n')
      );
  }
  const options: ts.CompilerOptions = {
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    ...parsed?.options,
    // Babel owns runtime output; CLI paths own the output layout.
    rootDir: srcDir,
    outDir,
    declarationDir: outDir,
    outFile: undefined,
    noEmit: false,
    declaration: true,
    declarationMap: true,
    emitDeclarationOnly: true,
    jsx: ts.JsxEmit.Preserve,
    incremental: false,
    composite: false,
    tsBuildInfoFile: undefined,
  };
  const files =
    parsed?.raw.files && !parsed.raw.include
      ? []
      : ts.sys.readDirectory(
          configDir,
          undefined,
          [
            ...(parsed?.raw.exclude ?? []),
            '**/node_modules/**',
            '**/.git/**',
            outDir,
          ],
          parsed?.raw.include ??
            (parsed?.raw.files ? [] : [path.join(srcDir, '**/*')])
        );
  for (const file of parsed?.fileNames ?? []) files.push(file);
  // Explicit files cannot bypass Bite's package boundary or dev-file exclusions.
  const sourceFiles = [
    ...new Set(files.map((file) => resolveBuildPath(file))),
  ].filter(
    (file) =>
      isWithin(srcDir, file) &&
      !isWithin(outDir, file) &&
      !file
        .split(path.sep)
        .some((part) => part === 'node_modules' || part === '.git') &&
      !isExcludedSource(file) &&
      fs.existsSync(file)
  );
  return { options, sourceFiles };
}
