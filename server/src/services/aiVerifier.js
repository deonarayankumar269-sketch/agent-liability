import { AuditEntry } from '../models/AuditEntry.js';
import { askJson } from './aiRouter.js';
import * as engine from './mandateEngine.js';
import * as chain from './auditChain.js';
import { cents, money, num } from '../utils/money.js';

const VERDICTS = ['LIABLE_USER', 'LIABLE_AGENT', 'LIABLE_MERCHANT', 'SPLIT'];

async function collectFacts(action, mandate, { carrierStatus } = {}) {
  const at = new Date(action.createdAt);
  const d = action.delivery || {};
  const allow = mandate.merchantAllowlist.map((m) => m.toLowerCase());

  const [mandateEvt, actionEvt, ch] = await Promise.all([
    AuditEntry.exists({ eventType: 'mandate_created', 'payload.mandateId': String(mandate._id) }),
    AuditEntry.exists({ eventType: 'action_authorized', 'payload.agentActionId': String(action._id) }),
    chain.verifyChain(),
  ]);

  return {
    signatureValid: engine.verifySignature(mandate),
    withinAmount: cents(num(action.amount)) <= cents(num(mandate.maxAmount)),
    merchantAllowed: allow.includes(String(action.merchant).toLowerCase()),
    activeAtTime: at <= mandate.expiresAt && (!mandate.revokedAt || at < mandate.revokedAt),
    notRevokedNow: mandate.status !== 'revoked',
    deliveryProven: Boolean(d.delivered && d.tracking) && carrierStatus !== 'NOT_DELIVERED',
    evidenceComplete: Boolean(mandateEvt && actionEvt) && ch.valid,
    auditChainValid: ch.valid,
    auditEntries: ch.length,
  };
}

function ruleVerdict(f) {
  const basis = [];
  if (!f.signatureValid) basis.push('mandate signature does not verify');
  if (!f.withinAmount) basis.push('amount above mandate limit');
  if (!f.merchantAllowed) basis.push('merchant not on allowlist');
  if (!f.activeAtTime) basis.push('mandate was not active when the agent acted');
  if (basis.length) return { verdict: 'LIABLE_AGENT', basis };
  if (!f.evidenceComplete) return { verdict: 'SPLIT', basis: ['audit evidence incomplete or chain failed verification'] };
  if (!f.deliveryProven) return { verdict: 'LIABLE_MERCHANT', basis: ['no delivery proof or carrier reports not delivered'] };
  return { verdict: 'LIABLE_USER', basis: ['agent stayed inside the signed mandate and delivery is documented'] };
}

function ruleText(verdict, basis, action) {
  const amt = `$${money(num(action.amount))}`;
  switch (verdict) {
    case 'LIABLE_USER':
      return `The agent bought ${amt} at ${action.merchant} inside the signed mandate (limit, merchant and expiry all valid). The mandate signature proves the user delegated this authority and delivery is documented, so the charge stands with the user.`;
    case 'LIABLE_AGENT':
      return `The agent acted outside its authority: ${basis.join('; ')}. The user never delegated this, so liability sits with the agent operator.`;
    case 'LIABLE_MERCHANT':
      return `The agent acted within the mandate, but the merchant cannot prove delivery of the ${amt} order (${basis.join('; ')}). Merchant is liable.`;
    default:
      return `Evidence cannot be fully trusted: ${basis.join('; ')}. Escalating to manual review instead of guessing.`;
  }
}

function evidencePoints(f, action) {
  const d = action.delivery || {};
  return [
    f.signatureValid ? 'Mandate signature verifies (Ed25519)' : 'Mandate signature FAILED verification',
    f.withinAmount ? 'Amount within mandate limit' : 'Amount exceeds mandate limit',
    f.merchantAllowed ? `${action.merchant} is on the allowlist` : `${action.merchant} is NOT on the allowlist`,
    f.activeAtTime ? 'Mandate was active when the agent acted' : 'Mandate was not active at action time',
    f.deliveryProven ? `Delivery proven, tracking ${d.tracking}` : 'No usable delivery proof',
    f.evidenceComplete ? `Audit chain intact (${f.auditEntries} entries)` : 'Audit evidence incomplete or chain broken',
  ];
}

