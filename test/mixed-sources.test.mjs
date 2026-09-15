import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(
  new URL('../dist/cli/tsx-transform.js', import.meta.url)
);

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bite-mixed-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, 'src'));
  const write = async (name, contents) => {
    const file = path.join(dir, 'src', name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
  };
  const read = (name) => fs.readFile(path.join(dir, 'dist', name), 'utf8');
  const exists = (name) =>
    fs.access(path.join(dir, 'dist', name)).then(
      () => true,
      () => false
    );
  const run = (...args) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: dir });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const closed = once(child, 'close');
    t.after(async () => {
      if (child.exitCode === null) child.kill();
      await closed;
    });
    return { child, closed, output: () => output };
  };
  return { dir, write, read, exists, run };
}

async function until(condition, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await condition().catch(() => false)) return;
    await delay(50);
  }
  assert.fail(`Timed out: ${description}`);
}

test('build preserves legacy declarations and generates TS declarations', async (t) => {
  const f = await fixture(t);
  const declaration =
    'export declare const legacy: (value: string) => string;\n';
  await f.write('legacy.js', 'export const legacy = value => value;\n');
  await f.write('legacy.d.ts', declaration);
  await f.write(
    'ambient.d.ts',
    'declare module "legacy-host" { export const value: string; }\n'
  );
  await f.write(
    'modern.ts',
    'export const modern = (value: number): number => value * 2;\n'
  );
  await f.write('view.tsx', 'export const view = <div />;\n');
  await f.write('asset.svg', '<svg />');
  await f.write('__tests__/ignored.ts', 'invalid code');
  const build = f.run('--clean');
  assert.equal((await build.closed)[0], 0, build.output());
  assert.equal(await f.read('legacy.d.ts'), declaration);
  assert.match(await f.read('modern.d.ts'), /value: number/);
  assert.match(await f.read('modern.js'), /value \* 2/);
  assert.equal(await f.exists('view.jsx'), true);
  assert.equal(await f.exists('view.d.ts'), true);
  assert.equal(await f.read('asset.svg'), '<svg />');
  assert.equal(await f.exists('ambient.d.ts'), true);
  assert.equal(await f.exists('legacy.d.js'), false);
  assert.equal(await f.exists('__tests__/ignored.js'), false);
});

test('build rejects handwritten/generated and JS/TS output collisions', async (t) => {
  for (const extra of ['item.d.ts', 'item.js']) {
    const f = await fixture(t);
    await f.write('item.ts', 'export const item = 1;');
    await f.write(extra, 'export {};');
    const build = f.run();
    assert.notEqual((await build.closed)[0], 0);
    assert.match(build.output(), /Output collision/);
    assert.match(
      await fs.readFile(path.join(f.dir, 'src', extra), 'utf8'),
      /export/
    );
  }
});

test('watch copies declaration changes and survives JS-to-TS migration', async (t) => {
  const f = await fixture(t);
  await f.write('item.js', 'export const item = value => value;');
  await f.write(
    'item.d.ts',
    'export declare const item: (value: string) => string;'
  );
  await f.write('modern.ts', 'export const modern = 1;');
  const watch = f.run('--watch');
  await until(
    async () =>
      watch.output().includes('Watching ') && (await f.exists('modern.d.ts')),
    'watch ready'
  );
  await f.write(
    'item.d.ts',
    'export declare const item: (value: number) => number;'
  );
  await until(
    async () => (await f.read('item.d.ts')).includes('value: number'),
    'declaration update'
  );
  await f.write('extra.d.ts', 'export declare const extra: boolean;');
  await until(() => f.exists('extra.d.ts'), 'declaration addition');
  await fs.unlink(path.join(f.dir, 'src/extra.d.ts'));
  await until(
    async () => !(await f.exists('extra.d.ts')),
    'declaration removal'
  );

  // Introduce the TS file first, as can happen during an editor rename.
  await f.write(
    'item.ts',
    'export const item = (value: boolean): boolean => value;'
  );
  await until(
    async () => watch.output().includes('Output collision'),
    'collision reported'
  );
  assert.match(await f.read('item.d.ts'), /value: number/);
  await fs.unlink(path.join(f.dir, 'src/item.js'));
  await fs.unlink(path.join(f.dir, 'src/item.d.ts'));
  await until(
    async () => (await f.read('item.d.ts')).includes('value: boolean'),
    'generated declaration after rename'
  );
  assert.match(await f.read('item.js'), /export const item/);
  await f.write(
    'item.ts',
    'export const item = (value: string): string => value;'
  );
  await until(
    async () => (await f.read('item.d.ts')).includes('value: string'),
    'TS declaration update'
  );
  await fs.unlink(path.join(f.dir, 'src/item.ts'));
  await until(
    async () =>
      !(await f.exists('item.js')) &&
      !(await f.exists('item.d.ts')) &&
      !(await f.exists('item.d.ts.map')),
    'TS artifact removal'
  );
  assert.equal(watch.child.exitCode, null);
});
