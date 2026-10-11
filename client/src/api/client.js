export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `request failed (${status})`);
    this.status = status;
    this.data = data;
  }
}

async function req(method, path, body, headers = {}) {
  const hasBody = body !== undefined;
  const res = await fetch('/api' + path, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const newKey = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const api = {
  status: () => req('GET', '/status'),
  mandates: () => req('GET', '/mandates'),
  createMandate: (body) => req('POST', '/mandates', body),
  revokeMandate: (id) => req('POST', `/mandates/${id}/revoke`, {}),
  revokeAll: () => req('POST', '/mandates/revoke-all', {}),
  orders: () => req('GET', '/orders'),
  purchase: (body, key = newKey()) => req('POST', '/orders', body, { 'Idempotency-Key': key }),
  deliver: (id, body = {}) => req('POST', `/orders/${id}/deliver`, body),
  capture: (id) => req('POST', `/orders/${id}/capture`, {}),
  voidOrder: (id) => req('POST', `/orders/${id}/void`, {}),
  disputes: () => req('GET', '/disputes'),
  simulateDispute: (body) => req('POST', '/disputes/simulate', body),
  audit: () => req('GET', '/audit'),
  verifyAudit: (tamper) => req('GET', '/audit/verify' + (tamper ? `?tamper=${encodeURIComponent(tamper)}` : '')),
  reset: () => req('POST', '/system/reset', {}),
};
