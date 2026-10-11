import { Router } from 'express';
import { AgentAction } from '../models/AgentAction.js';
import * as orders from '../services/orderService.js';
import { once } from '../services/idempotency.js';
import { config } from '../config.js';
import { findOr404, wrap } from '../utils/http.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const filter = req.query.mandateId ? { mandateId: req.query.mandateId } : {};
  res.json(await AgentAction.find(filter).sort({ createdAt: -1 }).limit(100));
}));

router.post('/', wrap(async (req, res) => {
  const key = req.get('Idempotency-Key') || req.body?.idempotencyKey;
  const out = await once(key, req.body, async () => {
    const r = await orders.createPurchase({ ...req.body, autoComplete: Boolean(req.body?.autoComplete) });
    return {
      status: r.blocked ? 422 : 201,
      body: { blocked: r.blocked, violations: r.violations || [], action: r.action },
    };
  });
  if (out.replayed) res.set('Idempotent-Replay', 'true');
  res.status(out.status).json(out.body);
}));

// paypal sends the buyer back here after approval, ?token=<order id>
router.get('/return', wrap(async (req, res) => {
  let flag = 'approved';
  try {
    await orders.completeApproval(String(req.query.token || ''));
  } catch (err) {
    console.error('[orders] approval return failed:', err.message);
    flag = 'error';
  }
  res.redirect(`${config.clientUrl}/app?order=${flag}`);
}));

router.get('/cancel', wrap(async (req, res) => {
  const action = await AgentAction.findOne({ paypalOrderId: String(req.query.token || '') });
  if (action && action.status === 'pending_approval') await orders.voidAction(action._id, 'buyer cancelled at PayPal');
  res.redirect(`${config.clientUrl}/app?order=cancelled`);
}));

router.get('/:id', wrap(async (req, res) => {
  res.json(await findOr404(AgentAction, req.params.id, 'action'));
}));

router.post('/:id/deliver', wrap(async (req, res) => {
  res.json(await orders.recordDelivery(req.params.id, req.body || {}));
}));

router.post('/:id/capture', wrap(async (req, res) => {
  res.json(await orders.captureAction(req.params.id));
}));

router.post('/:id/void', wrap(async (req, res) => {
  res.json(await orders.voidAction(req.params.id, req.body?.reason || 'manual void'));
}));

export default router;
