import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { requireUser } from '../auth.js';
import type { AppContext } from '../context.js';
import { HttpError, badRequest, conflict } from '../errors.js';
import { ok, parseBody, parseParams, parseQuery } from '../http.js';
import {
  MAX_RESUMES_PER_USER,
  countResumes,
  deleteResumeRow,
  getResume,
  getResumeStorage,
  insertResume,
  listResumes,
  renameResume,
} from '../repos/resumes.js';
import { downloadQuery, renameResumeSchema, uuidParam } from '../schemas.js';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60;

/** PDF files start with "%PDF-" (spec allows a little leading junk, but we stay strict). */
export const hasPdfSignature = (buf: Buffer) => buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';

/** Strip path parts and control characters from the client-supplied display filename. */
export function cleanFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? 'resume.pdf';
  return (base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'resume.pdf');
}

export function resumeRoutes({ db, storage }: AppContext, uploadLimiter: RequestHandler) {
  const r = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 5, fieldSize: 1024 },
  });

  const needStorage = () => {
    if (!storage) throw new HttpError(503, 'storage_unavailable', 'File storage is not configured on this server.');
    return storage;
  };

  r.get('/', async (req, res) => {
    res.json(ok(await listResumes(db, requireUser(req).id)));
  });

  r.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
    const user = requireUser(req);
    const store = needStorage();
    const file = req.file;
    if (!file) throw badRequest('Choose a PDF to upload.');
    if (file.mimetype !== 'application/pdf') throw new HttpError(415, 'unsupported_media_type', 'Only PDF files are accepted.');
    if (!hasPdfSignature(file.buffer)) throw new HttpError(415, 'unsupported_media_type', 'That file does not look like a valid PDF.');
    if ((await countResumes(db, user.id)) >= MAX_RESUMES_PER_USER) {
      throw conflict(`You can store up to ${MAX_RESUMES_PER_USER} resumes. Delete one to upload another.`);
    }

    const originalFilename = cleanFilename(file.originalname);
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = (rawName || originalFilename.replace(/\.pdf$/i, '')).slice(0, 120) || 'Resume';

    // The object path is generated here from the verified user id and a fresh UUID. Client input never reaches it.
    const id = randomUUID();
    const storagePath = `${user.id}/${id}.pdf`;

    await store.upload(storagePath, file.buffer, 'application/pdf');
    try {
      const resume = await insertResume(db, {
        id,
        userId: user.id,
        name,
        originalFilename,
        storagePath,
        sizeBytes: file.size,
      });
      res.status(201).json(ok(resume));
    } catch (err) {
      // Metadata insert failed: do not leave an orphaned object behind.
      await store.remove(storagePath).catch((e) => console.error('Orphan cleanup failed for an uploaded resume:', e.message));
      throw err;
    }
  });

  r.patch('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    const { name } = parseBody(renameResumeSchema, req);
    res.json(ok(await renameResume(db, user.id, id, name)));
  });

  r.get('/:id/download', async (req, res) => {
    const user = requireUser(req);
    const store = needStorage();
    const { id } = parseParams(uuidParam, req);
    const { disposition } = parseQuery(downloadQuery, req);
    // Ownership check happens in SQL (WHERE user_id = ...) before anything is signed.
    const row = await getResumeStorage(db, user.id, id);
    const filename = row.originalFilename;
    const url = await store.createSignedUrl(row.storagePath, { expiresIn: SIGNED_URL_TTL_SECONDS, filename, disposition });
    res.json(ok({ url, expiresIn: SIGNED_URL_TTL_SECONDS, filename }));
  });

  r.delete('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    await getResume(db, user.id, id); // 404 if not the caller's
    const storagePath = await deleteResumeRow(db, user.id, id);

    let storageCleanup: 'ok' | 'failed' | 'skipped' = 'skipped';
    if (storage) {
      try {
        await storage.remove(storagePath);
        storageCleanup = 'ok';
      } catch (err) {
        storageCleanup = 'failed';
        console.error(`Storage cleanup failed for a deleted resume (${id}):`, (err as Error).message);
      }
    }
    res.json(ok({ id, storageCleanup }));
  });

  return r;
}
