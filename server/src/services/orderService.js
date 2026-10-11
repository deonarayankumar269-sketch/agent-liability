import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AgentAction } from '../models/AgentAction.js';
import { Mandate } from '../models/Mandate.js';
import { HttpError, findOr404 } from '../utils/http.js';
import { dec, money, num } from '../utils/money.js';
import { paypal } from './paypalClient.js';
import * as engine from './mandateEngine.js';
import * as audit from './auditChain.js';
import * as verifier from './aiVerifier.js';

const STEPS = ['mandate_check', 'paypal_hold', 'delivery', 'ai_check', 'capture'];

function setStep(action, step, status, detail = '') {
  const found = action.pipeline.find((s) => s.step === step);
  if (found) {
    found.status = status;
    found.detail = detail;
    found.at = new Date();
  } else {
    action.pipeline.push({ step, status, detail, at: new Date() });
  }
}

const ids = (action) => ({ agentActionId: String(action._id), mandateId: String(action.mandateId) });

async function failAction(action, step, err) {
  action.status = 'failed';
  action.aiReason = err.message;
  setStep(action, step, 'failed', err.message);
  await action.save();
  await audit.append('action_failed', { ...ids(action), step, error: err.message });
  throw new HttpError(502, err.message, { action });
}

async function authorizeNow(action) {
  let auth;
  try {
    auth = await paypal.authorizeOrder(action.paypalOrderId, `auth-${action._id}`);
  } catch (err) {
    return failAction(action, 'paypal_hold', err);
  }
  action.authorizationId = auth.authorizationId;
  action.status = 'authorized';
  setStep(action, 'paypal_hold', 'ok', `$${money(num(action.amount))} on hold${paypal.simulated ? ' (simulated)' : ''}`);
  await action.save();
  await audit.append('action_authorized', {
    ...ids(action),
    paypalOrderId: action.paypalOrderId,
    authorizationId: action.authorizationId,
    amount: money(num(action.amount)),
    merchant: action.merchant,
    simulated: paypal.simulated,
  });
  return action;
}

export async function createPurchase({ mandateId, merchant, item, amount, currency, autoComplete }) {
  if (!mongoose.isValidObjectId(mandateId)) throw new HttpError(400, 'mandateId missing or invalid');
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new HttpError(400, 'amount must be a positive number');
  if (!merchant || typeof merchant !== 'string') throw new HttpError(400, 'merchant is required');

  const mandate = await Mandate.findById(mandateId);
  if (!mandate) throw new HttpError(404, 'mandate not found');
  await engine.refreshStatus(mandate);

  const cur = String(currency || mandate.currency).toUpperCase();
  const check = await engine.validateAction(mandate, { amount: amt, merchant, currency: cur });

  const action = new AgentAction({
    mandateId: mandate._id,
    amount: dec(amt),
    currency: cur,
    merchant: merchant.trim(),
    item: String(item || 'item').slice(0, 120),
    status: 'pending_approval',
    simulated: paypal.simulated,
    pipeline: STEPS.map((step) => ({ step, status: 'pending', detail: '' })),
  });

  if (!check.ok) {
    action.status = 'blocked';
    action.violations = check.violations;
    action.aiCheckPassed = false;
    action.aiReason = 'Blocked by the mandate engine before any PayPal request was made.';
    setStep(action, 'mandate_check', 'failed', check.violations.join(' | '));
    for (const s of STEPS.slice(1)) setStep(action, s, 'skipped', 'blocked before PayPal');
    await action.save();
    await audit.append('action_blocked', {
      ...ids(action),
      amount: money(amt),
      merchant: action.merchant,
      violations: check.violations,
    });
    return { blocked: true, action, violations: check.violations };
  }

  setStep(action, 'mandate_check', 'ok', `inside mandate, $${money(check.remaining)} was available`);
  await action.save();

  let order;
  try {
    order = await paypal.createOrder({
      amount: amt, currency: cur, merchant: action.merchant, item: action.item,
      customId: String(action._id), requestId: `order-${action._id}`,
    });
  } catch (err) {
    return failAction(action, 'paypal_hold', err);
  }
  action.paypalOrderId = order.id;
  action.approvalUrl = order.approvalUrl || undefined;

  if (paypal.simulated) {
    await authorizeNow(action);
  } else {
    setStep(action, 'paypal_hold', 'pending', 'waiting for PayPal buyer approval');
    await action.save();
    await audit.append('action_pending_approval', { ...ids(action), paypalOrderId: order.id, amount: money(amt) });
  }

  if (autoComplete && action.status === 'authorized') {
    await recordDelivery(action._id, { delivered: true });
    await captureAction(action._id);
  }
  return { blocked: false, action: await AgentAction.findById(action._id) };
}

