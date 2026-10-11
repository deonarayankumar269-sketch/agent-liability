import { Router } from 'express';
import { Mandate } from '../models/Mandate.js';
import * as engine from '../services/mandateEngine.js';
import * as orders from '../services/orderService.js';
import { findOr404, wrap } from '../utils/http.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const list = await Mandate.find().sort({ createdAt: -1 }).limit(100);
  for (const m of list) await engine.refreshStatus(m);
  res.json(await Promise.all(list.map(engine.describe)));
}));

router.post('/', wrap(async (req, res) => {
  const { agentId, maxAmount, currency, merchants, hours, description } = req.body || {};
  const m = await engine.createMandate({ agentId, maxAmount, currency, merchants, hours, description });
  res.status(201).json(await engine.describe(m));
}));

// emergency stop for everything that is still active
router.post('/revoke-all', wrap(async (req, res) => {
  const active = await Mandate.find({ status: 'active' });
  const voided = [];
  for (const m of active) {
    await engine.revokeMandate(m, 'emergency stop (all)');
    voided.push(...await orders.voidOpenActions(m._id, 'emergency stop'));
  }
  res.json({ revoked: active.length, voided });
}));

router.get('/:id', wrap(async (req, res) => {
  const m = await findOr404(Mandate, req.params.id, 'mandate');
  await engine.refreshStatus(m);
  res.json(await engine.describe(m));
}));

router.post('/:id/revoke', wrap(async (req, res) => {
  const m = await findOr404(Mandate, req.params.id, 'mandate');
  await engine.revokeMandate(m, req.body?.reason || 'emergency stop');
  const voided = await orders.voidOpenActions(m._id, 'mandate revoked');
  res.json({ mandate: await engine.describe(m), voided });
}));

export default router;
