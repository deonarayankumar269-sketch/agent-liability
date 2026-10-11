import crypto from 'node:crypto';
import { AuditEntry } from '../models/AuditEntry.js';
import { config } from '../config.js';
import { stableStringify } from '../utils/stable.js';

const GENESIS = '0'.repeat(64);
let queue = Promise.resolve();

function hashOf({ seq, eventType, payload, previousHash, timestamp }) {
  const body = [seq, eventType, stableStringify(payload ?? {}), previousHash, new Date(timestamp).toISOString()].join('|');
  return crypto.createHmac('sha256', config.auditSecret).update(body).digest('hex');
}

// one writer at a time, otherwise two appends grab the same previous entry and the chain forks
export function append(eventType, payload = {}) {
  const run = queue.then(async () => {
    const last = await AuditEntry.findOne().sort({ seq: -1 }).lean();
    const seq = last ? last.seq + 1 : 1;
    const previousHash = last ? last.currentHash : GENESIS;
    const clean = JSON.parse(JSON.stringify(payload));
    const timestamp = new Date();
    const currentHash = hashOf({ seq, eventType, payload: clean, previousHash, timestamp });
    return AuditEntry.create({ seq, eventType, payload: clean, previousHash, currentHash, timestamp });
  });
  queue = run.catch(() => {});
  return run;
}

export async function verifyChain({ tamperSeq } = {}) {
  const entries = await AuditEntry.find().sort({ seq: 1 }).lean();
  const problems = [];
  let prev = GENESIS;

  entries.forEach((e, i) => {
    let payload = e.payload ?? {};
    if (tamperSeq && e.seq === Number(tamperSeq)) payload = { ...payload, __tampered: true };
    if (e.seq !== i + 1) problems.push({ seq: e.seq, reason: 'sequence_gap' });
    if (e.previousHash !== prev) problems.push({ seq: e.seq, reason: 'previous_hash_mismatch' });
    if (hashOf({ ...e, payload }) !== e.currentHash) problems.push({ seq: e.seq, reason: 'hash_mismatch' });
    prev = e.currentHash;
  });

  return { valid: problems.length === 0, length: entries.length, headHash: prev, problems, simulatedTamper: tamperSeq ? Number(tamperSeq) : null };
}
