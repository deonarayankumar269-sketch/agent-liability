import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  seq: { type: Number, required: true, unique: true },
  eventType: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  previousHash: { type: String, required: true },
  currentHash: { type: String, required: true },
  timestamp: { type: Date, required: true },
}, { minimize: false, versionKey: false });

const blocked = [
  'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace',
  'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete',
];
for (const op of blocked) {
  schema.pre(op, function () {
    throw new Error('audit_trail is append-only');
  });
}

export const AuditEntry = mongoose.model('AuditEntry', schema, 'audit_trail');
