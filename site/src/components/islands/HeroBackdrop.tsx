/**
 * HeroBackdrop — capability gate for the cinematic 3D canvas.
 *
 * On capable devices: BackgroundPaths (animated SVG, z 0) + CinematicCanvas
 * (3D AMG GT, z 1). The 3D canvas is alpha:true so the SVG paths show
 * through transparent areas.
 *
 * On low-power / save-data / no-WebGL2 devices: a soft radial gradient
 * fallback so the page stays usable without the heavy WebGL pipeline.
 */

import { lazy, Suspense, useEffect, useState } from 'react';

const CinematicCanvas  = lazy(() => import('./CinematicCanvas'));
const BackgroundPaths  = lazy(() => import('./BackgroundPaths'));

function detect3D(): boolean {
  if (typeof window === 'undefined') return false;
  const conn: any = (navigator as any).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return false;

  // Only fall back on truly weak hardware (≤2 cores or ≤1 GB RAM, where
  // browsers expose those values). Mobile phones with reasonable specs
  // still get the cinematic 3D — the perf budget is handled inside the
  // canvas via PerformanceMonitor + DPR ramp.
  const cores = (navigator as any).hardwareConcurrency ?? 8;
  const mem   = (navigator as any).deviceMemory ?? 8;
  if (cores <= 2 || mem <= 1) return false;

  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    return !!gl;
  } catch {
    return false;
  }
}

export default function HeroBackdrop() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { setEnabled(detect3D()); }, []);

  if (!enabled) {
    return (
      <div
        className="hero-fallback"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(232,234,237,0.06), transparent 60%), ' +
            'radial-gradient(ellipse at 30% 80%, rgba(154,160,166,0.04), transparent 70%), ' +
            'var(--bg)',
        }}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <BackgroundPaths />
      <CinematicCanvas />
    </Suspense>
  );
}
