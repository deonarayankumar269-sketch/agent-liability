import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, newKey } from '../api/client.js';
import usePoll from '../hooks/usePoll.js';
import Badge from '../components/Badge.jsx';
import EStopButton from '../components/EStopButton.jsx';
import SpendPipeline from '../components/SpendPipeline.jsx';
import { ui } from '../lib/ui.js';
import { usd, when } from '../lib/format.js';

const NOTICE = {
  red: 'border-vermilion bg-vermilion text-paper',
  green: 'border-ink bg-ink text-paper',
  amber: 'border-ink bg-paper text-ink',
};

function Section({ title, action, children, className = '' }) {
  return (
    <section className={`border-t border-ink ${className}`}>
      <div className="flex items-baseline justify-between gap-4 py-3">
        <h2 className="font-display text-28 tracking-[-0.03em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Budget({ m }) {
  const max = Number(m.maxAmount);
  const used = Number(m.committed);
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div className="w-44">
      <div className="relative h-px bg-ink/25">
        <div className="absolute inset-y-[-1px] left-0 h-[3px] origin-left bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 font-mono text-12 tabular-nums text-ink/65">{usd(used, m.currency)} of {usd(max, m.currency)}</div>
    </div>
  );
}

function PurchaseForm({ mandates, onResult }) {
  const active = mandates.filter((m) => m.status === 'active');
  const [mandateId, setMandateId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [item, setItem] = useState('Laptop');
  const [amount, setAmount] = useState('200');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active.length) return;
    if (!active.some((m) => m._id === mandateId)) {
      setMandateId(active[0]._id);
      setMerchant(active[0].merchantAllowlist[0] || '');
    }
  }, [active, mandateId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.purchase({ mandateId, merchant, item, amount: Number(amount), autoComplete: auto }, newKey());
      const a = r.action;
      onResult(
        a.status === 'captured'
          ? { tone: 'green', text: `Purchase captured: ${usd(a.amount)} at ${a.merchant}.` }
          : a.status === 'pending_approval'
            ? { tone: 'amber', text: 'Order created. Approve it in PayPal to place the hold.' }
            : { tone: 'amber', text: `Order is ${a.status.replace(/_/g, ' ')}.` },
        a
      );
    } catch (err) {
      if (err.data?.blocked) {
        onResult({ tone: 'red', text: `Blocked before PayPal: ${err.data.violations.join(' | ')}` }, err.data.action);
      } else {
        onResult({ tone: 'red', text: err.message }, err.data?.action);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!active.length) {
    return (
      <p className="pb-6 text-14 text-ink/65">
        No active mandate. <Link to="/app/mandates/new" className="underline underline-offset-4">Sign one</Link> first.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-x-6 gap-y-5 pb-6 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <label className={ui.label}>Mandate</label>
        <select value={mandateId} onChange={(e) => {
          setMandateId(e.target.value);
          const m = active.find((x) => x._id === e.target.value);
          if (m) setMerchant(m.merchantAllowlist[0] || '');
        }}>
          {active.map((m) => <option key={m._id} value={m._id}>{m.agentId} ({usd(m.remaining, m.currency)} left)</option>)}
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className={ui.label}>Merchant</label>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className={ui.label}>Item</label>
        <input value={item} onChange={(e) => setItem(e.target.value)} required />
      </div>
      <div className="sm:col-span-1">
        <label className={ui.label}>Amount</label>
        <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <label className="flex items-center gap-3 text-14 text-ink/80 sm:col-span-4">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Agent finishes the order itself (delivery, AI check, capture)
      </label>
      <div className="sm:col-span-2 sm:justify-self-end">
        <button disabled={busy} className={ui.btnPrimary}>{busy ? 'Agent is buying...' : 'Agent buys'}</button>
      </div>
    </form>
  );
}

function DemoPanel({ onChange, onResult, onSelect }) {
  const [busy, setBusy] = useState('');

  async function demoMandate() {
    const list = await api.mandates();
    return list.find((m) => m.status === 'active' && m.merchantAllowlist.some((x) => x.toLowerCase() === 'amazon'));
  }

  const steps = {
    mandate: async () => {
      const m = await api.createMandate({ agentId: 'shopper-agent-01', maxAmount: 500, currency: 'USD', merchants: ['Amazon'], hours: 24, description: 'demo: laptop, Amazon only' });
      onResult({ tone: 'green', text: `Mandate signed: ${usd(m.maxAmount)} limit, Amazon only, 24h.` });
    },
    buy: async () => {
      const m = await demoMandate();
      if (!m) return onResult({ tone: 'red', text: 'Sign the demo mandate first.' });
      const r = await api.purchase({ mandateId: m._id, merchant: 'Amazon', item: 'Laptop', amount: 200, autoComplete: true }, newKey());
      onSelect(r.action._id);
      onResult({ tone: 'green', text: `Agent bought a laptop for ${usd(r.action.amount)}. Hold, AI check, capture done.` });
    },
    block: async () => {
      const m = await demoMandate();
      if (!m) return onResult({ tone: 'red', text: 'Sign the demo mandate first.' });
      try {
        await api.purchase({ mandateId: m._id, merchant: 'Amazon', item: 'Gaming laptop', amount: 700, autoComplete: true }, newKey());
      } catch (err) {
        if (err.data?.blocked) {
          onSelect(err.data.action._id);
          return onResult({ tone: 'red', text: `Blocked before PayPal: ${err.data.violations.join(' | ')}` });
        }
        throw err;
      }
    },
    dispute: async () => {
      const list = await api.orders();
      const target = list.find((a) => a.status === 'captured');
      if (!target) return onResult({ tone: 'red', text: 'No captured purchase to dispute yet.' });
      const d = await api.simulateDispute({ agentActionId: target._id });
      onResult({ tone: 'amber', text: `Dispute ${d.paypalDisputeId} opened. Verdict: ${d.aiVerdict?.verdict}. See Disputes.` });
    },
  };

  async function run(name) {
    setBusy(name);
    try { await steps[name](); } catch (err) { onResult({ tone: 'red', text: err.message }); }
    setBusy('');
    onChange();
  }

  async function runAll() {
    for (const n of ['mandate', 'buy', 'block', 'dispute']) {
      await run(n);
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  async function reset() {
    if (!window.confirm('Delete all mandates, purchases, disputes and the audit chain?')) return;
    setBusy('reset');
    try { await api.reset(); onResult({ tone: 'green', text: 'Demo data cleared.' }); } catch (err) { onResult({ tone: 'red', text: err.message }); }
    setBusy('');
    onChange();
  }

  const rows = [
    ['01', 'Sign a $500, Amazon-only mandate', 'mandate'],
    ['02', 'Agent buys a $200 laptop', 'buy'],
    ['03', 'Agent tries a $700 laptop', 'block'],
    ['04', 'Buyer opens a dispute', 'dispute'],
  ];

  return (
    <div className="pb-5">
      <ul>
        {rows.map(([n, text, key]) => (
          <li key={key} className="border-t border-ink/20">
            <button disabled={!!busy} onClick={() => run(key)} className="group flex w-full items-baseline gap-4 py-3 text-left text-14 disabled:opacity-40">
              <span className="font-mono text-12 text-ink/50">{n}</span>
              <span className="flex-1">{text}</span>
              <span className="font-mono text-12 text-vermilion opacity-0 transition-opacity duration-300 group-hover:opacity-100">run</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button className={ui.btnPrimary} disabled={!!busy} onClick={runAll}>Run all steps</button>
        <button className={ui.btn} disabled={!!busy} onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { status } = useOutletContext();
  const [mandates, setMandates] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [params] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([api.mandates(), api.orders()]);
      setMandates(m);
      setActions(a);
    } catch (err) {
      setNotice({ tone: 'red', text: err.message });
    }
  }, []);
  usePoll(load, 4000);

  useEffect(() => {
    const o = params.get('order');
    if (o === 'approved') setNotice({ tone: 'green', text: 'PayPal approval received, the funds are on hold.' });
    if (o === 'cancelled') setNotice({ tone: 'amber', text: 'Buyer cancelled at PayPal. The order was voided.' });
    if (o === 'error') setNotice({ tone: 'red', text: 'Could not finish the PayPal approval, check the server log.' });
  }, [params]);

  const selected = actions.find((a) => a._id === selectedId) || actions[0];
  const handleResult = (n, action) => {
    setNotice(n);
    if (action?._id) setSelectedId(action._id);
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="d-lg">Agent spending</h1>
          <p className="measure mt-4 text-16 text-ink/75">
            Every purchase runs through the mandate, becomes a PayPal hold, and is captured only after the AI check passes.
            {status?.simulated ? ' PayPal is simulated right now. Add sandbox keys to .env to use the real sandbox.' : ''}
          </p>
        </div>
        <EStopButton onDone={load} />
      </div>

      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice.text}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
            className={`mt-8 flex items-start justify-between gap-4 border px-4 py-3 text-14 ${NOTICE[notice.tone] || NOTICE.amber}`}
          >
            <span className="break-words">{notice.text}</span>
            <button className="shrink-0 text-12 underline underline-offset-4" onClick={() => setNotice(null)}>dismiss</button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-10 grid gap-x-12 gap-y-10 xl:grid-cols-12">
        <div className="space-y-10 xl:col-span-8">
          <Section title="Mandates" action={<Link to="/app/mandates/new" className="text-14 underline underline-offset-4">New mandate</Link>}>
            {mandates.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-14">
                  <thead><tr><th className={ui.th}>Agent</th><th className={ui.th}>Merchants</th><th className={ui.th}>Budget</th><th className={ui.th}>Expires</th><th className={ui.th}>Status</th><th className={ui.th}></th></tr></thead>
                  <tbody>
                    {mandates.map((m) => (
                      <tr key={m._id} className="border-t border-ink/20">
                        <td className={`${ui.td} font-medium`}>{m.agentId}{!m.signatureValid ? <span className="ml-2 text-12 font-normal text-vermilion">signature invalid</span> : null}</td>
                        <td className={`${ui.td} text-ink/70`}>{m.merchantAllowlist.join(', ')}</td>
                        <td className={ui.td}><Budget m={m} /></td>
                        <td className={`${ui.td} whitespace-nowrap font-mono text-12 text-ink/70`}>{when(m.expiresAt)}</td>
                        <td className={ui.td}><Badge status={m.status} /></td>
                        <td className={`${ui.td} text-right`}>{m.status === 'active' ? <EStopButton mandateId={m._id} onDone={load} small /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="pb-6 text-14 text-ink/60">No mandates yet.</p>}
          </Section>

          <Section title="Let an agent buy something">
            <PurchaseForm mandates={mandates} onResult={handleResult} />
          </Section>

          <Section title="Agent actions">
            {actions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-14">
                  <thead><tr><th className={ui.th}>When</th><th className={ui.th}>Item</th><th className={ui.th}>Merchant</th><th className={ui.th}>Amount</th><th className={ui.th}>Status</th></tr></thead>
                  <tbody>
                    {actions.map((a) => (
                      <tr
                        key={a._id}
                        onClick={() => setSelectedId(a._id)}
                        className={`cursor-pointer border-t border-ink/20 hover:bg-bone ${selected?._id === a._id ? 'bg-bone' : ''}`}
                      >
                        <td className={`${ui.td} whitespace-nowrap font-mono text-12 text-ink/70`}>{when(a.createdAt)}</td>
                        <td className={ui.td}>{a.item}</td>
                        <td className={ui.td}>{a.merchant}</td>
                        <td className={`${ui.td} tabular-nums`}>{usd(a.amount, a.currency)}</td>
                        <td className={ui.td}><Badge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="pb-6 text-14 text-ink/60">Nothing bought yet.</p>}
          </Section>
        </div>

        <div className="space-y-10 xl:col-span-4">
          <Section title="Spend pipeline">
            <SpendPipeline action={selected} onChange={load} />
          </Section>
          <Section title="Demo script">
            <DemoPanel onChange={load} onResult={setNotice} onSelect={setSelectedId} />
          </Section>
        </div>
      </div>
    </div>
  );
}
