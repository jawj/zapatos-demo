#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

const all = recurseNodes('zapatos').reduce<{ [k: string]: string; }>((memo, path) => {
  memo[path] = fs.readFileSync(path, { encoding: 'utf8' });
  return memo;
}, {});

Object.assign(all, {
  // stubs for key pg types
  'pg.ts': `
export interface Pool {}
export interface PoolClient {}
export interface QueryResult {
  rows: any;
}
`,
  // pretend pg.Pool
  'pgPool.ts': `
import * as pg from 'pg';
export let pool: pg.Pool;
`,
  // workaround for Monaco Editor not finding index.ts inside folders:
  'zapatos/src.ts': `
export * from './src/index';
`,
});

fs.writeFileSync('files.js', `const files = ${JSON.stringify(all)};`);
