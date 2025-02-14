#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get directory argument
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx-transpile <src-dir>');
  process.exit(1);
}

const srcDir = path.resolve(args[0]);
const outDir = path.resolve(srcDir, '../dist');

// Ensure source directory exists
if (!fs.existsSync(srcDir)) {
  console.error(`Error: Source directory "${srcDir}" does not exist.`);
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const babelCmd = `npx babel ${srcDir} --out-dir ${outDir} --extensions ".ts,.tsx" --copy-files`;

try {
  console.log(`Transpiling files from ${srcDir} to ${outDir}...`);
  execSync(babelCmd, { stdio: 'inherit' });
  console.log('✅ Transpilation completed!');
} catch (error) {
  console.error('❌ Error transpiling files:', error.message);
  process.exit(1);
}
