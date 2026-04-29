import path from 'path';
import fs from 'fs';

/**
 * Walks up from `startDir` looking for a workspace-root marker —
 * `lerna.json`, `pnpm-workspace.yaml`, or a `package.json` with a
 * `workspaces` field. Returns the directory path, or `null` if no
 * marker is found before the filesystem root.
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  // Don't treat the package's own dir as the workspace root.
  dir = path.dirname(dir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'lerna.json')) ||
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      hasWorkspacesField(path.join(dir, 'package.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function hasWorkspacesField(packageJsonPath: string): boolean {
  if (!fs.existsSync(packageJsonPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return (
      Array.isArray(pkg.workspaces) ||
      (pkg.workspaces && Array.isArray(pkg.workspaces.packages))
    );
  } catch {
    return false;
  }
}

// Triple-slash reference directives at the top of a .d.ts mark it as a
// tooling/framework-environment file (e.g. `vite-env.d.ts`,
// `next-env.d.ts`, `vitest.shims.d.ts`). Those files chain into vendor
// type packages — Playwright alone is several MB of `.d.ts` — and
// pulling them into every per-package TypeScript program multiplies
// memory and CPU dramatically when many packages build in parallel.
// Genuine ambient module declaration files (the kind we want to make
// visible to every package) don't typically use these directives.
const REFERENCE_DIRECTIVE_RE =
  /^\s*\/\/\/\s*<reference\s+(types|path|lib|no-default-lib)\b/m;

// Triple-slash directives must precede any non-comment code, so we
// only need to inspect the head of each candidate file.
const HEAD_CHARS = 2048;

function looksLikeToolingEnvFile(filePath: string): boolean {
  try {
    const head = fs.readFileSync(filePath, 'utf8').slice(0, HEAD_CHARS);
    return REFERENCE_DIRECTIVE_RE.test(head);
  } catch {
    // If we can't read it, err on the side of skipping — a tooling
    // file we miss is far less harmful than including the wrong file
    // and bloating every program with vendor types.
    return true;
  }
}

/**
 * Returns absolute paths of any `*.d.ts` files sitting at the workspace
 * root that look like genuine ambient module declaration files (e.g.
 * `module.d.ts`, `globals.d.ts`). These get included in every package's
 * TypeScript program so a single root-level shim covers the whole
 * monorepo.
 *
 * Skipped:
 *  - files containing a triple-slash `<reference types|path|lib>`
 *    directive — those belong to consumer-repo tooling (vite, next,
 *    vitest browser etc.) and pulling their references into every
 *    per-package program causes huge memory/CPU cost during parallel
 *    builds.
 *  - everything if no workspace root is found, or if `srcDir` itself
 *    is the workspace root.
 */
export function getWorkspaceAmbientFiles(srcDir: string): string[] {
  const root = findWorkspaceRoot(srcDir);
  if (!root) return [];
  if (path.resolve(srcDir) === root) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.d.ts'))
    .map((entry) => path.join(root, entry.name))
    .filter((p) => !looksLikeToolingEnvFile(p));
}
