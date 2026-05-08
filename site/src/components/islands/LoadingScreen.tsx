/**
 * LoadingScreen — branded full-viewport overlay shown while the 3D model
 * and HDR environment are downloading. Fades out once progress reaches 100%.
 *
 * Lifecycle:
 *   visible (loading) → done prop set → bar snaps to 100% → 650ms fade-out → unmount
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  progress: number; // 0-100 from useProgress
  done: boolean;
}

export default function LoadingScreen({ progress, done }: Props) {
  const [mounted, setMounted]     = useState(true);
  const [fading,  setFading]      = useState(false);
  const [display, setDisplay]     = useState(100);
  const rafRef  = useRef<number>(0);
  const curRef  = useRef(0);

  // Smooth the raw progress value so the bar glides rather than jumps
  useEffect(() => {
    const target = done ? 100 : Math.min(progress, 92);
    const tick = () => {
      curRef.current += (target - curRef.current) * 0.07;
      setDisplay(Math.round(curRef.current * 10) / 10);
      if (Math.abs(curRef.current - target) > 0.2) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        curRef.current = target;
        setDisplay(target);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress, done]);

  useEffect(() => {
    if (!done) return;
    const snap = setTimeout(() => {
      setDisplay(100);
      curRef.current = 100;
    }, 80);
    const fade = setTimeout(() => setFading(true), 200);
    const hide = setTimeout(() => setMounted(false), 900);
    return () => { clearTimeout(snap); clearTimeout(fade); clearTimeout(hide); };
  }, [done]);

  if (!mounted) return null;

  return (
    <div className={`ls${fading ? ' ls--out' : ''}`} aria-hidden="true" role="presentation">
      {/* Centre brand block */}
      <div className="ls__center">
        <img src="/IMG/logo.png" alt="АвтоЛайф" className="ls__logo" />

        <div className="ls__divider" />

        <p className="ls__label">
          {display < 100 ? 'Загрузка 3D-студии…' : 'Готово'}
        </p>
      </div>

      {/* Bottom progress bar */}
      <div className="ls__track" role="progressbar" aria-valuenow={Math.round(display)} aria-valuemin={0} aria-valuemax={100}>
        <div className="ls__bar" style={{ width: `${display}%` }} />
        <div className="ls__bar-glow" style={{ left: `${display}%` }} />
      </div>

      <style>{`
        .ls {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #08090b;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ls--out { opacity: 0; pointer-events: none; }

        /* ── Brand block ── */
        .ls__center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          user-select: none;
        }
        .ls__logo {
          width: clamp(140px, 30vw, 220px);
          height: auto;
          opacity: 0.92;
          filter: drop-shadow(0 0 24px rgba(232,234,237,0.12));
          animation: lsPulse 2.8s ease-in-out infinite;
        }
        @keyframes lsPulse {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(232,234,237,0.10)); }
          50%       { filter: drop-shadow(0 0 36px rgba(232,234,237,0.22)); }
        }
        .ls__divider {
          width: clamp(60px, 12vw, 100px);
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(232,234,237,0.55) 40%,
            rgba(154,160,166,0.35) 70%,
            transparent
          );
          animation: lsShimmer 2s linear infinite;
          background-size: 200% 100%;
        }
        @keyframes lsShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .ls__label {
          font-family: 'Michroma', 'Orbitron', sans-serif;
          font-size: clamp(10px, 2vw, 12px);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(154,160,166,0.7);
        }

        /* ── Progress bar ── */
        .ls__track {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(255,255,255,0.04);
          overflow: visible;
        }
        .ls__bar {
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(154,160,166,0.4) 0%,
            rgba(232,234,237,0.9) 60%,
            rgba(255,255,255,1)   100%
          );
          transition: width 0.1s linear;
          position: relative;
        }
        .ls__bar-glow {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 12px;
          background: radial-gradient(
            ellipse at center,
            rgba(255,255,255,0.6) 0%,
            transparent 70%
          );
          pointer-events: none;
          transition: left 0.1s linear;
        }

        @media (prefers-reduced-motion: reduce) {
          .ls__logo { animation: none; }
          .ls__divider { animation: none; }
          .ls--out { transition: none; }
        }
      `}</style>
    </div>
  );
}
