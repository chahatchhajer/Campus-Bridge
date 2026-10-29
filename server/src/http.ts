import type { Request } from 'express';
import type { ZodType } from 'zod';

export const ok = <T>(data: T, meta?: Record<string, unknown>) => (meta ? { data, meta } : { data });

export function paginationMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const parseBody = <T>(schema: ZodType<T>, req: Request) => schema.parse(req.body ?? {});
export const parseQuery = <T>(schema: ZodType<T>, req: Request) => schema.parse(req.query);
export const parseParams = <T>(schema: ZodType<T>, req: Request) => schema.parse(req.params);

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const todayIso = () => new Date().toISOString().slice(0, 10);
