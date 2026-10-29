import { Router } from 'express';
import { requireUser } from '../auth.js';
import type { AppContext } from '../context.js';
import { ok, paginationMeta, parseBody, parseParams, parseQuery } from '../http.js';
import {
  createApplication,
  deleteApplication,
  getApplicationDetail,
  listActivity,
  listApplications,
  updateApplication,
} from '../repos/applications.js';
import { createInterview, getInterview } from '../repos/interviews.js';
import {
  createApplicationSchema,
  createInterviewSchema,
  listApplicationsQuery,
  updateApplicationSchema,
  uuidParam,
} from '../schemas.js';

export function applicationRoutes({ db }: AppContext) {
  const r = Router();

  r.get('/', async (req, res) => {
    const user = requireUser(req);
    const q = parseQuery(listApplicationsQuery, req);
    const { rows, total } = await listApplications(db, user.id, q);
    res.json(ok(rows, paginationMeta(q.page, q.pageSize, total)));
  });

  r.post('/', async (req, res) => {
    const user = requireUser(req);
    const input = parseBody(createApplicationSchema, req);
    const id = await createApplication(db, user.id, input);
    res.status(201).json(ok(await getApplicationDetail(db, user.id, id)));
  });

  r.get('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    res.json(ok(await getApplicationDetail(db, user.id, id)));
  });

  r.patch('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    await updateApplication(db, user.id, id, parseBody(updateApplicationSchema, req));
    res.json(ok(await getApplicationDetail(db, user.id, id)));
  });

  r.delete('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    await deleteApplication(db, user.id, id);
    res.status(204).end();
  });

  r.get('/:id/activity', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    res.json(ok(await listActivity(db, user.id, id)));
  });

  r.post('/:id/interviews', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    const input = parseBody(createInterviewSchema, req);
    const created = await createInterview(db, user.id, id, input);
    res.status(201).json(ok({ ...(await getInterview(db, user.id, created.id)), stageAdvanced: created.advanced }));
  });

  return r;
}
