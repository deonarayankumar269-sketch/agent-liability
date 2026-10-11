import { IdempotencyRecord } from '../models/IdempotencyRecord.js';
import { HttpError } from '../utils/http.js';

// fn must resolve to { status, body }. same key twice returns the stored response instead of running again
export async function once(key, requestData, fn) {
  if (!key) return fn();

  try {
    await IdempotencyRecord.create({ idempotencyKey: key, requestData: JSON.parse(JSON.stringify(requestData ?? {})) });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const rec = await IdempotencyRecord.findOne({ idempotencyKey: key });
    if (rec?.responseData) return { ...rec.responseData, replayed: true };
    throw new HttpError(409, 'a request with this idempotency key is still running');
  }

  try {
    const out = await fn();
    await IdempotencyRecord.updateOne({ idempotencyKey: key }, { responseData: JSON.parse(JSON.stringify(out)) });
    return out;
  } catch (err) {
    await IdempotencyRecord.deleteOne({ idempotencyKey: key });
    throw err;
  }
}
