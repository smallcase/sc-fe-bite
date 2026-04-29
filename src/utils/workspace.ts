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

/**
 * Returns absolute paths of any `*.d.ts` files sitting at the
 * workspace root. These act as ambient declarations available to
 * every package in the workspace — typical patterns are
 * `module.d.ts` (CSS / SVG / asset shims) or `globals.d.ts`.
 *
 * Falls back to an empty list if no workspace root is found, or if
 * `srcDir` itself is the workspace root.
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
    .map((entry) => path.join(root, entry.name));
}
