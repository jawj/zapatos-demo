import * as pg from 'pg';
export const pool = new pg.Pool({
  connectionString: 'postgresql://localhost/mostly_ormless',
});
