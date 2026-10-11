import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(here, '../..');
dotenv.config({ path: path.join(rootDir, '.env') });

const env = process.env;
const port = Number(env.PORT) || 4000;
const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const clientDist = path.join(rootDir, 'client/dist');
const hasBuiltClient = fs.existsSync(path.join(clientDist, 'index.html'));

const seedRaw = env.SIGNING_SEED || env.AUDIT_HMAC_SECRET || 'dev-only-seed';
const signingSeed = /^[0-9a-f]{64}$/i.test(seedRaw)
  ? seedRaw
  : crypto.createHash('sha256').update(seedRaw).digest('hex');

const hasPaypalKeys = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
let paypalMode = (env.PAYPAL_MODE || 'auto').toLowerCase();
if (paypalMode === 'auto') paypalMode = hasPaypalKeys ? 'sandbox' : 'simulated';
if (paypalMode === 'sandbox' && !hasPaypalKeys) {
  console.warn('[config] PAYPAL_MODE=sandbox but client id/secret missing, falling back to simulated');
  paypalMode = 'simulated';
}

export const config = {
  port,
  publicUrl,
  clientDist,
  hasBuiltClient,
  clientUrl: (env.CLIENT_URL || (hasBuiltClient ? publicUrl : 'http://localhost:5173')).replace(/\/$/, ''),
  mongoUri: (env.MONGODB_URI || '').trim(),
  signingSeed,
  auditSecret: env.AUDIT_HMAC_SECRET || 'dev-audit-secret',
  allowDemoReset: env.ALLOW_DEMO_RESET !== 'false',
  autoDisputeActions: env.AUTO_DISPUTE_ACTIONS !== 'false',
  paypal: {
    mode: paypalMode,
    simulated: paypalMode === 'simulated',
    base: 'https://api-m.sandbox.paypal.com',
    clientId: env.PAYPAL_CLIENT_ID || '',
    secret: env.PAYPAL_CLIENT_SECRET || '',
    webhookId: env.PAYPAL_WEBHOOK_ID || '',
    allowUnsignedWebhooks: paypalMode === 'simulated' || env.ALLOW_UNSIGNED_WEBHOOKS === 'true',
  },
  ai: {
    groqKey: env.GROQ_API_KEY || '',
    groqModel: env.GROQ_MODEL || 'openai/gpt-oss-120b',
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || 'gemini-flash-latest',
  },
};
