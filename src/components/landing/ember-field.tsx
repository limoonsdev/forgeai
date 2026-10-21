"use client";

import { useEffect, useRef } from "react";

type Ember = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number };

/** Rising embers/sparks rendered on a canvas — the forge's atmosphere. */
export function EmberField({ className, density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const embers: Ember[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const spawn = (initial = false): Ember => {
      const max = 240 + Math.random() * 360;
      return {
        x: w * (0.15 + Math.random() * 0.7) + (Math.random() - 0.5) * 120,
        y: initial ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.35 + Math.random() * 1.1),
        r: 0.4 + Math.random() * 1.3,
        life: initial ? Math.random() * max : 0,
        max,
        hue: 18 + Math.random() * 28,
      };
    };
    const count = Math.round(Math.min(110, (w * h) / 9000) * density);
    for (let i = 0; i < count; i++) embers.push(spawn(true));

    let t = 0;
    const tick = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.life++;
        e.x += e.vx + Math.sin(t * 2 + i) * 0.25;
        e.y += e.vy;
        const p = e.life / e.max;
        if (p >= 1 || e.y < -20) {
          embers[i] = spawn();
          continue;
        }
        const alpha = Math.sin(Math.PI * p) * 0.9;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5);
        g.addColorStop(0, `hsla(${e.hue + 20}, 100%, 75%, ${alpha})`);
        g.addColorStop(0.35, `hsla(${e.hue}, 100%, 55%, ${alpha * 0.45})`);
        g.addColorStop(1, `hsla(${e.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };
    if (reduced) {
      tick();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(tick);
    }
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
