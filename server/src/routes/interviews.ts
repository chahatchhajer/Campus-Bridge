import { Router } from 'express';
import { requireUser } from '../auth.js';
import type { AppContext } from '../context.js';
import { ok, parseBody, parseParams } from '../http.js';
import { deleteInterview, getInterview, updateInterview } from '../repos/interviews.js';
import { updateInterviewSchema, uuidParam } from '../schemas.js';

export function interviewRoutes({ db }: AppContext) {
  const r = Router();

  r.get('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    res.json(ok(await getInterview(db, user.id, id)));
  });

  r.patch('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    await updateInterview(db, user.id, id, parseBody(updateInterviewSchema, req));
    res.json(ok(await getInterview(db, user.id, id)));
  });

  r.delete('/:id', async (req, res) => {
    const user = requireUser(req);
    const { id } = parseParams(uuidParam, req);
    await deleteInterview(db, user.id, id);
    res.status(204).end();
  });

  return r;
}
