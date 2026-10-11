import { useCallback, useState } from 'react';
import { api } from '../api/client.js';
import usePoll from '../hooks/usePoll.js';
import Badge from '../components/Badge.jsx';
import VerdictCard from '../components/VerdictCard.jsx';
import { ui } from '../lib/ui.js';
import { usd, when } from '../lib/format.js';

const REASONS = [
  ['MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'Item not received'],
  ['UNAUTHORIZED', 'Unauthorized purchase'],
  ['MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'Not as described'],
];

export default function DisputeCenter() {
  const [disputes, setDisputes] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState(REASONS[0][0]);
  const [carrier, setCarrier] = useState('DELIVERED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([api.disputes(), api.orders()]);
      setDisputes(d);
      setActions(a);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  usePoll(load, 4000);

  const disputed = new Set(disputes.map((d) => String(d.agentActionId)));
  const candidates = actions.filter((a) => a.status === 'captured' && !disputed.has(a._id));
  const effectiveTarget = candidates.some((a) => a._id === targetId) ? targetId : candidates[0]?._id || '';
  const selected = disputes.find((d) => d._id === selectedId) || disputes[0];

  async function simulate(e) {
    e.preventDefault();
    if (!effectiveTarget) return;
    setBusy(true);
    setError('');
    try {
      const d = await api.simulateDispute({ agentActionId: effectiveTarget, reason, carrierStatus: carrier });
      setSelectedId(d._id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="d-lg">Disputes</h1>
      <p className="measure mt-4 text-16 text-ink/75">
        When PayPal sends a CUSTOMER.DISPUTE.CREATED webhook, the verifier checks the mandate, the agent action and the delivery proof,
        then the system submits evidence or accepts the claim. The verdict is a recommendation. PayPal still makes the final call on evidence.
      </p>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-5">
          <section className="border-t border-ink">
            <h2 className="py-3 font-display text-28 tracking-[-0.03em]">Open a test dispute</h2>
            {candidates.length ? (
              <form onSubmit={simulate} className="space-y-5 pb-4">
                <div>
                  <label className={ui.label}>Purchase</label>
                  <select value={effectiveTarget} onChange={(e) => setTargetId(e.target.value)}>
                    {candidates.map((a) => <option key={a._id} value={a._id}>{a.item} at {a.merchant}, {usd(a.amount)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ui.label}>Buyer's reason</label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ui.label}>Carrier</label>
                  <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                    <option value="DELIVERED">Says delivered</option>
                    <option value="NOT_DELIVERED">Says not delivered</option>
                  </select>
                </div>
                <button disabled={busy} className={ui.btnPrimary}>{busy ? 'Verifying...' : 'Open dispute'}</button>
                {error ? <p className="text-12 text-vermilion">{error}</p> : null}
              </form>
            ) : (
              <p className="pb-4 text-14 text-ink/60">{error || 'No captured purchase without a dispute. Run a purchase from the console first.'}</p>
            )}
          </section>

          <section className="border-t border-ink">
            <h2 className="py-3 font-display text-28 tracking-[-0.03em]">All disputes</h2>
            {disputes.length ? (
              <ul>
                {disputes.map((d) => (
                  <li key={d._id} className="border-t border-ink/20">
                    <button
                      onClick={() => setSelectedId(d._id)}
                      className={`flex w-full items-center justify-between gap-3 py-3 text-left text-14 hover:bg-bone ${selected?._id === d._id ? 'bg-bone' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.action ? `${d.action.item} at ${d.action.merchant}` : d.paypalDisputeId}</span>
                        <span className="block font-mono text-12 text-ink/55">{when(d.createdAt)}</span>
                      </span>
                      <Badge status={d.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="pb-4 text-14 text-ink/60">No disputes yet.</p>}
          </section>
        </div>

        <section className="border-t border-ink lg:col-span-7">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <h2 className="font-mono text-14">{selected ? selected.paypalDisputeId : 'Verdict'}</h2>
            {selected ? <Badge status={selected.status} /> : null}
          </div>
          {selected ? (
            <div className="space-y-6 pb-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-14 sm:grid-cols-3">
                <div><dt className="text-12 text-ink/55">Reason</dt><dd>{(selected.reason || '').replace(/_/g, ' ').toLowerCase()}</dd></div>
                <div><dt className="text-12 text-ink/55">Amount</dt><dd className="tabular-nums">{selected.amount ? usd(selected.amount, selected.currency) : '-'}</dd></div>
                <div><dt className="text-12 text-ink/55">Source</dt><dd>{selected.source}</dd></div>
              </dl>
              <VerdictCard verdict={selected.aiVerdict} />
              <div>
                <h3 className="text-12 font-medium text-ink/55">PayPal actions</h3>
                {selected.paypalActions?.length ? (
                  <ul className="mt-2 space-y-1.5 text-14">
                    {selected.paypalActions.map((a, i) => (
                      <li key={i} className="flex gap-3">
                        <span className={`font-mono text-12 ${a.ok ? '' : 'text-vermilion'}`}>{a.ok ? 'done' : 'failed'}</span>
                        <span className="font-medium">{a.action}</span>
                        <span className="min-w-0 truncate text-ink/55" title={a.detail}>{a.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-14 text-ink/60">None yet.</p>}
                {selected.outcome ? <p className="mt-3 text-14">Outcome: <span className="font-medium">{selected.outcome}</span></p> : null}
              </div>
            </div>
          ) : <p className="pb-6 text-14 text-ink/60">Select a dispute to see the verdict.</p>}
        </section>
      </div>
    </div>
  );
}
