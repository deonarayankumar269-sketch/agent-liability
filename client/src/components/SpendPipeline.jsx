import { useState } from 'react';
import { api } from '../api/client.js';
import Badge from './Badge.jsx';
import { ui } from '../lib/ui.js';
import { usd } from '../lib/format.js';

const LABELS = {
  mandate_check: 'Mandate check',
  paypal_hold: 'PayPal hold (AUTHORIZE)',
  delivery: 'Delivery proof',
  ai_check: 'AI verification',
  capture: 'Capture',
};

const MARK = {
  ok: 'border-ink bg-ink',
  failed: 'border-vermilion bg-vermilion',
  pending: 'border-ink bg-paper',
  skipped: 'border-ink/30 bg-paper',
};

export default function SpendPipeline({ action, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!action) {
    return <p className="py-6 text-14 text-ink/60">No agent purchases yet. Sign a mandate, then let an agent buy something.</p>;
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const id = action._id;
  const awaitingDelivery = action.status === 'authorized' && !action.delivery?.delivered;

  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-14">{action.item} <span className="text-ink/55">at {action.merchant}</span></div>
          <div className="font-display text-40 tracking-[-0.03em] tabular-nums">{usd(action.amount, action.currency)}</div>
        </div>
        <Badge status={action.status} />
      </div>

      <ol className="mt-5 ml-[5px] border-l border-ink">
        {(action.pipeline || []).map((s) => (
          <li key={s.step} className="relative pb-4 pl-6 last:pb-0">
            <span className={`absolute -left-[6px] top-[7px] h-[11px] w-[11px] border ${MARK[s.status] || MARK.pending}`} />
            <div className={`text-14 font-medium ${s.status === 'skipped' ? 'text-ink/40 line-through' : ''}`}>{LABELS[s.step] || s.step}</div>
            {s.detail ? <div className="break-words font-mono text-12 text-ink/60">{s.detail}</div> : null}
          </li>
        ))}
      </ol>

      {action.violations?.length ? (
        <div className="mt-4 border border-vermilion px-3 py-2 font-mono text-12 text-vermilion">
          {action.violations.map((v) => <div key={v}>{v}</div>)}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {action.status === 'pending_approval' && action.approvalUrl ? (
          <a className={ui.btnPrimary} href={action.approvalUrl} target="_blank" rel="noreferrer">Approve in PayPal</a>
        ) : null}
        {awaitingDelivery ? (
          <>
            <button className={ui.btn} disabled={busy} onClick={() => run(() => api.deliver(id, { delivered: true }))}>Record delivery</button>
            <button className={ui.btn} disabled={busy} onClick={() => run(() => api.deliver(id, { delivered: false }))}>Merchant did not deliver</button>
          </>
        ) : null}
        {action.status === 'authorized' ? (
          <button className={ui.btnPrimary} disabled={busy} onClick={() => run(() => api.capture(id))}>Run AI check and capture</button>
        ) : null}
        {['authorized', 'pending_approval'].includes(action.status) ? (
          <button className={ui.btn} disabled={busy} onClick={() => run(() => api.voidOrder(id))}>Void hold</button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-12 text-vermilion">{error}</p> : null}
      {action.aiReason ? <p className="mt-4 border-t border-ink/20 pt-3 text-14 text-ink/75">{action.aiReason}</p> : null}
    </div>
  );
}
