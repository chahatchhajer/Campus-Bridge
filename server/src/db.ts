import pg from 'pg';
import type { Config } from './config.js';

export type Queryable = {
  query<R extends pg.QueryResultRow = any>(text: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
};

export type Db = Queryable & {
  tx<T>(fn: (client: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  pool: pg.Pool;
};

// `date` columns come back as plain 'YYYY-MM-DD' strings instead of JS Dates,
// so they never shift with the server time zone.
pg.types.setTypeParser(1082, (v) => v);

export function createDb(config: Pick<Config, 'databaseUrl' | 'databaseSsl'>): Db {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set.');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (err) => console.error('Idle Postgres client error:', err.message));

  return {
    pool,
    query: (text, params) => pool.query(text, params as any[]),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p as any[]) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
