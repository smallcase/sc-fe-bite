import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { readBuildConfig } from '../dist/utils/build-config.js';
import { fixture, until } from './helpers.mjs';

async function config(f, name, contents) {
  const file = path.join(f.dir, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    typeof contents === 'string' ? contents : JSON.stringify(contents)
  );
  return file;
}

test('inherits JSONC options and source patterns; preserves JS contracts', async (t) => {
  const f = await fixture(t);
  await f.write('legacy.js', 'export const legacy = value => value;');
  const declaration = 'export declare const legacy: (value: string) => string;';
  await f.write('legacy.d.ts', declaration);
  await f.write('inferred.js', 'export const inferred = () => 42;');
  await f.write(
    'modern.ts',
    "import { legacy } from './legacy'; import { inferred } from './inferred'; export const modern = () => [legacy('x'), inferred()] as const;"
  );
  await f.write('ignore.ts', 'invalid syntax');
  await f.write('ignore.svg', 'excluded asset');
  await f.write('icon.svg', '<svg />');
  await f.write('node_modules/dependency/index.ts', 'invalid syntax');
  await f.write('example.test.ts', 'invalid syntax');
  await config(
    f,
    'config/base.json',
    `{
    // All relative paths belong to this config directory.
    "compilerOptions": { "allowJs": true, "checkJs": false, "noEmit": true,
      "target": "ES2020", "baseUrl": "../src", "paths": { "alias/*": ["*"] },
      "outDir": "../wrong", "rootDir": "../wrong", "declarationDir": "../wrong", "outFile": "../wrong/bundle.js" },
    "include": ["../src/**/*"], "exclude": ["../src/ignore.*"],
  }`
  );
  const tsConfig = await config(f, 'tsconfig.build.json', {
    extends: './config/base.json',
  });
  const parsed = readBuildConfig({
    srcDir: path.join(f.dir, 'src'),
    outDir: path.join(f.dir, 'dist'),
    tsConfig,
  });
  assert.equal(parsed.options.target, ts.ScriptTarget.ES2020);
  assert.equal(parsed.options.baseUrl, path.join(f.dir, 'src'));
  assert.equal(parsed.options.noEmit, false);
  assert.deepEqual(parsed.options.paths, { 'alias/*': ['*'] });
  const build = f.run('--tsConfig', tsConfig);
  assert.equal((await build.closed)[0], 0, build.output());
  assert.equal(await f.read('legacy.d.ts'), declaration);
  assert.match(await f.read('modern.d.ts'), /readonly \[string, number\]/);
  assert.equal(await f.exists('modern.d.ts.map'), true);
  assert.equal(await f.exists('inferred.d.ts'), false);
  assert.equal(await f.exists('inferred.js'), true);
  assert.equal(await f.exists('ignore.js'), false);
  assert.equal(await f.exists('ignore.svg'), false);
  assert.equal(await f.exists('icon.svg'), true);
  assert.equal(await f.exists('node_modules'), false);
  assert.equal(await f.exists('example.test.js'), false);
  assert.equal(
    await fs.access(path.join(f.dir, 'wrong')).then(
      () => true,
      () => false
    ),
    false
  );
});

test('files-only config selects exactly the explicit inputs', async (t) => {
  const f = await fixture(t);
  await f.write('selected.ts', 'export const selected = 1;');
  await f.write('other.ts', 'invalid syntax');
  const tsConfig = await config(f, 'tsconfig.json', {
    files: ['./src/selected.ts'],
  });
  const build = f.run('--tsConfig', tsConfig);
  assert.equal((await build.closed)[0], 0, build.output());
  assert.equal(await f.exists('selected.js'), true);
  assert.equal(await f.exists('other.js'), false);
});

test('JS-only packages build and nested output is never rediscovered', async (t) => {
  const f = await fixture(t);
  await f.write('index.js', 'export const value = 1;');
  await f.write('node_modules/pkg/index.js', 'dependency');
  const tsConfig = await config(f, 'src/tsconfig.json', {
    include: ['./**/*'],
  });
  for (let iteration = 0; iteration < 2; iteration++) {
    const build = f.run(
      '--src',
      './src',
      '--dist',
      './src/dist',
      '--tsConfig',
      tsConfig
    );
    assert.equal((await build.closed)[0], 0, build.output());
  }
  assert.match(
    await fs.readFile(path.join(f.dir, 'src/dist/index.js'), 'utf8'),
    /value/
  );
  for (const absent of ['src/dist/dist', 'src/dist/node_modules']) {
    assert.equal(
      await fs.access(path.join(f.dir, absent)).then(
        () => true,
        () => false
      ),
      false
    );
  }
});

test('invalid config or unsafe output fails before clean touches existing files', async (t) => {
  const f = await fixture(t);
  await f.write('index.ts', 'export const value = 1;');
  await config(f, 'dist/sentinel', 'keep me');
  await config(f, 'bad.json', '{ broken');
  for (const args of [
    ['--tsConfig', 'missing.json'],
    ['--tsConfig', 'bad.json'],
    ['--dist', './src'],
    ['--dist', '.'],
  ]) {
    const build = f.run('--clean', ...args);
    assert.notEqual((await build.closed)[0], 0);
    assert.equal(await f.read('sentinel'), 'keep me');
    assert.equal(
      await fs.readFile(path.join(f.dir, 'src/index.ts'), 'utf8'),
      'export const value = 1;'
    );
  }
});

test('allowJs watch re-infers TS exports without generating JS declarations', async (t) => {
  const f = await fixture(t);
  await f.write('legacy.js', 'export const legacy = () => 42;');
  await f.write(
    'modern.ts',
    "import { legacy } from './legacy'; export const modern = () => legacy();"
  );
  const tsConfig = await config(f, 'tsconfig.json', {
    compilerOptions: { allowJs: true, checkJs: false },
    exclude: ['./src/ignored.*'],
  });
  const watch = f.run('--watch', '--tsConfig', tsConfig);
  await until(
    async () =>
      watch
        .output()
        .includes(`Watching ${path.join(f.dir, 'src')} for changes`) &&
      (await f.read('modern.d.ts')).includes('number'),
    'watch ready'
  );
  await f.write('legacy.js', "export const legacy = () => 'changed';");
  await until(
    async () => (await f.read('modern.d.ts')).includes('string'),
    'JS-dependent TS declaration update'
  );
  await until(
    async () => (await f.read('legacy.js')).includes('changed'),
    'JS copy update'
  );
  assert.equal(await f.exists('legacy.d.ts'), false);
  await f.write('ignored.js', 'excluded');
  await f.write('added.ts', 'export const added = true;');
  await until(() => f.exists('added.d.ts'), 'TS addition');
  assert.equal(await f.exists('ignored.js'), false);
  assert.equal(watch.child.exitCode, null);
});
