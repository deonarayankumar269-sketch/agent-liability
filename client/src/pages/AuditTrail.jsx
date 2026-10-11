import { useCallback, useState } from 'react';
import { api } from '../api/client.js';
import usePoll from '../hooks/usePoll.js';
import { ui } from '../lib/ui.js';
import { short, when } from '../lib/format.js';

export default function AuditTrail() {
  const [entries, setEntries] = useState([]);
  const [report, setReport] = useState(null);
  const [tamper, setTamper] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setEntries(await api.audit()); } catch (err) { setError(err.message); }
  }, []);
  usePoll(load, 5000);

  async function verify(t) {
    setError('');
    try { setReport(await api.verifyAudit(t)); } catch (err) { setError(err.message); }
  }

  const bad = new Map((report?.problems || []).map((p) => [p.seq, p.reason]));

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h1 className="d-lg">Audit trail</h1>
        <p className="measure mt-4 text-16 text-ink/75">
          Append-only. Each entry stores the HMAC-SHA256 of its content plus the hash of the entry before it, so changing any old record breaks every hash after it.
        </p>

        <div className="mt-8 space-y-4 border-t border-ink pt-5">
          <button onClick={() => verify()} className={ui.btnPrimary}>Verify chain</button>
          <div className="flex items-end gap-4">
            <div className="w-28">
              <label className={ui.label}>Entry number</label>
              <input type="number" min="1" value={tamper} onChange={(e) => setTamper(e.target.value)} />
            </div>
            <button onClick={() => verify(tamper)} disabled={!tamper} className={ui.btn}>Verify as if edited</button>
          </div>
          <p className="text-12 text-ink/55">Nothing is written. The server only recomputes the chain with that entry changed.</p>
        </div>

        {report ? (
          <div className={`mt-6 border px-4 py-3 text-14 ${report.valid ? 'border-ink bg-ink text-paper' : 'border-vermilion bg-vermilion text-paper'}`}>
            {report.valid
              ? `Chain valid: ${report.length} entries, head ${short(report.headHash, 12)}`
              : `Chain broken at entr${report.problems.length > 1 ? 'ies' : 'y'} ${[...new Set(report.problems.map((p) => p.seq))].join(', ')}${report.simulatedTamper ? ` (simulated edit of #${report.simulatedTamper})` : ''}`}
          </div>
        ) : null}
        {error ? <p className="mt-4 text-14 text-vermilion">{error}</p> : null}
      </div>

      <ol className="ml-[5px] border-l border-ink lg:col-span-8">
        {entries.map((e) => (
          <li key={e.seq} className="relative pb-6 pl-7">
            <span className={`absolute -left-[6px] top-[7px] h-[11px] w-[11px] border ${bad.has(e.seq) ? 'border-vermilion bg-vermilion' : 'border-ink bg-paper'}`} />
            <div className="flex flex-wrap items-baseline gap-x-4">
              <span className="text-16 font-medium">#{e.seq} {e.eventType.replace(/_/g, ' ')}</span>
              <span className="font-mono text-12 text-ink/55">{when(e.timestamp)}</span>
              {bad.has(e.seq) ? <span className="font-mono text-12 text-vermilion">{bad.get(e.seq).replace(/_/g, ' ')}</span> : null}
            </div>
            <div className="mt-0.5 font-mono text-12 text-ink/60">
              {short(e.currentHash, 16)} <span className="text-ink/35">prev {short(e.previousHash, 8)}</span>
            </div>
            <button className="mt-1 text-12 underline underline-offset-4" onClick={() => setOpen(open === e.seq ? null : e.seq)}>
              {open === e.seq ? 'hide payload' : 'show payload'}
            </button>
            {open === e.seq ? (
              <pre className="mt-2 overflow-x-auto border border-ink/30 bg-bone p-3 font-mono text-12">{JSON.stringify(e.payload, null, 2)}</pre>
            ) : null}
          </li>
        ))}
        {!entries.length ? <li className="pl-7 text-14 text-ink/60">No entries yet.</li> : null}
      </ol>
    </div>
  );
}
