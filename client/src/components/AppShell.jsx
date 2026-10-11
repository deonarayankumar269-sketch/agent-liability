import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { MotionConfig, motion } from 'framer-motion';
import { api } from '../api/client.js';

const links = [
  ['/app', 'Console', true],
  ['/app/mandates/new', 'New mandate'],
  ['/app/disputes', 'Disputes'],
  ['/app/audit', 'Audit trail'],
];

function Flag({ on, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 border border-ink ${on ? 'bg-ink' : ''}`} />
      {label}
    </span>
  );
}

export default function AppShell() {
  const [status, setStatus] = useState(null);
  const loc = useLocation();
  useEffect(() => { api.status().then(setStatus).catch(() => {}); }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-ink bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-3 md:px-10">
            <Link to="/" className="font-display text-28 tracking-[-0.03em]">AgentLiability</Link>
            <nav className="flex gap-6 text-14">
              {links.map(([to, label, end]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative py-1 ${isActive ? 'text-ink after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[2px] after:bg-vermilion' : 'text-ink/55 hover:text-ink'}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            {status ? (
              <div className="hidden items-center gap-5 font-mono text-12 text-ink/70 lg:flex">
                <Flag on={!status.simulated} label={`paypal ${status.simulated ? 'simulated' : 'sandbox'}`} />
                <Flag on={status.ai.groq} label="groq" />
                <Flag on={status.ai.gemini} label="gemini" />
              </div>
            ) : null}
          </div>
        </header>
        <motion.main
          key={loc.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="px-6 py-10 md:px-10"
        >
          <Outlet context={{ status }} />
        </motion.main>
      </div>
    </MotionConfig>
  );
}
