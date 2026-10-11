import crypto from 'node:crypto';
import { Mandate } from '../models/Mandate.js';
import { AgentAction } from '../models/AgentAction.js';
import { config } from '../config.js';
import { stableStringify } from '../utils/stable.js';
import { HttpError } from '../utils/http.js';
import { cents, dec, money, num } from '../utils/money.js';
import * as audit from './auditChain.js';

// raw 32 byte seed -> ed25519 key via the fixed pkcs8 header
const PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_HEADER, Buffer.from(config.signingSeed, 'hex')]),
  format: 'der',
  type: 'pkcs8',
});
const publicKey = crypto.createPublicKey(privateKey);

const COUNTED = ['pending_approval', 'authorized', 'captured'];

function canonical(m) {
  return stableStringify({
    id: String(m._id),
    userId: m.userId,
    agentId: m.agentId,
    maxAmount: money(num(m.maxAmount)),
    currency: m.currency,
    merchants: m.merchantAllowlist.map((x) => x.toLowerCase()).sort(),
    expiresAt: new Date(m.expiresAt).toISOString(),
    createdAt: new Date(m.createdAt).toISOString(),
  });
}

export function verifySignature(m) {
  try {
    return crypto.verify(null, Buffer.from(canonical(m)), publicKey, Buffer.from(m.signature, 'base64'));
  } catch {
    return false;
  }
}

export async function createMandate({ userId, agentId, maxAmount, currency, merchants, hours, description }) {
  const max = Number(maxAmount);
  const ttl = Number(hours);
  const list = (Array.isArray(merchants) ? merchants : String(merchants || '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);

  if (!agentId || !String(agentId).trim()) throw new HttpError(400, 'agentId is required');
  if (!Number.isFinite(max) || max <= 0) throw new HttpError(400, 'maxAmount must be a positive number');
  if (!list.length) throw new HttpError(400, 'at least one allowed merchant is required');
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 24 * 30) throw new HttpError(400, 'expiry must be between 0 and 720 hours');

  const m = new Mandate({
    userId: userId || 'demo-user',
    agentId: String(agentId).trim(),
    description: description ? String(description).slice(0, 200) : undefined,
    maxAmount: dec(max),
    currency: 'USD',
    merchantAllowlist: list,
    expiresAt: new Date(Date.now() + ttl * 3600 * 1000),
    signature: 'pending',
  });
  m.createdAt = new Date();
  m.signature = crypto.sign(null, Buffer.from(canonical(m)), privateKey).toString('base64');
  await m.save();

  await audit.append('mandate_created', {
    mandateId: String(m._id),
    agentId: m.agentId,
    maxAmount: money(max),
    currency: m.currency,
    merchants: list,
    expiresAt: m.expiresAt.toISOString(),
    signature: m.signature,
  });
  return m;
}

export async function refreshStatus(m) {
  if (m.status === 'active' && m.expiresAt.getTime() <= Date.now()) {
    m.status = 'expired';
    await m.save();
    await audit.append('mandate_expired', { mandateId: String(m._id) });
  }
  return m;
}

export function liveViolations(m) {
  const v = [];
  if (!verifySignature(m)) v.push('SIGNATURE_INVALID: mandate was modified after signing');
  if (m.status === 'revoked') v.push('MANDATE_REVOKED');
  if (m.status === 'expired' || m.expiresAt.getTime() <= Date.now()) v.push('MANDATE_EXPIRED');
  return v;
}

export async function committedAmount(mandateId) {
  const rows = await AgentAction.find({ mandateId, status: { $in: COUNTED } }, 'amount');
  return rows.reduce((sum, r) => sum + cents(num(r.amount)), 0) / 100;
}

export async function validateAction(m, { amount, merchant, currency }) {
  const violations = liveViolations(m);
  const allow = m.merchantAllowlist.map((x) => x.toLowerCase());
  const max = num(m.maxAmount);
  const committed = await committedAmount(m._id);
  const remaining = (cents(max) - cents(committed)) / 100;

  if (currency && currency !== m.currency) violations.push(`CURRENCY_MISMATCH: ${currency} vs ${m.currency}`);
  if (!allow.includes(String(merchant).trim().toLowerCase())) {
    violations.push(`MERCHANT_NOT_ALLOWED: ${merchant} not in [${m.merchantAllowlist.join(', ')}]`);
  }
  if (cents(amount) > cents(remaining)) {
    violations.push(`AMOUNT_EXCEEDED: $${money(amount)} > $${money(remaining)} remaining of $${money(max)} max`);
  }
  return { ok: violations.length === 0, violations, committed, remaining };
}

export async function revokeMandate(m, reason = 'manual') {
  if (m.status === 'revoked') return m;
  m.status = 'revoked';
  m.revokedAt = new Date();
  await m.save();
  await audit.append('mandate_revoked', { mandateId: String(m._id), reason });
  return m;
}

export async function describe(m) {
  const committed = await committedAmount(m._id);
  const max = num(m.maxAmount);
  return {
    ...m.toJSON(),
    committed: money(committed),
    remaining: money((cents(max) - cents(committed)) / 100),
    signatureValid: verifySignature(m),
  };
}
