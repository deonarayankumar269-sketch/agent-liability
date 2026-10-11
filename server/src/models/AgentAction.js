import mongoose from 'mongoose';
import { decimalJson } from '../utils/money.js';

const stepSchema = new mongoose.Schema({
  step: String,
  status: { type: String, enum: ['pending', 'ok', 'failed', 'skipped'], default: 'pending' },
  detail: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  mandateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mandate', index: true, required: true },
  paypalOrderId: String,
  authorizationId: String,
  captureId: { type: String, index: true },
  approvalUrl: String,
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'USD' },
  merchant: { type: String, required: true },
  item: String,
  status: {
    type: String,
    enum: ['pending_approval', 'authorized', 'captured', 'blocked', 'expired', 'voided', 'failed'],
    default: 'pending_approval',
  },
  aiCheckPassed: Boolean,
  aiReason: String,
  violations: [String],
  simulated: { type: Boolean, default: false },
  delivery: {
    delivered: Boolean,
    tracking: String,
    carrier: String,
    notes: String,
    deliveredAt: Date,
  },
  pipeline: [stepSchema],
  createdAt: { type: Date, default: Date.now },
});
decimalJson(schema);

export const AgentAction = mongoose.model('AgentAction', schema);
