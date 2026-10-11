import { Router } from 'express';
import { AuditEntry } from '../models/AuditEntry.js';
import { verifyChain } from '../services/auditChain.js';
import { wrap } from '../utils/http.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 300, 1000);
  const rows = await AuditEntry.find().sort({ seq: -1 }).limit(limit).lean();
  res.json(rows);
}));

// ?tamper=<seq> pretends that entry was edited, nothing is written
router.get('/verify', wrap(async (req, res) => {
  res.json(await verifyChain({ tamperSeq: req.query.tamper }));
}));

export default router;
