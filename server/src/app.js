import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDb } from './db.js';
import { AuditEntry } from './models/AuditEntry.js';
import * as audit from './services/auditChain.js';
import { expireStale } from './services/orderService.js';
import { paypalWebhook } from './webhooks/paypalWebhook.js';
import mandates from './routes/mandates.js';
import orders from './routes/orders.js';
import disputes from './routes/disputes.js';
import auditRoutes from './routes/audit.js';
import system from './routes/system.js';

const app = express();
app.use(cors());
app.post('/api/webhooks/paypal', express.raw({ type: '*/*', limit: '1mb' }), paypalWebhook);
app.use(express.json({ limit: '1mb' }));

app.use('/api/mandates', mandates);
app.use('/api/orders', orders);
app.use('/api/disputes', disputes);
app.use('/api/audit', auditRoutes);
app.use('/api', system);

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

if (config.hasBuiltClient) {
  app.use(express.static(config.clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message, ...(err.data || {}) });
});

async function main() {
  await connectDb();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  if (!(await AuditEntry.countDocuments())) await audit.append('chain_initialized', { version: 1 });

  await expireStale();
  setInterval(() => expireStale().catch((e) => console.error('[expire]', e.message)), 60 * 60 * 1000);

  app.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port}`);
    console.log(`[server] paypal: ${config.paypal.mode} | groq: ${config.ai.groqKey ? 'on' : 'off'} | gemini: ${config.ai.geminiKey ? 'on' : 'off'}`);
    if (!config.hasBuiltClient) console.log('[server] no client build found, run the client with `npm run dev` (http://localhost:5173)');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