export async function completeApproval(paypalOrderId) {
  const action = await AgentAction.findOne({ paypalOrderId });
  if (!action) throw new HttpError(404, 'no agent action for this PayPal order');
  if (action.status !== 'pending_approval') return action;

  const mandate = await Mandate.findById(action.mandateId);
  await engine.refreshStatus(mandate);
  const problems = engine.liveViolations(mandate);
  if (problems.length) {
    action.status = 'voided';
    setStep(action, 'paypal_hold', 'failed', `mandate no longer valid: ${problems.join(', ')}`);
    await action.save();
    await audit.append('action_voided', { ...ids(action), reason: problems.join(', ') });
    return action;
  }
  return authorizeNow(action);
}

export async function recordDelivery(actionId, { delivered = true, tracking, carrier, notes } = {}) {
  const action = await findOr404(AgentAction, actionId, 'action');
  if (action.status !== 'authorized') throw new HttpError(409, `cannot record delivery on a ${action.status} action`);

  const ok = delivered !== false;
  action.delivery = {
    delivered: ok,
    tracking: ok ? (tracking || `TRK${crypto.randomBytes(4).toString('hex').toUpperCase()}`) : undefined,
    carrier: carrier || 'MockShip',
    notes,
    deliveredAt: ok ? new Date() : undefined,
  };
  setStep(action, 'delivery', ok ? 'ok' : 'failed', ok ? `delivered, tracking ${action.delivery.tracking}` : 'merchant reports not delivered');
  await action.save();
  await audit.append('delivery_recorded', { ...ids(action), delivered: ok, tracking: action.delivery.tracking, carrier: action.delivery.carrier });
  return action;
}

export async function captureAction(actionId) {
  const action = await findOr404(AgentAction, actionId, 'action');
  if (action.status !== 'authorized') throw new HttpError(409, `cannot capture a ${action.status} action`);
  const mandate = await Mandate.findById(action.mandateId);

  const check = await verifier.verifyCapture(action, mandate);
  action.aiCheckPassed = check.passed;
  action.aiReason = check.reason;
  setStep(action, 'ai_check', check.passed ? 'ok' : 'failed', check.reason);
  await audit.append('ai_check_completed', { ...ids(action), passed: check.passed, reason: check.reason, provider: check.provider });

  if (!check.passed) {
    setStep(action, 'capture', 'skipped', 'funds stay on hold, AI check did not pass');
    await action.save();
    return action;
  }

  try {
    const cap = await paypal.captureAuthorization(action.authorizationId, {
      amount: num(action.amount), currency: action.currency, requestId: `cap-${action._id}`,
    });
    action.captureId = cap.captureId;
    action.status = 'captured';
    setStep(action, 'capture', 'ok', `captured ${cap.captureId}${paypal.simulated ? ' (simulated)' : ''}`);
  } catch (err) {
    setStep(action, 'capture', 'failed', err.message);
    await action.save();
    throw new HttpError(502, err.message, { action });
  }
  await action.save();
  await audit.append('captured', { ...ids(action), captureId: action.captureId, amount: money(num(action.amount)) });
  return action;
}

export async function voidAction(actionId, reason = 'manual void') {
  const action = await findOr404(AgentAction, actionId, 'action');
  if (!['authorized', 'pending_approval'].includes(action.status)) {
    throw new HttpError(409, `cannot void a ${action.status} action`);
  }
  if (action.authorizationId) {
    try {
      await paypal.voidAuthorization(action.authorizationId, `void-${action._id}`);
    } catch (err) {
      throw new HttpError(502, err.message);
    }
  }
  action.status = 'voided';
  for (const s of action.pipeline) if (s.status === 'pending') { s.status = 'skipped'; s.detail = reason; }
  await action.save();
  await audit.append('action_voided', { ...ids(action), reason });
  return action;
}

export async function voidOpenActions(mandateId, reason) {
  const open = await AgentAction.find({ mandateId, status: { $in: ['authorized', 'pending_approval'] } });
  const results = [];
  for (const a of open) {
    try {
      await voidAction(a._id, reason);
      results.push({ id: String(a._id), ok: true });
    } catch (err) {
      results.push({ id: String(a._id), ok: false, error: err.message });
    }
  }
  return results;
}

// paypal: order approval window is hours, an authorization is capturable for 29 days
export async function expireStale() {
  const authCut = new Date(Date.now() - 29 * 24 * 3600 * 1000);
  const pendCut = new Date(Date.now() - 3 * 3600 * 1000);
  const stale = await AgentAction.find({
    $or: [
      { status: 'authorized', createdAt: { $lt: authCut } },
      { status: 'pending_approval', createdAt: { $lt: pendCut } },
    ],
  });
  for (const a of stale) {
    a.status = 'expired';
    await a.save();
    await audit.append('action_expired', ids(a));
  }
  return stale.length;
}
