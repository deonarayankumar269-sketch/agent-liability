import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import HeroCanvas from '../components/landing/HeroCanvas.jsx';
import Cursor from '../components/landing/Cursor.jsx';
import Roll from '../components/landing/Roll.jsx';
import VerdictSlip, { VERDICTS } from '../components/landing/VerdictSlip.jsx';
import { PathIllustration } from '../components/landing/Illustrations.jsx';
import { magnetic, prefersReducedMotion } from '../lib/motion.js';

gsap.registerPlugin(ScrollTrigger);

const MARQUEE = ['signed mandate', 'authorize hold', 'ai verdict', 'dispute evidence', 'hash chain'];

const PROBLEM =
  'Picture an agent that pays $900 for a laptop its owner capped at $800. The merchant says it shipped. The buyer says it never came. Everyone has a screenshot and nobody has a signature. Someone pays, and right now nobody can show who.';
const MARKS = new Set(['$900', '$800', 'signature.']);

const PANELS = [
  { n: '01', kind: 'mandate', title: 'Sign the limit', w: '44vw', lift: '0vh',
    body: 'The user signs a mandate: how much, where, until when. It is Ed25519, so editing the amount afterwards breaks the signature.' },
  { n: '02', kind: 'hold', title: 'Hold the money', w: '38vw', lift: '-7vh',
    body: 'Each purchase becomes a PayPal AUTHORIZE order. The funds are held, not taken. A purchase over the limit never reaches PayPal at all.' },
  { n: '03', kind: 'check', title: 'Check before release', w: '46vw', lift: '6vh',
    body: 'Signature, amount, merchant, expiry and delivery proof are checked in code. The model writes the explanation. It does not get to overrule the checks.' },
  { n: '04', kind: 'stop', title: 'Capture, or stop', w: '40vw', lift: '-4vh',
    body: 'Checks pass and the hold is captured. They fail and the money stays frozen, ready to void. One button revokes every mandate.' },
  { n: '05', kind: 'dispute', title: 'Settle the dispute', w: '44vw', lift: '5vh',
    body: 'A dispute webhook triggers a verdict. The system then sends the evidence PayPal asks for, or accepts the claim when the agent or the merchant is at fault.' },
];

const FACTS = [
  { v: '0', unit: 'requests', cls: 'md:col-start-1 md:col-span-4',
    text: 'reach PayPal when a purchase breaks the mandate. It is stopped before any money moves.' },
  { v: '29', unit: 'days', cls: 'md:col-start-6 md:col-span-4 md:mt-28',
    text: 'is how long PayPal keeps an authorization open for capture.' },
  { v: '3', unit: 'days', cls: 'md:col-start-2 md:col-span-4',
    text: 'is the honor period. After it the hold has to be authorized again.' },
  { v: '256', unit: 'bit', cls: 'md:col-start-8 md:col-span-4 md:mt-16',
    text: 'HMAC on every audit entry, chained to the entry before it.' },
];

const CHAIN = [
  { seq: 1, ev: 'chain initialized', hash: '3be1...a09c' },
  { seq: 2, ev: 'mandate created', hash: '71d4...5e2f' },
  { seq: 3, ev: 'action authorized', hash: 'c08a...19d7', flag: true },
  { seq: 4, ev: 'delivery recorded', hash: '5a62...f4b1' },
  { seq: 5, ev: 'captured', hash: 'e9f0...2c68' },
  { seq: 6, ev: 'dispute filed', hash: '14bd...7a35' },
];

function Lines({ lines, className = '' }) {
  return lines.map((l, i) => (
    <span key={i} className={`mask-line ${className}`}>
      <span className="line-in">{l}</span>
    </span>
  ));
}

function Diamond() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0 fill-vermilion" aria-hidden="true">
      <rect x="5" y="5" width="12" height="12" transform="rotate(45 11 11)" />
    </svg>
  );
}

