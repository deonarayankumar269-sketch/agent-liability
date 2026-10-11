import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { prefersReducedMotion } from '../../lib/motion.js';

const vertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uHover;
uniform float uLines;
uniform float uAccentLine;
uniform float uReveal;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uAccent;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  float d = length(p - m);
  float well = exp(-d * d * 12.0) * uHover;

  float n1 = snoise(vec2(p.x * 1.3 + uTime * 0.045, p.y * 2.1 - uTime * 0.06));
  float n2 = snoise(vec2(p.x * 3.4 - uTime * 0.035, p.y * 1.2 + 4.0));

  float y = uv.y + n1 * 0.03 + n2 * 0.01;
  y += (uv.y - uMouse.y) * well * 0.26;

  float g = y * uLines;
  float s = abs(fract(g) - 0.5);
  float aa = fwidth(g) * 0.8;
  float t = 0.03 + well * 0.06;
  float line = smoothstep(0.5 - t - aa, 0.5 - t + aa, s);

  float fade = smoothstep(0.04, 0.72, uv.x);
  float edge = smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
  float a = line * fade * edge * uReveal;

  float idx = floor(g + 0.5);
  float isAccent = 1.0 - step(0.5, abs(idx - uAccentLine));
  vec3 ink = mix(uInk, uAccent, isAccent);

  fragColor = vec4(mix(uPaper, ink, a), 1.0);
}
`;

const HeroCanvas = forwardRef(function HeroCanvas({ className = '' }, ref) {
  const wrap = useRef(null);
  const state = useRef({ reveal: 0, program: null, draw: null });
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    setReveal(v) {
      state.current.reveal = v;
      if (state.current.program) state.current.program.uniforms.uReveal.value = v;
      if (state.current.draw) state.current.draw();
    },
  }), []);

  useEffect(() => {
    const el = wrap.current;
    const staticMode = prefersReducedMotion();
    const small = window.matchMedia('(max-width: 767px)').matches;
    const lineCount = small ? 30 : 48;

    let renderer;
    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        dpr: small ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
        powerPreference: 'high-performance',
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    if (!renderer.isWebgl2) {
      setFailed(true);
      return undefined;
    }

    const gl = renderer.gl;
    gl.clearColor(0.9569, 0.9451, 0.9255, 1);
    gl.canvas.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [1, 1] },
        uMouse: { value: [0.7, 0.5] },
        uHover: { value: 0 },
        uLines: { value: lineCount },
        uAccentLine: { value: Math.floor(lineCount * 0.58) },
        uReveal: { value: state.current.reveal },
        uInk: { value: [0.0667, 0.0667, 0.0627] },
        uPaper: { value: [0.9569, 0.9451, 0.9255] },
        uAccent: { value: [0.8863, 0.2941, 0.149] },
      },
    });
    state.current.program = program;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const mouse = { x: 0.7, y: 0.5, tx: 0.7, ty: 0.5, h: 0, th: 0 };

    const draw = (t = 0) => {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.h += (mouse.th - mouse.h) * 0.06;
      program.uniforms.uTime.value = t * 0.001;
      program.uniforms.uMouse.value = [mouse.x, mouse.y];
      program.uniforms.uHover.value = mouse.h;
      renderer.render({ scene: mesh });
    };

    let raf = 0;
    const loop = (t) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h);
      program.uniforms.uRes.value = [w, h];
      if (staticMode) draw(0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      mouse.tx = x;
      mouse.ty = y;
      mouse.th = x > -0.15 && x < 1.15 && y > -0.15 && y < 1.15 ? 1 : 0;
    };

    let io;
    if (staticMode) {
      state.current.draw = () => draw(0);
      draw(0);
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      io = new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(raf);
        if (entry.isIntersecting) raf = requestAnimationFrame(loop);
      });
      io.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      window.removeEventListener('pointermove', onMove);
      state.current.program = null;
      state.current.draw = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      gl.canvas.remove();
    };
  }, []);

  if (failed) {
    return (
      <div
        className={className}
        aria-hidden="true"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgb(17 17 16 / 0.35) 0 1px, transparent 1px 22px)' }}
      />
    );
  }
  return <div ref={wrap} className={className} aria-hidden="true" />;
});

export default HeroCanvas;
