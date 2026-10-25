"use client";

import { useEffect, useRef, useState } from "react";

export type StarfieldIntensity = "cinematic" | "ambient" | "calm";

const STAR_COUNTS: Record<StarfieldIntensity, { desktop: number; mobile: number }> = {
  cinematic: { desktop: 220, mobile: 90 },
  ambient: { desktop: 150, mobile: 60 },
  calm: { desktop: 80, mobile: 36 },
};

// Average shooting stars per second of visible time - deliberately rare, and off on "calm" pages.
const SHOOTING_STAR_RATE: Record<StarfieldIntensity, number> = {
  cinematic: 0.1,
  ambient: 0.04,
  calm: 0,
};

const FOREGROUND_RATIO = 0.2;

interface StarPoint {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  foreground: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildStars(count: number, width: number, height: number): StarPoint[] {
  const rand = seededRandom(count * 9301 + 49297);
  const foregroundCount = Math.round(count * FOREGROUND_RATIO);
  return Array.from({ length: count }, (_, i) => {
    const foreground = i < foregroundCount;
    return {
      x: rand() * width,
      y: rand() * height,
      r: foreground ? 1.1 + rand() * 1.1 : 0.6 + rand() * 0.7,
      baseAlpha: foreground ? 0.75 + rand() * 0.25 : 0.32 + rand() * 0.35,
      twinkleSpeed: 0.4 + rand() * 0.6,
      twinklePhase: rand() * Math.PI * 2,
      foreground,
    };
  });
}

/** Tiny tiled film-grain texture (inline SVG, no network request) - adds a subtle photographic quality at near-zero cost. */
const GRAIN_BACKGROUND =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Fixed, full-bleed animated space backdrop: a vignette, drifting layered nebula glow
 * (CSS), a soft nebula-core accent, a canvas layer of twinkling stars with occasional
 * shooting stars, and (cinematic only) a slow light-beam pulse.
 *
 * Stars run on a <canvas> rather than one DOM node per star - at a few hundred stars
 * that's the difference between a handful of draw calls per frame and a few hundred
 * styled elements, so it stays cheap even at "cinematic" density on a phone.
 *
 * Canvas drawing happens entirely inside a client-only effect, so there's no
 * server/client markup to mismatch - unlike the old DOM-star version, no `mounted`
 * gate is needed here.
 *
 * `prefers-reduced-motion` gets its own branch (a canvas RAF loop isn't covered by the
 * global CSS animation-duration override in globals.css): a single static frame is
 * drawn and the loop never starts. The CSS nebula layers still respect the global
 * override on their own.
 */
export function Starfield({ intensity = "ambient" }: { intensity?: StarfieldIntensity }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars: StarPoint[] = [];
    let shootingStars: ShootingStar[] = [];
    let rafId: number | null = null;
    let pausedRef = document.hidden;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = STAR_COUNTS[intensity][isMobile ? "mobile" : "desktop"];
      stars = buildStars(count, width, height);
    }
    resize();
    window.addEventListener("resize", resize);

    function drawStaticFrame() {
      ctx!.clearRect(0, 0, width, height);
      for (const s of stars) {
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${s.baseAlpha})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    if (prefersReducedMotion) {
      drawStaticFrame();
      return () => window.removeEventListener("resize", resize);
    }

    const onVisibility = () => {
      pausedRef = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const shootingRate = SHOOTING_STAR_RATE[intensity];
    let lastTime = performance.now();

    function spawnShootingStar() {
      const startX = Math.random() * width * 0.6 + width * 0.1;
      const startY = Math.random() * height * 0.3;
      const speed = 420 + Math.random() * 220;
      const angle = Math.PI / 4 + (Math.random() * 0.2 - 0.1);
      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.3,
      });
    }

    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      if (pausedRef) {
        lastTime = now;
        return;
      }
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx!.clearRect(0, 0, width, height);

      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(now * 0.001 * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.baseAlpha * (0.55 + 0.45 * twinkle);
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
        if (s.foreground && alpha > 0.75) {
          ctx!.beginPath();
          ctx!.fillStyle = `rgba(255,255,255,${(alpha - 0.75) * 0.5})`;
          ctx!.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      if (shootingRate > 0 && Math.random() < shootingRate * dt) {
        spawnShootingStar();
      }

      if (shootingStars.length > 0) {
        shootingStars = shootingStars.filter((star) => {
          star.life += dt;
          if (star.life >= star.maxLife) return false;
          const progress = star.life / star.maxLife;
          const headX = star.x + star.vx * star.life;
          const headY = star.y + star.vy * star.life;
          const tailX = headX - star.vx * 0.12;
          const tailY = headY - star.vy * 0.12;
          const fade = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
          const grad = ctx!.createLinearGradient(tailX, tailY, headX, headY);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = 1.6;
          ctx!.lineCap = "round";
          ctx!.beginPath();
          ctx!.moveTo(tailX, tailY);
          ctx!.lineTo(headX, headY);
          ctx!.stroke();
          return true;
        });
      }
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intensity]);

  const playState = paused ? "paused" : "running";
  const nebulaOpacity = intensity === "cinematic" ? 1 : intensity === "ambient" ? 0.6 : 0.35;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-cosmic-void">
      {/* Drifting nebula clouds */}
      <div
        className="absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-violet/20 blur-3xl animate-nebula-drift"
        style={{ opacity: nebulaOpacity, animationPlayState: playState }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full bg-brand/15 blur-3xl animate-nebula-drift"
        style={{ opacity: nebulaOpacity, animationDelay: "-12s", animationPlayState: playState }}
      />
      {intensity !== "calm" && (
        <div
          className="absolute right-1/4 top-1/3 h-[40vmax] w-[40vmax] rounded-full bg-magenta/10 blur-3xl animate-nebula-drift"
          style={{ animationDelay: "-24s", animationPlayState: playState }}
        />
      )}

      {/* A brighter, warmer nebula core for depth - not just a uniform haze */}
      {intensity !== "calm" && (
        <div
          className="absolute left-1/2 top-1/4 h-[32vmax] w-[32vmax] -translate-x-1/2 rounded-full blur-2xl animate-nebula-drift"
          style={{
            background: "radial-gradient(circle, rgba(245,200,76,0.16) 0%, rgba(139,92,246,0.12) 45%, transparent 75%)",
            animationDelay: "-6s",
            animationDuration: "55s",
            animationPlayState: playState,
          }}
        />
      )}

      {/* Cinematic-only soft light beam - a stretched radial glow (not a linear gradient)
          so it fades on every edge instead of showing a hard rectangle. */}
      {intensity === "cinematic" && (
        <div
          className="absolute -top-1/4 left-1/3 h-[120vmax] w-[26vmax] rotate-[14deg] animate-beam-pulse"
          style={{
            background: "radial-gradient(ellipse 50% 50% at 50% 35%, rgba(34,211,238,0.12), transparent 65%)",
            animationPlayState: playState,
          }}
        />
      )}

      {/* Vignette for depth - darkens the edges so foreground panels read with more contrast */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(5,6,11,0.55) 100%)" }}
      />

      {/* Film-grain texture - static, negligible cost, adds a premium photographic quality */}
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: GRAIN_BACKGROUND }} />

      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
