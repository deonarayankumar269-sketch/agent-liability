import { Router } from 'express';
import { config } from '../config.js';
import { providers } from '../services/aiRouter.js';
import { paypal } from '../services/paypalClient.js';
import { Mandate } from '../models/Mandate.js';
import { AgentAction } from '../models/AgentAction.js';
import { Dispute } from '../models/Dispute.js';
import { AuditEntry } from '../models/AuditEntry.js';
import { IdempotencyRecord } from '../models/IdempotencyRecord.js';
import * as audit from '../services/auditChain.js';
import { HttpError, wrap } from '../utils/http.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({
    paypalMode: paypal.mode,
    simulated: paypal.simulated,
    webhookVerification: Boolean(config.paypal.webhookId),
    ai: providers(),
    demoReset: config.allowDemoReset,
  });
});

router.post('/system/reset', wrap(async (req, res) => {
  if (!config.allowDemoReset) throw new HttpError(403, 'demo reset is disabled (ALLOW_DEMO_RESET=false)');
  for (const M of [Mandate, AgentAction, Dispute, IdempotencyRecord]) await M.deleteMany({});
  await AuditEntry.collection.deleteMany({}); // native driver on purpose, the model refuses deletes
  await audit.append('chain_initialized', { reason: 'demo reset' });
  res.json({ ok: true });
}));

export default router;
