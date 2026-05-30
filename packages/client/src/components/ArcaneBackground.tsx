import { useEffect, useRef } from 'react';

const RUNE_COUNT = 24;
const SIGIL_COUNT = 3;

const RUNES = [
  'ᚠ',
  'ᚢ',
  'ᚦ',
  'ᚨ',
  'ᚱ',
  'ᚲ',
  'ᚷ',
  'ᚹ',
  'ᚺ',
  'ᚾ',
  'ᛁ',
  'ᛃ',
  'ᛇ',
  'ᛈ',
  'ᛉ',
  'ᛊ',
  'ᛏ',
  'ᛒ',
  'ᛖ',
  'ᛗ',
  'ᛚ',
  'ᛜ',
  'ᛞ',
  'ᛟ',
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randI = (min: number, max: number) => Math.floor(rand(min, max));
const pick = <T,>(arr: T[]): T => arr[randI(0, arr.length)];

// ── Rune ─────────────────────────────────────────────────────────────────────

type Rune = ReturnType<typeof makeRune>;

function makeRune(w: number, h: number) {
  const state = {
    x: 0,
    y: 0,
    char: '',
    size: 0,
    alpha: 0,
    targetAlpha: 0,
    drift: 0,
    rise: 0,
    life: 0,
    maxLife: 0,
    hue: 0,
    w,
    h,
  };

  function reset() {
    state.x = rand(0, state.w);
    state.y = rand(0, state.h);
    state.char = pick(RUNES);
    state.size = Math.random() > 0.78 ? rand(34, 52) : rand(10, 30);
    state.alpha = 0;
    state.targetAlpha =
      state.size > 34 ? rand(0.06, 0.13) : rand(0.12, 0.24);
    state.drift = rand(-0.04, 0.04);
    state.rise = rand(-0.055, -0.02);
    state.life = 0;
    state.maxLife = rand(700, 1400);
    state.hue = rand(24, 34);
  }

  function update() {
    state.life++;
    if (state.life > state.maxLife) {
      reset();
      return;
    }
    if (state.life < 180)
      state.alpha = Math.min(state.targetAlpha, state.alpha + 0.0015);
    else if (state.life > state.maxLife - 180)
      state.alpha = Math.max(0, state.alpha - 0.0012);
    state.x += state.drift;
    state.y += state.rise;
  }

  function draw(ctx: CanvasRenderingContext2D | null) {
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.fillStyle = `hsl(${state.hue}, 62%, 20%)`;
    ctx.shadowColor = `hsla(${state.hue}, 70%, 28%, 0.25)`;
    ctx.shadowBlur = 8;
    ctx.font = `${state.size}px "Noto Sans Runic", "Segoe UI Symbol", "Apple Symbols", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.char, state.x, state.y);
    ctx.restore();
  }

  reset();
  return { update, draw };
}

// ── Sigil ────────────────────────────────────────────────────────────────────

type Sigil = ReturnType<typeof makeSigil>;

function makeSigil(w: number, h: number) {
  const state = {
    x: 0,
    y: 0,
    r: 0,
    angle: 0,
    speed: 0,
    alpha: 0,
    targetAlpha: 0,
    life: 0,
    maxLife: 0,
    segments: 0,
    variant: 0,
    hue: 0,
    dash: [4, 8] as [number, number],
    w,
    h,
  };

  function reset() {
    state.x = rand(80, state.w - 80);
    state.y = rand(80, state.h - 80);
    state.r = rand(40, 95);
    state.angle = 0;
    state.speed = (Math.random() > 0.5 ? 1 : -1) * rand(0.00035, 0.001);
    state.alpha = 0;
    state.targetAlpha = rand(0.055, 0.11);
    state.life = 0;
    state.maxLife = rand(1200, 2400);
    state.segments = randI(5, 9);
    state.variant = randI(0, 4);
    state.hue = rand(24, 34);
    state.dash = [rand(8, 18), rand(10, 22)];
  }

  function update() {
    state.life++;
    if (state.life > state.maxLife) {
      reset();
      return;
    }
    if (state.life < 260)
      state.alpha = Math.min(state.targetAlpha, state.alpha + 0.0008);
    else if (state.life > state.maxLife - 260)
      state.alpha = Math.max(0, state.alpha - 0.0007);
    state.angle += state.speed;
  }

  function draw(ctx: CanvasRenderingContext2D | null) {
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.strokeStyle = `hsl(${state.hue}, 48%, 22%)`;
    ctx.shadowColor = `hsla(${state.hue}, 55%, 28%, 0.16)`;
    ctx.shadowBlur = 5;

    ctx.lineWidth = 0.9;
    ctx.setLineDash(state.dash);
    ctx.lineDashOffset = -state.angle * 80;
    ctx.beginPath();
    ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 0.65;
    ctx.globalAlpha = state.alpha * 0.62;

    if (state.variant === 0) {
      ctx.beginPath();
      ctx.arc(state.x, state.y, state.r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const sides = state.variant === 1 ? state.segments : Math.max(3, state.segments - 2);
      const radius = state.r * (state.variant === 2 ? 0.72 : 0.58);

      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = state.angle + (i / sides) * Math.PI * 2;
        const x = state.x + Math.cos(a) * radius;
        const y = state.y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    for (let i = 0; i < state.segments; i++) {
      const a = state.angle + (i / state.segments) * Math.PI * 2;
      const innerAngle =
        state.variant === 3
          ? a + (Math.PI * 2) / state.segments
          : a + Math.PI;
      const innerRadius =
        state.variant === 2 ? state.r * 0.28 : state.r * 0.58;
      const bx = state.x + Math.cos(a) * state.r * 0.92;
      const by = state.y + Math.sin(a) * state.r * 0.92;
      const cx = state.x + Math.cos(innerAngle) * innerRadius;
      const cy = state.y + Math.sin(innerAngle) * innerRadius;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  reset();
  return { update, draw };
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Fullscreen arcane canvas background.
 *
 * Place it as the first child of a `relative` container so it sits behind
 * all other content:
 *
 *   <div className="relative min-h-screen">
 *     <ArcaneBackground />
 *     <main className="relative z-10">{children}</main>
 *   </div>
 */
export default function ArcaneBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let runes: Rune[] = [];
    let sigils: Sigil[] = [];

    function init() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      runes = Array.from({ length: RUNE_COUNT }, () => makeRune(w, h));
      sigils = Array.from({ length: SIGIL_COUNT }, () => makeSigil(w, h));
    }

    function resize() {
      const dpr = window.devicePixelRatio ?? 1;
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    }

    function loop() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx?.clearRect(0, 0, w, h);
      sigils.forEach(s => {
        s.update();
        s.draw(ctx);
      });
      runes.forEach(r => {
        r.update();
        r.draw(ctx);
      });
      raf = requestAnimationFrame(loop);
    }

    resize();
    loop();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
