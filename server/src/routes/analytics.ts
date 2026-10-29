import { Router } from 'express';
import { requireUser } from '../auth.js';
import { getBreakdowns, getDemoCount, getFunnel, getMonthly, getSummary } from '../analytics.js';
import type { AppContext } from '../context.js';
import { ok, parseQuery } from '../http.js';
import { analyticsQuery } from '../schemas.js';

export function analyticsRoutes({ db }: AppContext) {
  const r = Router();

  r.get('/summary', async (req, res) => {
    const user = requireUser(req);
    const filters = parseQuery(analyticsQuery, req);
    const [summary, demo] = await Promise.all([getSummary(db, user.id, filters), getDemoCount(db, user.id, filters)]);
    res.json(ok({ ...summary, sampleData: { sampleApplications: demo.demo, totalApplications: demo.total } }));
  });

  r.get('/funnel', async (req, res) => {
    const user = requireUser(req);
    res.json(ok(await getFunnel(db, user.id, parseQuery(analyticsQuery, req))));
  });

  r.get('/monthly', async (req, res) => {
    const user = requireUser(req);
    res.json(ok(await getMonthly(db, user.id, parseQuery(analyticsQuery, req))));
  });

  r.get('/breakdowns', async (req, res) => {
    const user = requireUser(req);
    res.json(ok(await getBreakdowns(db, user.id, parseQuery(analyticsQuery, req))));
  });

  return r;
}
