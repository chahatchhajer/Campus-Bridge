import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

export type SignedUrlOptions = { expiresIn: number; filename: string; disposition: 'inline' | 'attachment' };

export interface StorageDriver {
  readonly kind: 'supabase' | 'local';
  upload(objectPath: string, data: Buffer, contentType: string): Promise<void>;
  /** Short-lived URL. May be relative (local driver) - clients resolve it against the API origin. */
  createSignedUrl(objectPath: string, opts: SignedUrlOptions): Promise<string>;
  remove(objectPath: string): Promise<void>;
  /** Cheap connectivity probe used by the diagnostics endpoint. */
  probe(): Promise<boolean>;
}

class SupabaseStorage implements StorageDriver {
  readonly kind = 'supabase' as const;
  private client: SupabaseClient;
  constructor(
    url: string,
    serviceKey: string,
    private bucket: string,
  ) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  /** Creates the private bucket if it does not exist. Best effort; failures are logged by the caller. */
  async ensureBucket() {
    const { data } = await this.client.storage.getBucket(this.bucket);
    if (data) {
      if (data.public) throw new Error(`Storage bucket "${this.bucket}" is PUBLIC. Make it private in the Supabase dashboard.`);
      return;
    }
    const { error } = await this.client.storage.createBucket(this.bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }

  async upload(objectPath: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(this.bucket).upload(objectPath, data, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  async createSignedUrl(objectPath: string, opts: SignedUrlOptions) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, opts.expiresIn, opts.disposition === 'attachment' ? { download: opts.filename } : undefined);
    if (error || !data) throw new Error(`Could not sign URL: ${error?.message ?? 'unknown error'}`);
    return data.signedUrl;
  }

  async remove(objectPath: string) {
    const { error } = await this.client.storage.from(this.bucket).remove([objectPath]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  async probe() {
    const { error } = await this.client.storage.getBucket(this.bucket);
    return !error;
  }
}

/**
 * Filesystem driver for local development and demo mode ONLY (never selected in production).
 * Mirrors the Supabase flow: files are private on disk and only reachable through
 * short-lived HMAC-signed URLs issued after the API has checked ownership.
 */
export class LocalStorage implements StorageDriver {
  readonly kind = 'local' as const;
  private root: string;
  private secret: string;
  constructor(dir: string, secret?: string) {
    this.root = path.resolve(dir);
    this.secret = secret ?? randomBytes(32).toString('hex');
  }

  private resolve(objectPath: string) {
    const full = path.resolve(this.root, objectPath);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage path');
    return full;
  }

  async upload(objectPath: string, data: Buffer) {
    const full = this.resolve(objectPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data, { flag: 'wx' });
  }

  private sign(objectPath: string, exp: number, disposition: string, filename: string) {
    return createHmac('sha256', this.secret).update(`${objectPath}\n${exp}\n${disposition}\n${filename}`).digest('hex');
  }

  async createSignedUrl(objectPath: string, opts: SignedUrlOptions) {
    const exp = Math.floor(Date.now() / 1000) + opts.expiresIn;
    const sig = this.sign(objectPath, exp, opts.disposition, opts.filename);
    const qs = new URLSearchParams({ p: objectPath, exp: String(exp), d: opts.disposition, n: opts.filename, sig });
    return `/api/files/local?${qs.toString()}`;
  }

  /** Validates a signed local URL and returns the absolute file path, or null if invalid/expired. */
  verifyLocal(params: { p: string; exp: string; d: string; n: string; sig: string }) {
    const exp = Number(params.exp);
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(params.p, exp, params.d, params.n));
    const given = Buffer.from(params.sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      return this.resolve(params.p);
    } catch {
      return null;
    }
  }

  async remove(objectPath: string) {
    await fs.rm(this.resolve(objectPath), { force: true });
  }

  async probe() {
    await fs.mkdir(this.root, { recursive: true });
    return true;
  }
}

export type StorageSetup = { driver: StorageDriver | null; reason: string };

export function createStorage(config: Config): StorageSetup {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    return {
      driver: new SupabaseStorage(config.supabaseUrl, config.supabaseServiceRoleKey, config.storageBucket),
      reason: 'supabase',
    };
  }
  if (!config.isProduction) {
    return { driver: new LocalStorage(config.localStorageDir, config.storageSigningSecret), reason: 'local-dev' };
  }
  return { driver: null, reason: 'not-configured' };
}

export async function ensureStorageReady(driver: StorageDriver | null) {
  if (driver instanceof SupabaseStorage) await driver.ensureBucket();
}
