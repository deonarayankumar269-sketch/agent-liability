import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  requestData: mongoose.Schema.Types.Mixed,
  responseData: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
}, { collection: 'idempotency_records', minimize: false });

export const IdempotencyRecord = mongoose.model('IdempotencyRecord', schema);
