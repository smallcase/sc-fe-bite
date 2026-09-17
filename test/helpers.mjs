import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(
  new URL('../dist/cli/tsx-transform.js', import.meta.url)
);

export async function fixture(t) {
  const dir = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'bite-mixed-'))
  );
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

export async function until(condition, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await condition().catch(() => false)) return;
    await delay(50);
  }
  assert.fail(`Timed out: ${description}`);
}
