import crypto from 'node:crypto';
import { AgentAction } from '../models/AgentAction.js';
import { Dispute } from '../models/Dispute.js';
import { Mandate } from '../models/Mandate.js';
import { config } from '../config.js';
import { dec, money, num } from '../utils/money.js';
import { paypal } from './paypalClient.js';
import * as audit from './auditChain.js';
import * as verifier from './aiVerifier.js';
import * as chain from './auditChain.js';

function logAction(dispute, action, ok, detail) {
  dispute.paypalActions.push({ action, ok, detail: String(detail).slice(0, 300), at: new Date() });
}

export function buildSimulatedDispute(action, { reason, carrierStatus } = {}) {
  return {
    dispute_id: `SIM-D-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    reason: reason || 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    dispute_amount: { currency_code: action.currency, value: money(num(action.amount)) },
    disputed_transactions: [{ seller_transaction_id: action.captureId }],
    links: [{ rel: 'provide-evidence' }, { rel: 'accept-claim' }],
    carrierStatus: carrierStatus || 'DELIVERED',
  };
}

export async function handleDisputeCreated(disputeId, { simulatedDetail } = {}) {
  const existing = await Dispute.findOne({ paypalDisputeId: disputeId });
  if (existing?.aiVerdict) return existing; // webhook retry

  const detail = simulatedDetail || await paypal.getDispute(disputeId);
  const captureId = detail.disputed_transactions?.[0]?.seller_transaction_id;
  const action = captureId ? await AgentAction.findOne({ captureId }) : null;
  const mandate = action ? await Mandate.findById(action.mandateId) : null;

  const dispute = existing || new Dispute({ paypalDisputeId: disputeId });
  dispute.agentActionId = action?._id;
  dispute.reason = detail.reason;
  dispute.amount = detail.dispute_amount?.value ? dec(detail.dispute_amount.value) : undefined;
  dispute.currency = detail.dispute_amount?.currency_code;
  dispute.source = simulatedDetail ? 'simulated' : 'webhook';
  dispute.carrierStatus = detail.carrierStatus;
  dispute.allowedActions = (detail.links || []).map((l) => l.rel).filter(Boolean); // HATEOAS: only do what paypal offers
  dispute.status = 'OPEN';
  await dispute.save();

  await audit.append('dispute_filed', {
    paypalDisputeId: disputeId,
    agentActionId: action ? String(action._id) : null,
    reason: detail.reason,
    amount: detail.dispute_amount?.value,
    allowedActions: dispute.allowedActions,
  });

  const verdict = await verifier.verifyDispute({ action, mandate, dispute });
  dispute.aiVerdict = verdict;
  await dispute.save();
  await audit.append('verdict_issued', {
    paypalDisputeId: disputeId,
    agentActionId: action ? String(action._id) : null,
    verdict: verdict.verdict,
    confidence: verdict.confidence,
    provider: verdict.provider,
  });

  if (config.autoDisputeActions) await actOnVerdict(dispute, action, verdict);
  else { dispute.status = 'NEEDS_REVIEW'; await dispute.save(); }
  return dispute;
}

async function actOnVerdict(dispute, action, verdict) {
  const allowed = new Set(dispute.allowedActions);
  const v = verdict.verdict;
  const fake = dispute.source === 'simulated';
  const head = (await chain.verifyChain()).headHash;

  try {
    if (v === 'LIABLE_USER' && allowed.has('provide-evidence')) {
      const d = action?.delivery || {};
      const notes = `Agent purchase executed inside a signed mandate (${action?.mandateId}). ${verdict.reasoning} Audit chain head ${head}.`;
      await paypal.provideEvidence(dispute.paypalDisputeId, { tracking: d.tracking, carrier: d.carrier, notes, fake });
      dispute.evidenceSubmitted = true;
      logAction(dispute, 'provide-evidence', true, notes);
      dispute.status = (paypal.simulated || fake) ? 'RESOLVED' : 'UNDER_REVIEW';
      dispute.outcome = (paypal.simulated || fake) ? 'MERCHANT_WINS (simulated)' : undefined;
    } else if ((v === 'LIABLE_MERCHANT' || v === 'LIABLE_AGENT') && allowed.has('accept-claim')) {
      const reason = v === 'LIABLE_MERCHANT' ? 'DID_NOT_SHIP_ITEM' : 'NOT_ABLE_TO_WIN';
      await paypal.acceptClaim(dispute.paypalDisputeId, { note: verdict.reasoning, reason, fake });
      logAction(dispute, 'accept-claim', true, reason);
      dispute.status = 'RESOLVED';
      dispute.outcome = 'BUYER_REFUNDED';
    } else {
      dispute.status = 'NEEDS_REVIEW';
      logAction(dispute, 'none', true, v === 'SPLIT' ? 'split verdict, left for manual review' : 'no matching action offered by PayPal for this dispute');
    }
  } catch (err) {
    dispute.status = 'NEEDS_REVIEW';
    logAction(dispute, 'paypal-call', false, err.message);
  }

  if (dispute.status === 'RESOLVED') dispute.resolvedAt = new Date();
  await dispute.save();
  await audit.append('dispute_updated', {
    paypalDisputeId: dispute.paypalDisputeId,
    status: dispute.status,
    evidenceSubmitted: dispute.evidenceSubmitted,
    lastAction: dispute.paypalActions.at(-1)?.action,
  });
}

export async function handleDisputeResolved(disputeId, resource = {}) {
  const dispute = await Dispute.findOne({ paypalDisputeId: disputeId });
  if (!dispute) return null;
  dispute.status = 'RESOLVED';
  dispute.outcome = resource.dispute_outcome?.outcome_code || dispute.outcome || 'RESOLVED';
  dispute.resolvedAt = new Date();
  await dispute.save();
  await audit.append('dispute_resolved', { paypalDisputeId: disputeId, outcome: dispute.outcome });
  return dispute;
}
