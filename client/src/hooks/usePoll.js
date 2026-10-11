import { useEffect, useRef } from 'react';

export default function usePoll(fn, ms = 4000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) ref.current(); };
    run();
    const t = setInterval(run, ms);
    return () => { alive = false; clearInterval(t); };
  }, [ms]);
}
