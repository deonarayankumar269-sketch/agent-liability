import mongoose from 'mongoose';
import { decimalJson } from '../utils/money.js';

const schema = new mongoose.Schema({
  userId: { type: String, default: 'demo-user', index: true },
  agentId: { type: String, required: true },
  description: String,
  maxAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'USD' },
  merchantAllowlist: [String],
  expiresAt: { type: Date, required: true },
  signature: { type: String, required: true },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  revokedAt: Date,
  createdAt: { type: Date, default: Date.now },
});
decimalJson(schema);

export const Mandate = mongoose.model('Mandate', schema);
