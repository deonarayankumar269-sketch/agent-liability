const VERDICT = {
  LIABLE_USER: { label: 'User liable', alert: false },
  LIABLE_AGENT: { label: 'Agent liable', alert: true },
  LIABLE_MERCHANT: { label: 'Merchant liable', alert: false },
  SPLIT: { label: 'Manual review', alert: false },
};

const CHECKS = [
  ['signatureValid', 'Signature valid'],
  ['withinAmount', 'Within amount'],
  ['merchantAllowed', 'Merchant allowed'],
  ['activeAtTime', 'Mandate active'],
  ['deliveryProven', 'Delivery proven'],
  ['evidenceComplete', 'Evidence chain'],
];

export default function VerdictCard({ verdict }) {
  if (!verdict) return <p className="text-14 text-ink/60">Verdict pending.</p>;
  const v = VERDICT[verdict.verdict] || VERDICT.SPLIT;

  return (
    <div>
      <div className="border-y border-ink py-5">
        <div className="flex items-baseline justify-between gap-4">
          <div className={`font-display text-40 tracking-[-0.03em] ${v.alert ? 'text-vermilion' : ''}`}>{v.label}</div>
          <div className="font-mono text-12 text-ink/60">confidence {Math.round((verdict.confidence || 0) * 100)}%</div>
        </div>
        <p className="measure mt-2 text-16 text-ink/85">{verdict.reasoning}</p>
      </div>

      {verdict.checks && Object.keys(verdict.checks).length ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-14 sm:grid-cols-3">
          {CHECKS.map(([k, label]) => (
            <li key={k} className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 border ${verdict.checks[k] ? 'border-ink bg-ink' : 'border-vermilion bg-vermilion'}`} />
              <span className={verdict.checks[k] ? '' : 'text-vermilion'}>{label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {verdict.evidencePoints?.length ? (
        <ul className="mt-5 list-disc space-y-1 pl-5 text-14 text-ink/80">
          {verdict.evidencePoints.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      ) : null}

      <p className="mt-5 font-mono text-12 text-ink/55">
        Decided by {verdict.provider === 'rules' ? 'rule engine (no AI provider reachable)' : `rule engine, explained by ${verdict.provider}`}
        {verdict.llmVerdict ? (verdict.llmAgrees ? ', model agreed' : `, model suggested ${verdict.llmVerdict} but the rules verdict was kept`) : ''}.
      </p>
    </div>
  );
}
