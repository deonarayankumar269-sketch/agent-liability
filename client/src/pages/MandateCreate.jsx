import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { ui } from '../lib/ui.js';

export default function MandateCreate() {
  const nav = useNavigate();
  const [f, setF] = useState({
    agentId: 'shopper-agent-01',
    maxAmount: '500',
    currency: 'USD',
    merchants: 'Amazon',
    hours: '24',
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createMandate({
        agentId: f.agentId,
        maxAmount: Number(f.maxAmount),
        currency: f.currency,
        merchants: f.merchants.split(',').map((s) => s.trim()).filter(Boolean),
        hours: Number(f.hours),
        description: f.description,
      });
      nav('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-y-10 md:grid-cols-12">
      <div className="md:col-span-5">
        <h1 className="d-lg">New mandate</h1>
        <p className="measure mt-5 text-16 text-ink/75">
          A mandate is the spending authority you hand to an agent: how much, where, and until when.
          The server signs it with Ed25519, so any later edit makes the signature fail.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-7 border-t border-ink pt-6 md:col-span-6 md:col-start-7">
        <div>
          <label className={ui.label}>Agent ID</label>
          <input value={f.agentId} onChange={set('agentId')} required />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <label className={ui.label}>Total budget</label>
            <input type="number" min="1" step="0.01" value={f.maxAmount} onChange={set('maxAmount')} required />
          </div>
          <div>
            <label className={ui.label}>Currency</label>
            <select value={f.currency} onChange={set('currency')}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </div>
        </div>
        <div>
          <label className={ui.label}>Allowed merchants</label>
          <input value={f.merchants} onChange={set('merchants')} required />
          <p className="mt-1 text-12 text-ink/55">Comma separated. Anything else is blocked before it reaches PayPal.</p>
        </div>
        <div>
          <label className={ui.label}>Valid for (hours)</label>
          <input type="number" min="0.1" step="0.1" value={f.hours} onChange={set('hours')} required />
        </div>
        <div>
          <label className={ui.label}>Note (optional)</label>
          <input value={f.description} onChange={set('description')} placeholder="buy a laptop for the new hire" />
        </div>
        {error ? <p className="text-14 text-vermilion">{error}</p> : null}
        <button disabled={busy} className={ui.btnPrimary}>{busy ? 'Signing...' : 'Sign and activate mandate'}</button>
      </form>
    </div>
  );
}
