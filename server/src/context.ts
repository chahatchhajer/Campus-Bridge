import type { Config } from './config.js';
import type { Db } from './db.js';
import type { StorageDriver } from './storage.js';

export type AppContext = {
  config: Config;
  db: Db;
  /** null when no storage backend is configured (e.g. production without Supabase). */
  storage: StorageDriver | null;
};
