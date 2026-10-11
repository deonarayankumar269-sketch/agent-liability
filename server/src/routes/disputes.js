import { Router } from 'express';
import { AgentAction } from '../models/AgentAction.js';
import { Dispute } from '../models/Dispute.js';
import { buildSimulatedDispute, handleDisputeCreated } from '../services/disputeService.js';
import { HttpError, findOr404, wrap } from '../utils/http.js';

const router = Router();

function withAction(d, actions) {
  const a = actions.find((x) => String(x._id) === String(d.agentActionId));
  return {
    ...d.toJSON(),
    action: a ? { _id: a._id, item: a.item, merchant: a.merchant, amount: a.amount.toString(), currency: a.currency, captureId: a.captureId, delivery: a.delivery } : null,
  };
}

router.get('/', wrap(async (req, res) => {
  const list = await Dispute.find().sort({ createdAt: -1 }).limit(100);
  const actions = await AgentAction.find({ _id: { $in: list.map((d) => d.agentActionId).filter(Boolean) } });
  res.json(list.map((d) => withAction(d, actions)));
}));

// lets you demo the whole dispute path without waiting for a real sandbox dispute
router.post('/simulate', wrap(async (req, res) => {
  const { agentActionId, reason, carrierStatus } = req.body || {};
  const action = await findOr404(AgentAction, agentActionId, 'action');
  if (action.status !== 'captured' || !action.captureId) {
    throw new HttpError(400, 'only captured purchases can be disputed');
  }
  const detail = buildSimulatedDispute(action, { reason, carrierStatus });
  const dispute = await handleDisputeCreated(detail.dispute_id, { simulatedDetail: detail });
  res.status(201).json(withAction(dispute, [action]));
}));

router.get('/:id', wrap(async (req, res) => {
  const d = await findOr404(Dispute, req.params.id, 'dispute');
  const actions = d.agentActionId ? await AgentAction.find({ _id: d.agentActionId }) : [];
  res.json(withAction(d, actions));
}));

export default router;
