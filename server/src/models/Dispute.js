import mongoose from 'mongoose';
import { decimalJson } from '../utils/money.js';

const schema = new mongoose.Schema({
  paypalDisputeId: { type: String, required: true, unique: true },
  agentActionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentAction', index: true },
  status: { type: String, enum: ['OPEN', 'UNDER_REVIEW', 'NEEDS_REVIEW', 'RESOLVED'], default: 'OPEN' },
  reason: String,
  amount: mongoose.Schema.Types.Decimal128,
  currency: String,
  source: { type: String, enum: ['webhook', 'simulated'], default: 'webhook' },
  carrierStatus: String,
  allowedActions: [String],
  aiVerdict: mongoose.Schema.Types.Mixed,
  evidenceSubmitted: { type: Boolean, default: false },
  paypalActions: [{
    _id: false,
    action: String,
    ok: Boolean,
    detail: String,
    at: { type: Date, default: Date.now },
  }],
  outcome: String,
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
}, { minimize: false });
decimalJson(schema);

export const Dispute = mongoose.model('Dispute', schema);
