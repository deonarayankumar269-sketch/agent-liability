import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from '@phosphor-icons/react';

export const VERDICTS = [
  {
    key: 'agent',
    name: 'Agent liable',
    when: 'The agent stepped outside what the mandate allowed.',
    dispute: 'SIM-D-9C41',
    reason: 'unauthorized purchase',
    mandate: '$800 limit, amazon, 24h',
    purchase: 'laptop, $900, amazon',
    checks: [['Signature valid', true], ['Within amount', false], ['Merchant on allowlist', true], ['Mandate active', true], ['Delivery proven', true], ['Audit chain intact', true]],
    text: 'The agent acted outside its authority: amount above mandate limit. The user never delegated this, so liability sits with the agent operator.',
  },
  {
    key: 'user',
    name: 'User liable',
    when: 'Everything the agent did was inside the signed mandate and the goods arrived.',
    dispute: 'SIM-D-4F2A',
    reason: 'item not received',
    mandate: '$500 limit, amazon, 24h',
    purchase: 'laptop, $200, amazon',
    checks: [['Signature valid', true], ['Within amount', true], ['Merchant on allowlist', true], ['Mandate active', true], ['Delivery proven', true], ['Audit chain intact', true]],
    text: 'The agent bought $200 at amazon inside the signed mandate. The signature proves the user delegated this authority and delivery is documented, so the charge stands with the user.',
  },
  {
    key: 'merchant',
    name: 'Merchant liable',
    when: 'The agent was in bounds, but the seller cannot show the goods were delivered.',
    dispute: 'SIM-D-71B8',
    reason: 'item not received',
    mandate: '$500 limit, amazon, 24h',
    purchase: 'laptop, $200, amazon',
    checks: [['Signature valid', true], ['Within amount', true], ['Merchant on allowlist', true], ['Mandate active', true], ['Delivery proven', false], ['Audit chain intact', true]],
    text: 'The agent acted within the mandate, but the merchant cannot prove delivery of the $200 order. The carrier reports it as not delivered. Merchant is liable.',
  },
  {
    key: 'review',
    name: 'Manual review',
    when: 'The record itself cannot be trusted, so the system refuses to guess.',
    dispute: 'SIM-D-E203',
    reason: 'unauthorized purchase',
    mandate: '$500 limit, amazon, 24h',
    purchase: 'laptop, $200, amazon',
    checks: [['Signature valid', true], ['Within amount', true], ['Merchant on allowlist', true], ['Mandate active', true], ['Delivery proven', true], ['Audit chain intact', false]],
    text: 'Evidence cannot be fully trusted: audit chain failed verification. Escalating to a person instead of guessing.',
  },
];

const enter = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };
const exit = { duration: 0.25, ease: [0.4, 0, 1, 1] };

export default function VerdictSlip({ active }) {
  const v = VERDICTS[active];
  return (
    <div className="relative border border-ink bg-paper p-6 md:p-9">
      <AnimatePresence mode="wait">
        <motion.div
          key={v.key}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: enter }}
          exit={{ opacity: 0, y: -12, transition: exit }}
        >
          <div className="flex items-start justify-between gap-6 border-b border-ink pb-4 font-mono text-12">
            <span>dispute {v.dispute}</span>
            <span className="text-ink/55">{v.reason}</span>
          </div>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-12">
            <dt className="text-ink/55">mandate</dt><dd>{v.mandate}</dd>
            <dt className="text-ink/55">purchase</dt><dd>{v.purchase}</dd>
          </dl>

          <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {v.checks.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2.5 text-14">
                {ok ? <Check size={16} weight="bold" /> : <X size={16} weight="bold" className="text-vermilion" />}
                <span className={ok ? '' : 'text-vermilion'}>{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-ink pt-5">
            <div className={`font-display text-40 tracking-[-0.03em] ${v.key === 'agent' ? 'text-vermilion' : ''}`}>{v.name}</div>
            <p className="measure mt-3 text-14 text-ink/80">{v.text}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
