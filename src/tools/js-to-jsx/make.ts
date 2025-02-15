#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as babelParser from '@babel/parser';
import traverseModule from '@babel/traverse';

// Correctly type the traverse function
const traverse = traverseModule;

const fileExtensions = ['.js', '.ts'];

/**
 * Function to find all the JS/TS in the given directory and its sub directories recursively
 * @param {string} directory - directory which needs to be traversed
 * @returns list of js and ts files present in the directory and its sub-directories
 */
export function findFiles(directory: string): string[] {
  const files: string[] = [];

  function readDirectory(dir: string) {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        readDirectory(filePath);
      } else {
        if (fileExtensions.includes(path.extname(filePath))) {
          files.push(filePath);
        }
      }
    });
  }

  readDirectory(directory);
  return files;
}

/**
 * function to check if the given file contains a JSX element or not
 * @param {string} filePath - path of the file which needs to be checked
 * @returns - true / false based on the presence of jsx syntax
 */
function hasJSXSyntax(filePath: string): boolean {
  const code = fs.readFileSync(filePath, 'utf-8');

  try {
    const ast = babelParser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let hasJSX = false;

    traverse(ast, {
      JSXElement() {
        hasJSX = true;
      },
    });

    return hasJSX;
  } catch (error) {
    console.error('Error While checking for JSX:', error);
    return false;
  }
}

/**
 * Main function to rename files containing JSX to .jsx or .tsx
 * @param {string} rootDirectory - The root directory to start searching from
 */
export function renameToJSX(rootDirectory: string): void {
  const selectedFiles = findFiles(rootDirectory);

  console.log('📋 Renaming Files to JSX...');

  selectedFiles.forEach((eachFile) => {
    if (hasJSXSyntax(eachFile)) {
      const jsxFile = eachFile.split('.').at(-1)?.includes('ts')
        ? eachFile.replace('.ts', '.tsx')
        : eachFile.replace('.js', '.jsx');

      fs.renameSync(eachFile, jsxFile);
    }
  });

  console.log('🎉 File renaming complete.');
}