export default function Landing() {
  const root = useRef(null);
  const canvas = useRef(null);
  const [active, setActive] = useState(1);

  useLayoutEffect(() => {
    const el = root.current;
    const q = (s) => gsap.utils.toArray(s, el);
    const rm = prefersReducedMotion();

    if (rm) {
      el.dataset.rm = 'true';
      q('[data-intro]').forEach((n) => { n.style.display = 'none'; });
      q('.roll-col').forEach((c) => gsap.set(c, { yPercent: -Number(c.dataset.digit) * 10 }));
      q('.progress, .hash-bad, .chain-flag').forEach((n) => { n.style.display = 'none'; });
      canvas.current?.setReveal(1);
      return undefined;
    }

    const cleanups = [];
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.stop();
    let vel = 0;
    lenis.on('scroll', () => ScrollTrigger.update());
    lenis.on('scroll', (l) => { vel = l.velocity || 0; });
    const lenisTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);

    const onClick = (e) => {
      const t = e.target.closest?.('[data-scrollto]');
      if (!t) return;
      e.preventDefault();
      lenis.scrollTo(t.dataset.scrollto, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
    };
    el.addEventListener('click', onClick);

    const ctx = gsap.context(() => {
      /* ---------- intro (curtain, counter, nav, headline mask, char stagger) ---------- */
      const introEl = q('[data-intro]')[0];
      const numEl = q('.intro-num')[0];
      const will = q('.hero-line .line-in, .hero-char, [data-nav], [data-hero-fade]');
      let seen = false;
      try { seen = sessionStorage.getItem('al_intro') === '1'; sessionStorage.setItem('al_intro', '1'); } catch { /* private mode */ }

      gsap.set('.hero-line .line-in', { yPercent: 115, skewY: 5 });
      gsap.set('.hero-char', { yPercent: 125, rotate: 12 });
      gsap.set('[data-nav]', { y: -26, opacity: 0 });
      gsap.set('[data-hero-fade]', { y: 28, opacity: 0 });
      gsap.set('.intro-mark', { yPercent: 115 });
      gsap.set('.intro-bar', { scaleX: 0 });
      gsap.set('.progress, .path-progress', { scaleX: 0, transformOrigin: 'left center' });
      gsap.set(will, { willChange: 'transform, opacity' });

      const counter = { v: 0 };
      const reveal = { v: 0 };
      const intro = gsap.timeline({
        onComplete: () => {
          introEl.style.display = 'none';
          gsap.set(will, { clearProps: 'willChange' });
          lenis.start();
        },
      });
      intro
        .to('.intro-mark', { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0)
        .to(counter, {
          v: 100, duration: 1.0, ease: 'power2.inOut',
          onUpdate: () => { numEl.textContent = String(Math.round(counter.v)).padStart(3, '0'); },
        }, 0)
        .to('.intro-bar', { scaleX: 1, duration: 1.0, ease: 'power2.inOut' }, 0)
        .to('.intro-inner', { opacity: 0, y: -24, duration: 0.3, ease: 'power2.in', stagger: 0.05 }, 1.05)
        .to(introEl, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, 1.2)
        .to(reveal, { v: 1, duration: 1.9, ease: 'power3.out', onUpdate: () => canvas.current?.setReveal(reveal.v) }, 1.45)
        .to('[data-nav]', { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: { each: 0.07, ease: 'power2.in' } }, 1.7)
        .to('.hero-line .line-in', { yPercent: 0, skewY: 0, duration: 1.25, ease: 'expo.out', stagger: { each: 0.09, ease: 'power1.in' } }, 1.55)
        .to('.hero-char', { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: { each: 0.05, ease: 'power2.in' } }, 2.15)
        .to('[data-hero-fade]', { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: { each: 0.1, ease: 'power1.in' } }, 2.1);
      if (seen) { introEl.style.display = 'none'; intro.seek(1.25); }

      /* ---------- chrome: progress bar, nav theme, magnetic buttons ---------- */
      gsap.to('.progress', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: true },
      });
      const nav = q('[data-nav-root]')[0];
      q('[data-nav-dark]').forEach((sec) => {
        ScrollTrigger.create({
          trigger: sec, start: 'top 48px', end: 'bottom 48px',
          onToggle: (self) => nav.classList.toggle('is-light', self.isActive),
        });
      });
      q('[data-magnetic]').forEach((m) => cleanups.push(magnetic(m)));

      /* ---------- hero exit: scroll-linked scale / fade / drift ---------- */
      gsap.to('.hero-inner', {
        scale: 0.93, opacity: 0.3, yPercent: -7, ease: 'none', transformOrigin: '30% 0%',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.to('.hero-canvas', {
        yPercent: 14, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });

      /* ---------- masked line-by-line reveals ---------- */
      q('[data-reveal]').forEach((h) => {
        gsap.from(h.querySelectorAll('.line-in'), {
          yPercent: 112, skewY: 3, duration: 1.1, ease: 'expo.out',
          stagger: { each: 0.08, ease: 'power1.in' },
          scrollTrigger: { trigger: h, start: 'top 86%', once: true },
        });
      });

      /* ---------- page turn: next section swings in from a corner ---------- */
      q('[data-turn]').forEach((t) => {
        gsap.fromTo(t,
          { rotate: Number(t.dataset.turn), yPercent: 7, transformOrigin: t.dataset.origin || 'left top' },
          { rotate: 0, yPercent: 0, ease: 'none',
            scrollTrigger: { trigger: t.parentElement, start: 'top bottom', end: 'top 20%', scrub: true } });
      });

      /* ---------- problem: words light up with scroll ---------- */
      gsap.fromTo('.pw', { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: '.problem-text', start: 'top 78%', end: 'bottom 52%', scrub: true },
      });
      q('.pmark').forEach((m) => {
        gsap.fromTo(m.querySelector('.pmark-line'), { scaleX: 0 }, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: m, start: 'top 70%', end: 'top 42%', scrub: true },
        });
      });
      gsap.fromTo('.big-num', { xPercent: 22, rotate: 3 }, {
        xPercent: -8, rotate: 1, ease: 'none',
        scrollTrigger: { trigger: '.problem', start: 'top bottom', end: 'bottom top', scrub: true },
      });

      /* ---------- marquee with scroll-velocity skew, plus velocity distortion ---------- */
      const track = q('.marquee-track')[0];
      const setX = gsap.quickSetter(track, 'x', 'px');
      const setSkew = gsap.quickSetter(track, 'skewX', 'deg');
      const dist = q('.vdist').map((n) => gsap.quickSetter(n, 'skewY', 'deg'));
      let mx = 0;
      let half = track.scrollWidth / 2;
      let smooth = 0;
      let dir = 1;
      const onResize = () => { half = track.scrollWidth / 2; };
      window.addEventListener('resize', onResize);
      const loop = (_t, dt) => {
        smooth += (vel - smooth) * 0.12;
        const target = Math.abs(smooth) > 0.2 ? Math.sign(smooth) : dir;
        dir += (target - dir) * 0.08;
        mx -= (1.1 + Math.abs(smooth) * 0.55) * dir * (dt / 16.667);
        if (half) {
          if (mx <= -half) mx += half;
          if (mx > 0) mx -= half;
        }
        setX(mx);
        setSkew(gsap.utils.clamp(-12, 12, -smooth * 0.9));
        const sk = gsap.utils.clamp(-3.5, 3.5, smooth * 0.18);
        dist.forEach((s) => s(sk));
      };
      gsap.ticker.add(loop);
      cleanups.push(() => { gsap.ticker.remove(loop); window.removeEventListener('resize', onResize); });

      /* ---------- pinned horizontal sequence ---------- */
      const pathSec = q('.path')[0];
      const pTrack = q('.path-track')[0];
      const span = () => Math.max(0, pTrack.scrollWidth - window.innerWidth);
      const hTween = gsap.to(pTrack, {
        x: () => -span(), ease: 'none',
        scrollTrigger: {
          trigger: pathSec, pin: true, scrub: 0.8, anticipatePin: 1, refreshPriority: 10,
          start: 'top top', end: () => '+=' + span(), invalidateOnRefresh: true,
        },
      });
      gsap.to('.path-progress', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: pathSec, start: 'top top', end: () => '+=' + span(), scrub: true, invalidateOnRefresh: true },
      });
      q('.path-art').forEach((art) => {
        gsap.fromTo(art, { clipPath: 'inset(0% 100% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'power3.out',
          scrollTrigger: { trigger: art, containerAnimation: hTween, start: 'left 90%', end: 'left 48%', scrub: true },
        });
      });
      q('.path-num').forEach((n) => {
        gsap.fromTo(n, { yPercent: 70, opacity: 0 }, {
          yPercent: 0, opacity: 1, ease: 'power3.out',
          scrollTrigger: { trigger: n, containerAnimation: hTween, start: 'left 95%', end: 'left 60%', scrub: true },
        });
      });

      /* ---------- rolling counters ---------- */
      q('.fact').forEach((f, i) => {
        const cols = f.querySelectorAll('.roll-col');
        gsap.set(cols, { yPercent: (_j, t) => -((Number(t.dataset.digit) + 7) % 10) * 10 });
        gsap.to(cols, {
          yPercent: (_j, t) => -Number(t.dataset.digit) * 10,
          duration: 1.7, ease: 'expo.out', delay: i * 0.05,
          stagger: { amount: 0.4, from: 'random' },
          scrollTrigger: { trigger: f, start: 'top 82%', once: true },
        });
        gsap.from(f.querySelector('.fact-rule'), {
          scaleX: 0, transformOrigin: 'left center', duration: 1.3, ease: 'expo.out',
          scrollTrigger: { trigger: f, start: 'top 85%', once: true },
        });
        gsap.from(f.querySelector('.fact-text'), {
          y: 24, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.25,
          scrollTrigger: { trigger: f, start: 'top 82%', once: true },
        });
      });

      /* ---------- verdict slip: curtain wipe in, then drifts and untilts with scroll ---------- */
      const slip = q('.slip-wrap')[0];
      gsap.fromTo(slip, { clipPath: 'inset(0% 0% 100% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut',
        scrollTrigger: { trigger: slip, start: 'top 80%', once: true },
      });
      gsap.fromTo(slip, { rotate: -4.5, y: 70 }, {
        rotate: -1.8, y: -40, ease: 'none',
        scrollTrigger: { trigger: '.verdicts', start: 'top bottom', end: 'bottom top', scrub: true },
      });

      /* ---------- audit chain: drawn link by link, then one edit breaks the rest ---------- */
      const blocks = q('.chain-block');
      const links = q('.chain-link');
      gsap.set(blocks, { opacity: 0, y: 44 });
      gsap.set(links, { scaleX: 0, transformOrigin: 'left center' });
      gsap.set('.chain-flag', { opacity: 0 });
      gsap.set('.hash-bad', { opacity: 0 });
      const ctl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: '.chain-stage', start: 'top 72%', end: 'bottom 38%', scrub: 0.6 },
      });
      blocks.forEach((b, i) => {
        ctl.to(b, { opacity: 1, y: 0, duration: 1 }, i * 0.65);
        if (links[i]) ctl.to(links[i], { scaleX: 1, duration: 0.7 }, i * 0.65 + 0.45);
      });
      ctl.to('.chain-flag', { opacity: 1, duration: 0.6 }, '>+0.5')
        .to('.hash-ok-late', { opacity: 0, duration: 0.4, stagger: 0.25 }, '<+0.2')
        .to('.hash-bad', { opacity: 1, duration: 0.4, stagger: 0.25 }, '<');
      gsap.to('.chain-track', {
        x: () => -Math.min(window.innerWidth * 0.16, 260), ease: 'none',
        scrollTrigger: { trigger: '.chain-stage', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    }, el);

    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener('load', refresh);

    return () => {
      window.removeEventListener('load', refresh);
      el.removeEventListener('click', onClick);
      cleanups.forEach((fn) => fn());
      ctx.revert();
      gsap.ticker.remove(lenisTick);
      lenis.destroy();
    };
  }, []);

  const words = PROBLEM.split(' ');

  return (
    <div ref={root} id="top" className="relative overflow-x-clip bg-paper text-ink">
      <Cursor />

      {/* intro curtain */}
      <div data-intro className="fixed inset-0 z-[95] flex flex-col justify-between bg-ink p-6 text-paper md:p-10">
        <div className="intro-inner flex items-start justify-between">
          <span className="mask-line"><span className="intro-mark line-in font-display text-40 tracking-[-0.03em]">AgentLiability</span></span>
          <span className="font-mono text-12 text-paper/60">sandbox build</span>
        </div>
        <div className="intro-inner">
          <div className="intro-num font-display text-[clamp(64px,14vw,140px)] leading-[0.9] tracking-[-0.045em] tabular-nums">000</div>
          <div className="mt-4 h-px w-full bg-paper/25">
            <div className="intro-bar h-px origin-left bg-paper" />
          </div>
        </div>
      </div>

      <div className="progress fixed left-0 top-0 z-[90] h-[2px] w-full bg-vermilion" />

      <header data-nav-root className="nav-root fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-10">
        <button data-nav data-scrollto="#top" className="font-display text-28 tracking-[-0.03em]">AgentLiability</button>
        <nav className="flex items-center gap-5 text-14 md:gap-8">
          <button data-nav data-scrollto="#path" className="hidden md:block">The path</button>
          <button data-nav data-scrollto=".verdicts" className="hidden md:block">Verdicts</button>
          <button data-nav data-scrollto=".chain" className="hidden md:block">The record</button>
          <Link data-nav data-magnetic to="/app" className="rounded-full border border-current px-4 py-1.5">Console</Link>
        </nav>
      </header>

      {/* hero */}
      <section className="hero relative min-h-[100svh] px-6 pb-10 pt-28 md:px-10">
        <HeroCanvas ref={canvas} className="hero-canvas pointer-events-none absolute inset-y-0 right-[-12vw] w-[84vw]" />
        <div className="hero-inner relative z-10 flex min-h-[calc(100svh-9.5rem)] flex-col justify-between">
          <h1 className="d-xxl vdist">
            <span className="mask-line hero-line"><span className="line-in">When the agent</span></span>
            <span className="mask-line hero-line md:pl-[12vw]"><span className="line-in">buys the wrong</span></span>
            <span className="mask-line hero-line md:pl-[3vw]">
              <span className="line-in">
                thing, who{' '}
                <span className="hero-word" aria-label="pays?">
                  {'pays?'.split('').map((c, i) => (
                    <span key={i} className="hero-char" aria-hidden="true">{c}</span>
                  ))}
                </span>
              </span>
            </span>
          </h1>

          <div className="mt-20 grid gap-10 md:grid-cols-12">
            <p data-hero-fade className="font-mono text-12 text-ink/60 md:col-span-3 md:self-end">
              Runs on PayPal sandbox, or a simulated PayPal when no keys are set.
            </p>
            <div className="md:col-span-4 md:col-start-8">
              <p data-hero-fade className="measure text-16 text-ink/85">
                AgentLiability signs the spending limit, holds the money at PayPal, checks the purchase before it is released,
                and settles the dispute from a record nobody can quietly edit.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link
                  to="/app" data-hero-fade data-magnetic data-cursor="open"
                  className="inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-16 font-medium text-paper"
                >
                  Open the console <ArrowUpRight size={18} weight="bold" />
                </Link>
                <button data-hero-fade data-scrollto="#path" className="inline-flex items-center gap-2 text-14 underline decoration-ink/40 underline-offset-[6px]">
                  <ArrowDown size={14} /> Follow one purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* marquee */}
      <section className="relative border-y border-ink py-5 md:py-7" aria-hidden="true">
        <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap will-change-transform">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-10">
              {MARQUEE.map((w, i) => (
                <div key={w} className="flex items-center gap-10">
                  <span className={`d-xl ${i % 2 ? 'outline-text' : ''}`}>{w}</span>
                  <Diamond />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* problem */}
      <section className="problem relative z-10" data-nav-dark data-cursor-theme="light">
        <div data-turn="2.4" data-origin="left top" className="relative bg-ink px-6 py-32 text-paper md:px-10 md:py-52">
          <p className="problem-text d-lg vdist md:ml-[8vw] md:max-w-[58rem]">
            {words.map((w, i) => (
              <span key={i}>
                {MARKS.has(w) ? (
                  <span className="pw pmark relative inline-block">
                    {w}
                    <span className="pmark-line absolute inset-x-0 bottom-[0.02em] h-[2px] origin-left bg-vermilion" />
                  </span>
                ) : (
                  <span className="pw inline-block">{w}</span>
                )}{' '}
              </span>
            ))}
          </p>
          <div aria-hidden="true" className="big-num pointer-events-none absolute bottom-10 right-[-6vw] select-none font-display text-[clamp(140px,26vw,380px)] leading-[0.8] tracking-[-0.05em]"
            style={{ color: 'transparent', WebkitTextStroke: '1.5px rgb(244 241 236 / 0.35)' }}>
            $900
          </div>
        </div>
      </section>

      {/* pinned horizontal path */}
      <section id="path" className="path relative h-screen overflow-hidden bg-bone">
        <div className="path-track flex h-full w-max items-center gap-[7vw] pl-6 pr-[24vw] md:pl-10">
          <div className="w-[82vw] shrink-0 md:w-[34vw]">
            <h2 className="d-xl vdist" data-reveal>
              <Lines lines={['One purchase,', 'five checkpoints.']} />
            </h2>
            <p className="measure mt-8 text-16 text-ink/75">
              Keep scrolling. The page moves sideways through everything that sits between the agent clicking buy and the money settling.
            </p>
          </div>
          {PANELS.map((p) => (
            <article
              key={p.n}
              className="path-panel relative w-[82vw] shrink-0 md:w-[var(--w)]"
              style={{ '--w': p.w, marginTop: p.lift }}
            >
              <div className="path-num font-display text-64 leading-none tracking-[-0.05em] md:text-96">{p.n}</div>
              <div className="path-art mt-5 h-[30vh] w-full border border-ink">
                <PathIllustration kind={p.kind} />
              </div>
              <h3 className="mt-7 font-display text-[clamp(28px,3vw,40px)] leading-[1.02] tracking-[-0.03em]">{p.title}</h3>
              <p className="measure mt-3 max-w-[44ch] text-14 text-ink/75 md:text-16">{p.body}</p>
            </article>
          ))}
        </div>
        <div className="absolute inset-x-6 bottom-7 h-px bg-ink/20 md:inset-x-10">
          <div className="path-progress h-px bg-ink" />
        </div>
      </section>

      {/* numbers */}
      <section className="relative bg-paper px-6 py-32 md:px-10 md:py-48">
        <h2 className="d-xl vdist md:max-w-[60vw]" data-reveal>
          <Lines lines={['Four numbers', 'that explain it.']} />
        </h2>
        <div className="mt-20 grid gap-x-8 gap-y-16 md:grid-cols-12">
          {FACTS.map((f) => (
            <div key={f.unit + f.v} className={`fact ${f.cls}`}>
              <div className="fact-rule h-px w-full bg-ink" />
              <div className="mt-5 flex items-baseline gap-4">
                <Roll value={f.v} className="d-xxl" />
                <span className="font-display text-28 tracking-[-0.02em] text-ink/70">{f.unit}</span>
              </div>
              <p className="fact-text measure mt-4 max-w-[34ch] text-16 text-ink/80">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* verdicts */}
      <section className="verdicts relative bg-bone px-6 py-32 md:px-10 md:py-48">
        <h2 className="d-xl vdist md:max-w-[56vw]" data-reveal>
          <Lines lines={['Four outcomes,', 'one written reason.']} />
        </h2>
        <div className="mt-16 grid gap-y-16 md:grid-cols-12">
          <ul className="relative z-10 md:col-span-5" role="tablist" aria-label="Verdict examples">
            {VERDICTS.map((v, i) => (
              <li key={v.key} className="border-t border-ink last:border-b">
                <button
                  role="tab" aria-selected={active === i} data-cursor="view"
                  onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}
                  className="flex w-full items-baseline justify-between gap-6 py-5 text-left"
                >
                  <span>
                    <span className={`block font-display text-[clamp(28px,3vw,40px)] leading-none tracking-[-0.03em] ${active === i ? '' : 'text-ink/45'}`}>{v.name}</span>
                    <span className="mt-2 block max-w-[34ch] text-14 text-ink/70">{v.when}</span>
                  </span>
                  <span className={`font-mono text-12 ${active === i ? 'text-vermilion' : 'text-ink/30'}`}>{String(i + 1).padStart(2, '0')}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="slip-wrap md:col-span-7 md:col-start-6 md:-ml-[3vw] md:-mr-[4vw] md:mt-24">
            <VerdictSlip active={active} />
          </div>
        </div>
      </section>

      {/* audit chain */}
      <section className="chain relative z-10" data-nav-dark data-cursor-theme="light">
        <div data-turn="-1.8" data-origin="right top" className="bg-ink py-32 text-paper md:py-48">
          <h2 className="d-xl vdist px-6 md:max-w-[70vw] md:px-10" data-reveal>
            <Lines lines={['Change one line of history', 'and every line after it', 'stops matching.']} />
          </h2>
          <div className="chain-stage mt-24">
            <div className="chain-track flex w-max items-stretch pl-6 pr-[30vw] md:pl-10">
              {CHAIN.map((b, i) => (
                <div key={b.seq} className="flex items-center">
                  <div className="chain-block relative w-[62vw] border border-paper/40 p-5 md:w-[21vw]">
                    {b.flag ? <div className="chain-flag pointer-events-none absolute -inset-px border border-vermilion" /> : null}
                    <div className="flex items-baseline justify-between font-mono text-12 text-paper/60">
                      <span>#{b.seq}</span>
                      {b.flag ? <span className="chain-flag text-vermilion">edited</span> : null}
                    </div>
                    <div className="mt-6 font-display text-28 tracking-[-0.02em]">{b.ev}</div>
                    <div className="relative mt-5 font-mono text-12">
                      <span className={b.seq >= 4 ? 'hash-ok-late block' : 'block'}>{b.hash}</span>
                      {b.seq >= 4 ? <span className="hash-bad absolute inset-0 text-vermilion">mismatch</span> : null}
                    </div>
                  </div>
                  {i < CHAIN.length - 1 ? <div className="chain-link h-px w-[10vw] bg-paper/70 md:w-[5vw]" /> : null}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-14 px-6 font-mono text-12 text-paper/55 md:px-10">
            Sample entries. The real chain lives on the audit page, with a button that does exactly this to a live entry.
          </p>
        </div>
      </section>

      {/* call to action */}
      <section className="relative px-6 py-40 md:px-10 md:py-56">
        <div className="grid items-end gap-y-14 md:grid-cols-12">
          <h2 className="d-xxl vdist md:col-span-9" data-reveal>
            <Lines lines={['Run the demo', 'in three minutes.']} />
          </h2>
          <div className="md:col-span-3 md:justify-self-end">
            <Link
              to="/app" data-magnetic data-cursor="go"
              className="grid h-44 w-44 place-items-center rounded-full bg-vermilion text-center font-display text-28 leading-[1.05] tracking-[-0.02em] text-paper"
            >
              Open<br />the console
            </Link>
          </div>
        </div>
        <p className="measure mt-16 font-mono text-12 text-ink/60 md:ml-[8vw]">
          Needs Node 18.18 or newer. With nothing set in .env it runs against a simulated PayPal and rule-based verdicts.
        </p>
      </section>

      <footer className="bg-ink px-6 py-10 text-paper md:px-10" data-cursor-theme="light">
        <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 border-t border-paper/30 pt-6">
          <span className="font-display text-28 tracking-[-0.03em]">AgentLiability</span>
          <nav className="flex gap-8 text-14">
            <Link to="/app">Console</Link>
            <Link to="/app/disputes">Disputes</Link>
            <Link to="/app/audit">Audit trail</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