const VERDICT_SYSTEM = `You are the liability verifier of an agentic-commerce platform. The facts below were computed by code and are authoritative, never recompute or contradict them. Your job is to write the verdict explanation.
Reply with JSON only: {"verdict":"LIABLE_USER|LIABLE_AGENT|LIABLE_MERCHANT|SPLIT","confidence":0.0-1.0,"reasoning":"2-4 plain sentences","evidencePoints":["short point", "..."]}`;

const CAPTURE_SYSTEM = `You are a payment release checker for an AI shopping agent. The checks below were computed by code and are authoritative. Write a short explanation of why the payment is or is not released.
Reply with JSON only: {"reasoning":"1-2 plain sentences"}`;

export async function verifyDispute({ action, mandate, dispute }) {
  if (!action || !mandate) {
    return {
      verdict: 'SPLIT', confidence: 0.3, provider: 'rules', llmVerdict: null, llmAgrees: null,
      reasoning: 'The disputed transaction could not be matched to any agent action or mandate in this system. Manual review needed.',
      evidencePoints: ['No matching agent action found for this dispute'],
      checks: {}, generatedAt: new Date().toISOString(),
    };
  }

  const facts = await collectFacts(action, mandate, { carrierStatus: dispute?.carrierStatus });
  const rule = ruleVerdict(facts);
  const base = {
    verdict: rule.verdict,
    confidence: rule.verdict === 'SPLIT' ? 0.4 : 0.9,
    reasoning: ruleText(rule.verdict, rule.basis, action),
    evidencePoints: evidencePoints(facts, action),
    checks: facts,
    provider: 'rules',
    llmVerdict: null,
    llmAgrees: null,
    generatedAt: new Date().toISOString(),
  };

  const ai = await askJson(VERDICT_SYSTEM, JSON.stringify({
    disputeReason: dispute?.reason,
    carrierStatus: dispute?.carrierStatus || 'unknown',
    mandate: { agentId: mandate.agentId, max: money(num(mandate.maxAmount)), merchants: mandate.merchantAllowlist, expiresAt: mandate.expiresAt },
    action: { amount: money(num(action.amount)), merchant: action.merchant, item: action.item, delivery: action.delivery || null },
    facts,
    ruleVerdict: rule,
  }));
  if (!ai) return base;

  const j = ai.json;
  const llmVerdict = VERDICTS.includes(String(j.verdict).toUpperCase()) ? String(j.verdict).toUpperCase() : null;
  return {
    ...base,
    provider: ai.provider,
    llmVerdict,
    llmAgrees: llmVerdict === rule.verdict,
    reasoning: typeof j.reasoning === 'string' && j.reasoning.length > 20 ? j.reasoning : base.reasoning,
    confidence: Number.isFinite(Number(j.confidence)) ? Math.min(1, Math.max(0, Number(j.confidence))) : base.confidence,
  };
}

export async function verifyCapture(action, mandate) {
  const facts = await collectFacts(action, mandate);
  const failing = [];
  if (!facts.signatureValid) failing.push('mandate signature invalid');
  if (!facts.withinAmount) failing.push('amount above mandate limit');
  if (!facts.merchantAllowed) failing.push('merchant not on allowlist');
  if (!facts.activeAtTime) failing.push('mandate not active at action time');
  if (!facts.notRevokedNow) failing.push('mandate was revoked');
  if (!facts.deliveryProven) failing.push('no delivery proof yet');

  const passed = failing.length === 0;
  const d = action.delivery || {};
  let reason = passed
    ? `Mandate signature valid, $${money(num(action.amount))} within the $${money(num(mandate.maxAmount))} limit, ${action.merchant} on allowlist, mandate active, delivery confirmed (${d.tracking}). Releasing payment.`
    : `Payment held: ${failing.join(', ')}.`;

  let provider = 'rules';
  const ai = await askJson(CAPTURE_SYSTEM, JSON.stringify({ passed, failing, facts, merchant: action.merchant, amount: money(num(action.amount)) }));
  if (ai && typeof ai.json.reasoning === 'string' && ai.json.reasoning.length > 10) {
    reason = ai.json.reasoning;
    provider = ai.provider;
  }
  return { passed, reason, provider, checks: facts };
}
