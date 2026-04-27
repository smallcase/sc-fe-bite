/**
 * Source-file patterns that should be skipped entirely — neither
 * transpiled to dist nor included in the TS program. These are
 * dev-only files (stories, tests, fixtures) that consumers don't
 * import via the package's public API and that often pull in
 * dependencies (storybook, vitest, package self-imports) which
 * have no business showing up in a published `dist/`.
 *
 * Excluding them also prevents a particular footgun: stories that
 * import the package's own public name pull `dist/*.d.ts` back into
 * the TS program, which (modulo the outDir filter we already apply)
 * is a constant source of TS5055 / circular-resolution noise.
 */
const TEST_STORY_FILE_RE = /\.(stories|test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TESTS_DIR_RE = /[/\\]__tests__[/\\]/;
const SNAPSHOTS_DIR_RE = /[/\\]__snapshots__[/\\]/;

export function isExcludedSource(srcPath: string): boolean {
  return (
    TEST_STORY_FILE_RE.test(srcPath) ||
    TESTS_DIR_RE.test(srcPath) ||
    SNAPSHOTS_DIR_RE.test(srcPath)
  );
}
