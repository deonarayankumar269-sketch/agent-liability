import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export async function findOr404(Model, id, label = 'record') {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, `${label} not found`);
  const doc = await Model.findById(id);
  if (!doc) throw new HttpError(404, `${label} not found`);
  return doc;
}
