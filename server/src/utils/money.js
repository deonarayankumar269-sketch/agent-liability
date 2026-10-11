import mongoose from 'mongoose';

export const money = (n) => Number(n).toFixed(2);
export const cents = (n) => Math.round(Number(n) * 100);
export const num = (d) => Number(d?.toString?.() ?? d);
export const dec = (n) => mongoose.Types.Decimal128.fromString(money(n));

export function decimalJson(schema) {
  schema.set('toJSON', {
    versionKey: false,
    transform(_doc, ret) {
      for (const k of Object.keys(ret)) {
        const v = ret[k];
        if (v && v._bsontype === 'Decimal128') ret[k] = v.toString();
      }
      return ret;
    },
  });
}
