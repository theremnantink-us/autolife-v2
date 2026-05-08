/**
 * HeroBackdrop — capability gate for the cinematic 3D canvas.
 *
 * On capable devices: BackgroundPaths (animated SVG, z 0) + CinematicCanvas
 * (3D AMG GT, z 1). Shows a branded LoadingScreen while assets download.
 *
 * Mobile optimisation:
 *   - Starts GLB+HDR fetch immediately after WebGL detection (fills cache
 *     before drei's useGLTF fires, shaving ~1s off first-paint on LTE).
 *   - CinematicCanvas uses lower DPR on touch devices.
 *
 * On low-power / save-data / no-WebGL2: soft radial-gradient fallback.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LoadingScreen from './LoadingScreen';

const CinematicCanvas = lazy(() => import('./CinematicCanvas'));
const BackgroundPaths = lazy(() => import('./BackgroundPaths'));

function detect3D(): boolean {
  if (typeof window === 'undefined') return false;
  const conn: any = (navigator as any).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return false;

  const cores = (navigator as any).hardwareConcurrency ?? 8;
  const mem   = (navigator as any).deviceMemory       ?? 8;
  if (cores <= 2 || mem <= 1) return false;

  try {
    const c  = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    return !!gl;
  } catch {
    return false;
  }
}

/** Kick off asset downloads immediately after WebGL detection so the
 *  browser cache is warm before drei's useGLTF triggers its own fetch. */
function preloadAssets() {
  const assets = ['/models/amg-gt.glb', '/hdri/warehouse.hdr'];
  assets.forEach(href => {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const link = Object.assign(document.createElement('link'), {
      rel: 'preload', as: 'fetch', href, crossOrigin: 'anonymous',
    });
    document.head.appendChild(link);
  });
}

/** Reads THREE.js DefaultLoadingManager progress (global Zustand store
 *  from drei — works outside the Canvas). */
function ProgressBridge({
  onProgress, onDone,
}: { onProgress: (p: number) => void; onDone: () => void }) {
  const { progress, loaded, total } = useProgress();

  useEffect(() => { onProgress(progress); }, [progress]);

  useEffect(() => {
    if (loaded > 0 && loaded === total) onDone();
  }, [loaded, total]);

  return null;
}

export default function HeroBackdrop() {
  const [enabled,  setEnabled]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!detect3D()) return;
    preloadAssets();
    setEnabled(true);
  }, []);

  if (!enabled) {
    return (
      <div
        className="hero-fallback"
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(232,234,237,0.06), transparent 60%), ' +
            'radial-gradient(ellipse at 30% 80%, rgba(154,160,166,0.04), transparent 70%), ' +
            'var(--bg)',
        }}
      />
    );
  }

  return (
    <>
      <LoadingScreen progress={progress} done={done} />
      <Suspense fallback={null}>
        <ProgressBridge onProgress={setProgress} onDone={() => setDone(true)} />
        <BackgroundPaths />
        <CinematicCanvas />
      </Suspense>
    </>
  );
}
