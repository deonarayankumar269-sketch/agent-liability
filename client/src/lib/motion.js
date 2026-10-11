import gsap from 'gsap';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// pulls the element toward the pointer inside a radius, springs back when the pointer leaves
export function magnetic(el, { radius = 120, strength = 0.36 } = {}) {
  if (isCoarsePointer()) return () => {};
  let inside = false;
  let raf = 0;
  let last = null;

  const update = () => {
    raf = 0;
    if (!last) return;
    const r = el.getBoundingClientRect();
    const dx = last.clientX - (r.left + r.width / 2);
    const dy = last.clientY - (r.top + r.height / 2);
    const reach = radius + Math.max(r.width, r.height) / 2;
    if (Math.hypot(dx, dy) < reach) {
      inside = true;
      gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.5, ease: 'power3.out', overwrite: true });
    } else if (inside) {
      inside = false;
      gsap.to(el, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.35)', overwrite: true });
    }
  };

  const onMove = (e) => {
    last = e;
    if (!raf) raf = requestAnimationFrame(update);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    window.removeEventListener('pointermove', onMove);
    cancelAnimationFrame(raf);
    gsap.set(el, { x: 0, y: 0 });
  };
}
