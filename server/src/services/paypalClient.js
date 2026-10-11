import crypto from 'node:crypto';
import { config } from '../config.js';
import { money } from '../utils/money.js';

const { base, clientId, secret, webhookId, simulated } = config.paypal;
let token = { value: null, exp: 0 };

export class PayPalError extends Error {
  constructor(where, status, data) {
    const hint = data?.details?.[0]?.description || data?.message || data?.name || '';
    super(`PayPal ${where} -> ${status} ${hint}`.trim());
    this.status = 502;
    this.paypalStatus = status;
    this.data = data;
  }
}

const rid = (p) => `${p}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

function parse(text) {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function getToken() {
  if (token.value && Date.now() < token.exp - 30000) return token.value;
  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = parse(await res.text());
  if (!res.ok) throw new PayPalError('oauth', res.status, data);
  token = { value: data.access_token, exp: Date.now() + Number(data.expires_in || 300) * 1000 };
  return token.value;
}

async function call(method, path, body, requestId) {
  const t = await getToken();
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = parse(await res.text());
  if (!res.ok) throw new PayPalError(path, res.status, data);
  return data;
}

async function createOrder({ amount, currency, merchant, item, customId, requestId }) {
  if (simulated) return { id: rid('SIM-ORD'), approvalUrl: null, status: 'CREATED' };

  const order = await call('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{
      reference_id: customId,
      custom_id: customId,
      description: `${item} @ ${merchant}`.slice(0, 127),
      amount: { currency_code: 'USD', value: money(amount) },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${config.publicUrl}/api/orders/return`,
          cancel_url: `${config.publicUrl}/api/orders/cancel`,
        },
      },
    },
  }, requestId);

  const link = (order.links || []).find((l) => ['payer-action', 'approve'].includes(l.rel));
  return { id: order.id, approvalUrl: link?.href || null, status: order.status };
}

async function authorizeOrder(orderId, requestId) {
  if (simulated) return { authorizationId: rid('SIM-AUTH'), status: 'CREATED' };
  const res = await call('POST', `/v2/checkout/orders/${orderId}/authorize`, {}, requestId);
  const auth = res.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new PayPalError('authorize', 422, { message: 'no authorization in response, buyer may not have approved yet' });
  return { authorizationId: auth.id, status: auth.status };
}

async function captureAuthorization(authId, { amount, currency, requestId }) {
  if (simulated) return { captureId: rid('SIM-CAP'), status: 'COMPLETED' };
  const res = await call('POST', `/v2/payments/authorizations/${authId}/capture`, {
    amount: { currency_code: currency, value: money(amount) },
    final_capture: true,
  }, requestId);
  return { captureId: res.id, status: res.status };
}

async function voidAuthorization(authId, requestId) {
  if (simulated) return { status: 'VOIDED' };
  await call('POST', `/v2/payments/authorizations/${authId}/void`, undefined, requestId);
  return { status: 'VOIDED' };
}

async function getDispute(id) {
  if (simulated) throw new PayPalError('getDispute', 404, { message: 'simulated mode has no real PayPal disputes, use /api/disputes/simulate' });
  return call('GET', `/v1/customer/disputes/${id}`);
}

async function provideEvidence(id, { tracking, carrier, notes, fake }) {
  if (simulated || fake) return { simulated: true };
  const info = tracking ? { tracking_info: [{ carrier_name: 'OTHER', carrier_name_other: carrier || 'unknown', tracking_number: tracking }] } : undefined;
  return call('POST', `/v1/customer/disputes/${id}/provide-evidence`, {
    evidences: [{ evidence_type: 'PROOF_OF_FULFILLMENT', evidence_info: info, notes: String(notes).slice(0, 2000) }],
  });
}

async function acceptClaim(id, { note, reason, fake }) {
  if (simulated || fake) return { simulated: true };
  return call('POST', `/v1/customer/disputes/${id}/accept-claim`, {
    note: String(note).slice(0, 2000),
    accept_claim_reason: reason || 'NOT_ABLE_TO_WIN',
  });
}

async function verifyWebhook(headers, event) {
  if (!webhookId) return false;
  const res = await call('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: event,
  });
  return res.verification_status === 'SUCCESS';
}

export const paypal = {
  mode: config.paypal.mode,
  simulated,
  createOrder,
  authorizeOrder,
  captureAuthorization,
  voidAuthorization,
  getDispute,
  provideEvidence,
  acceptClaim,
  verifyWebhook,
};
