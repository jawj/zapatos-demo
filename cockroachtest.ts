#!/usr/bin/env ts-node --files

import * as pg from 'pg';

const
  connectionString = process.env.DB_URL,
  pool = new pg.Pool({ connectionString });

(async () => {
  const a = await pool.query(`SELECT '"public"."books"'::regclass`);
  console.log('a', a);

  const b = await pool.query(`SELECT $1::regclass`, ['"public"."books"']);
  console.log('b', b);
})();
