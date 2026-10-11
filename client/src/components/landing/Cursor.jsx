import { useEffect, useRef } from 'react';
import { isCoarsePointer, prefersReducedMotion } from '../../lib/motion.js';

export default function Cursor() {
  const root = useRef(null);
  const dot = useRef(null);
  const ring = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (isCoarsePointer() || prefersReducedMotion()) return;
    document.documentElement.classList.add('has-cursor');

    const s = { mx: -100, my: -100, rx: -100, ry: -100, dx: -100, dy: -100, scale: 1, ts: 1, dotScale: 1, tds: 1 };
    let raf = 0;
    let last = performance.now();

    const onMove = (e) => { s.mx = e.clientX; s.my = e.clientY; };
    const onOver = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const theme = t.closest('[data-cursor-theme]')?.dataset.cursorTheme || '';
      root.current.dataset.theme = theme;
      const hit = t.closest('a, button, input, select, textarea, [data-cursor]');
      const text = hit?.dataset?.cursor;
      if (hit && text) {
        s.ts = 3.4; s.tds = 0;
        ring.current.classList.add('is-label');
        label.current.textContent = text;
        label.current.classList.add('on');
      } else if (hit) {
        s.ts = 1.9; s.tds = 0.35;
        ring.current.classList.remove('is-label');
        label.current.classList.remove('on');
      } else {
        s.ts = 1; s.tds = 1;
        ring.current.classList.remove('is-label');
        label.current.classList.remove('on');
      }
    };
    const onDown = () => { s.ts *= 0.82; };
    const onUp = () => onOver({ target: document.elementFromPoint(s.mx, s.my) });
    const onLeave = () => { root.current.style.opacity = '0'; };
    const onEnter = () => { root.current.style.opacity = '1'; };

    const tick = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      const f = dt / 16.667;
      const kRing = 1 - Math.pow(1 - 0.12, f);
      const kDot = 1 - Math.pow(1 - 0.5, f);
      s.rx += (s.mx - s.rx) * kRing;
      s.ry += (s.my - s.ry) * kRing;
      s.dx += (s.mx - s.dx) * kDot;
      s.dy += (s.my - s.dy) * kDot;
      s.scale += (s.ts - s.scale) * Math.min(1, kRing * 1.6);
      s.dotScale += (s.tds - s.dotScale) * kDot;
      ring.current.style.transform = `translate3d(${s.rx}px,${s.ry}px,0) scale(${s.scale})`;
      dot.current.style.transform = `translate3d(${s.dx}px,${s.dy}px,0) scale(${s.dotScale})`;
      label.current.style.transform = `translate3d(${s.rx}px,${s.ry}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <div ref={root} className="cursor-root" aria-hidden="true">
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
      <div ref={label} className="cursor-label" />
    </div>
  );
}
