import { useState } from 'react';
import { api } from '../api/client.js';
import { ui } from '../lib/ui.js';

export default function EStopButton({ mandateId, onDone, small }) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    const msg = mandateId
      ? 'Revoke this mandate and void its open PayPal holds?'
      : 'Revoke ALL active mandates and void every open PayPal hold?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      if (mandateId) await api.revokeMandate(mandateId);
      else await api.revokeAll();
      onDone?.();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={stop} disabled={busy} className={small ? 'rounded-full border border-vermilion px-3 py-1 text-12 font-medium text-vermilion hover:bg-vermilion hover:text-paper disabled:opacity-40' : ui.btnDanger}>
      {busy ? 'Stopping...' : mandateId ? 'Revoke' : 'Emergency stop'}
    </button>
  );
}
