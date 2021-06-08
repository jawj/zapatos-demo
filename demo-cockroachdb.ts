#!/usr/bin/env ts-node --files

import * as pg from 'pg';
import * as debug from 'debug';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';

// authors, books, tags only

const
  queryDebug = debug('db:query'),
  resultDebug = debug('db:result'),
  txnDebug = debug('db:transaction'),
  strFromTxnId = (txnId: number | undefined) => txnId === undefined ? '-' : String(txnId);

db.setConfig({
  queryListener: (query, txnId) =>
    queryDebug(`(%s) %s\n%o`, strFromTxnId(txnId), query.text, query.values),
  resultListener: (result, txnId, elapsedMs) =>
    resultDebug(`(%s, %dms) %O`, strFromTxnId(txnId), elapsedMs?.toFixed(1), result),
  transactionListener: (message, txnId) =>
    txnDebug(`(%s) %s`, strFromTxnId(txnId), message),
});

db.setConfig({
  castArrayParamsToJson: true,
  castObjectParamsToJson: true,
});

const
  connectionString = process.env.DB_URL,
  pool = new pg.Pool({ connectionString });

(async () => {

  // setup (uses shortcut functions)
  const allTables: s.AllTables = ['authors', 'books', 'stringreturning', 'tags'];
  await db.truncate(allTables, "CASCADE").run(pool);

  await db.insert('stringreturning', [
    { bytea: Buffer.from('abc') },
    { bytea: `\\x${Buffer.from('abc').toString('hex')}` },
  ]).run(pool);
})();
