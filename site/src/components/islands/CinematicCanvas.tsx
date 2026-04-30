/**
 * CinematicCanvas
 * ---------------
 * Fixed full-viewport R3F canvas that drives a cinematic scroll-tied animation
 * of the AMG GT Black Series 3D model. The animation timeline runs from
 * scrollProgress=0 (top of document) to 1 (bottom), so the user "scrolls
 * through" the camera path as they explore the site.
 *
 * Mobile / low-power / save-data / prefers-reduced-motion → falls back to
 * a static poster + slow rotation only (no scroll cinema, no shaders).
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  useGLTF, Environment, ContactShadows, PerformanceMonitor,
} from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
// IMPORTANT: drei's useGLTF expects loaders from three-stdlib, not from
// three/examples/jsm — those are different *class instances* and the
// instanceof / setDRACOLoader dance only works when both sides agree.
import { DRACOLoader } from 'three-stdlib';

const MODEL_URL = '/models/amg-gt.glb';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

// Tell drei's internal cached GLTFLoader where to find the Draco decoder.
// useGLTF.setDecoderPath is the supported public API for this.
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

// Belt-and-braces: also extend the loader on preload so DRACO is attached
// regardless of which drei code path executes first.
useGLTF.preload(MODEL_URL, true, true, (loader: any) => {
  if (loader && typeof loader.setDRACOLoader === 'function') {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDRACOLoader(draco);
  }
});

// ---------- scroll progress hook ----------
// Reads the `window.__heroProgress` value populated by the global GSAP
// ScrollTrigger in Base.astro. Falls back to a native listener if GSAP
// hasn't initialised (e.g. prefers-reduced-motion didn't disable it but
// something else broke).
function useScrollProgress() {
  const ref = useRef(0);
  useEffect(() => {
    const onTick = (e: Event) => { ref.current = (e as CustomEvent<number>).detail; };
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      ref.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    window.addEventListener('autolife:hero-progress', onTick);
    if (!(window as any).__heroProgress) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    return () => {
      window.removeEventListener('autolife:hero-progress', onTick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return ref;
}

// ---------- camera keyframe path (radius-based to be model-scale agnostic) ----------
type Frame = {
  t: number;
  // [azimuth (radians), elevation (radians), distance multiplier]
  cam: [number, number, number];
  look: [number, number, number];
  fov: number;
  exposure: number;
};
const FRAMES: Frame[] = [
  // Opening: close-up FRONT (анфас) — camera right in front of the bumper.
  { t: 0.00, cam: [ 0.00, 0.05, 0.55], look: [0, 0.05, 0], fov: 28, exposure: 1.10 },
  // Pull back slightly while drifting to a 1/4 angle for depth.
  { t: 0.14, cam: [ 0.35, 0.12, 0.72], look: [0, 0.05, 0], fov: 30, exposure: 1.05 },
  { t: 0.28, cam: [ 0.85, 0.10, 0.85], look: [0, 0,    0], fov: 32, exposure: 1.00 },
  // Low side panning to highlight chrome line of the body.
  { t: 0.42, cam: [-0.90, 0.04, 0.78], look: [0, 0,    0], fov: 34, exposure: 0.95 },
  // Top-down on the wheels.
  { t: 0.55, cam: [ 0.00, 1.10, 0.55], look: [0,-0.10, 0], fov: 40, exposure: 0.90 },
  // Side pan with environment glint.
  { t: 0.70, cam: [-1.40, 0.16, 0.86], look: [0, 0,    0], fov: 32, exposure: 1.00 },
  // Big sweeping circle around to the front again.
  { t: 0.85, cam: [ 3.10, 0.10, 0.92], look: [0, 0.02, 0], fov: 30, exposure: 1.10 },
  // Closing 3/4 hero pose.
  { t: 1.00, cam: [ 0.55, 0.20, 1.05], look: [0, 0,    0], fov: 32, exposure: 1.00 },
];

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}
function sampleFrame(t: number): Frame {
  for (let i = 0; i < FRAMES.length - 1; i++) {
    const a = FRAMES[i], b = FRAMES[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = smoothstep((t - a.t) / (b.t - a.t));
      return {
        t,
        cam: [
          a.cam[0] + (b.cam[0] - a.cam[0]) * k,
          a.cam[1] + (b.cam[1] - a.cam[1]) * k,
          a.cam[2] + (b.cam[2] - a.cam[2]) * k,
        ],
        look: [
          a.look[0] + (b.look[0] - a.look[0]) * k,
          a.look[1] + (b.look[1] - a.look[1]) * k,
          a.look[2] + (b.look[2] - a.look[2]) * k,
        ],
        fov: a.fov + (b.fov - a.fov) * k,
        exposure: a.exposure + (b.exposure - a.exposure) * k,
      };
    }
  }
  return FRAMES[FRAMES.length - 1];
}

// ---------- car ----------
function Car() {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  // Auto-fit: compute bounding sphere → scale model so its radius is ~1.4
  // and recenter to origin. This makes the camera keyframes scale-agnostic.
  const { fitted, radius } = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const centre = sphere.center.clone();
    const r = sphere.radius || 1;
    const target = 1.4;
    const s = target / r;
    cloned.position.sub(centre.multiplyScalar(s));
    cloned.scale.setScalar(s);

    cloned.traverse((o: any) => {
      if (o.isMesh && o.material) {
        const m = o.material as THREE.MeshStandardMaterial;
        m.envMapIntensity = 1.6;
        m.toneMapped = true;
        // Lift the dark body materials with PBR tweaks.
        const isPaint = (m.name?.toLowerCase().includes('body')
                        || m.name?.toLowerCase().includes('paint')
                        || (m.color && m.color.getHex() < 0x202020));
        if (isPaint) {
          (m as any).clearcoat = 1.0;
          (m as any).clearcoatRoughness = 0.06;
          m.roughness = 0.22;
          m.metalness = 0.85;
        }
      }
    });
    return { fitted: cloned, radius: target };
  }, [scene]);

  return (
    <group ref={ref} position={[0, -0.25, 0]}>
      <primitive object={fitted} />
      {/* Hidden helper for diagnostics — comment out for production
      <mesh><sphereGeometry args={[radius, 8, 8]} /><meshBasicMaterial wireframe color="cyan" /></mesh>
      */}
    </group>
  );
}

// ---------- camera rig (orbit-based) ----------
function Rig({ progressRef }: { progressRef: { current: number } }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.0, 0));
  const baseDistance = 4.5;

  useFrame((_, dt) => {
    const f = sampleFrame(progressRef.current);
    const [az, el, dm] = f.cam;
    const dist = baseDistance * dm;

    const x = Math.sin(az) * Math.cos(el) * dist;
    const y = Math.sin(el) * dist;
    const z = Math.cos(az) * Math.cos(el) * dist;

    const lerp = Math.min(1, dt * 4);
    camera.position.lerp(new THREE.Vector3(x, y, z), lerp);
    target.current.lerp(new THREE.Vector3(...f.look), lerp);
    camera.lookAt(target.current);

    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov += (f.fov - cam.fov) * lerp;
      cam.updateProjectionMatrix();
    }
    (camera as any).__exposure = f.exposure;
  });
  return null;
}

function Exposure() {
  const { gl, camera } = useThree();
  useFrame(() => {
    const e = (camera as any).__exposure ?? 1;
    gl.toneMappingExposure = e;
  });
  return null;
}

// ---------- dramatic scroll-driven lighting rig ----------
// Three keyframes, lerped by scroll progress:
//   Stage A (p=0)     showroom: soft warm key + cool fill, balanced ambient
//   Stage B (p=0.5)   film noir: single hot key from the side, deep shadows
//   Stage C (p=1)     synthwave: cold cyan rim + magenta accent, near-black amb
const STAGES = [
  { // 0 — showroom
    amb:    { color: '#9aa6b6', intensity: 0.35 },
    key:    { color: '#fff5e0', intensity: 1.8,  pos: [ 6,  8,  4] as const },
    fill:   { color: '#9bb6d6', intensity: 0.8,  pos: [-6,  4, -3] as const },
    accent: { color: '#ffe8c8', intensity: 0.7,  pos: [ 0,  3,  5] as const },
    hemi:   { sky: '#1c2028', ground: '#0a0c10', intensity: 0.4 },
  },
  { // 1 — film noir
    amb:    { color: '#0c1018', intensity: 0.06 },
    key:    { color: '#ffb05a', intensity: 4.2,  pos: [ 8,  3, -1] as const },
    fill:   { color: '#1a2030', intensity: 0.05, pos: [-8,  2,  2] as const },
    accent: { color: '#ff7a30', intensity: 1.6,  pos: [ 4,  1,  6] as const },
    hemi:   { sky: '#0d0e12', ground: '#000000', intensity: 0.10 },
  },
  { // 2 — cold spotlight (no magenta — pure cool whites and blues so the
    //      black paint doesn't pick up a pink tint at the bottom of scroll)
    amb:    { color: '#0c1218', intensity: 0.10 },
    key:    { color: '#dfe8f2', intensity: 2.6,  pos: [-5,  6, -4] as const },
    fill:   { color: '#7fa8d6', intensity: 0.9,  pos: [ 6,  3,  3] as const },
    accent: { color: '#cfe0ee', intensity: 0.8,  pos: [ 0,  4,  6] as const },
    hemi:   { sky: '#1a2230', ground: '#080b10', intensity: 0.22 },
  },
];

function lerpStage(p: number) {
  const t = Math.min(1, Math.max(0, p));
  // 0..0.5 → A→B, 0.5..1 → B→C
  if (t <= 0.5) {
    const k = t * 2;
    return { a: STAGES[0], b: STAGES[1], k };
  }
  const k = (t - 0.5) * 2;
  return { a: STAGES[1], b: STAGES[2], k };
}

function DramaticLights({ progressRef }: { progressRef: { current: number } }) {
  const ambRef    = useRef<THREE.AmbientLight>(null);
  const keyRef    = useRef<THREE.DirectionalLight>(null);
  const fillRef   = useRef<THREE.DirectionalLight>(null);
  const accentRef = useRef<THREE.PointLight>(null);
  const hemiRef   = useRef<THREE.HemisphereLight>(null);

  // Pre-allocate Color objects so we don't churn the GC per frame.
  const tmpA = useRef(new THREE.Color());
  const tmpB = useRef(new THREE.Color());

  useFrame((_, dt) => {
    const p = progressRef.current ?? 0;
    const { a, b, k } = lerpStage(p);
    const ease = Math.min(1, dt * 3);

    const blendColor = (target: THREE.Color, ah: string, bh: string, mix: number) => {
      tmpA.current.set(ah);
      tmpB.current.set(bh).lerp(tmpA.current, 1 - mix);
      // tmpB now = lerp(a, b, mix).  Apply to target with smoothing.
      target.lerp(tmpB.current, ease);
    };
    const lerpNum = (cur: number, target: number) => cur + (target - cur) * ease;
    const lerpVec = (v: THREE.Vector3, ax: readonly number[], bx: readonly number[]) => {
      const tx = ax[0] + (bx[0] - ax[0]) * k;
      const ty = ax[1] + (bx[1] - ax[1]) * k;
      const tz = ax[2] + (bx[2] - ax[2]) * k;
      v.x = lerpNum(v.x, tx);
      v.y = lerpNum(v.y, ty);
      v.z = lerpNum(v.z, tz);
    };

    // Ambient
    if (ambRef.current) {
      blendColor(ambRef.current.color, a.amb.color, b.amb.color, k);
      ambRef.current.intensity = lerpNum(ambRef.current.intensity, a.amb.intensity + (b.amb.intensity - a.amb.intensity) * k);
    }
    // Key
    if (keyRef.current) {
      blendColor(keyRef.current.color, a.key.color, b.key.color, k);
      keyRef.current.intensity = lerpNum(keyRef.current.intensity, a.key.intensity + (b.key.intensity - a.key.intensity) * k);
      lerpVec(keyRef.current.position, a.key.pos, b.key.pos);
    }
    // Fill
    if (fillRef.current) {
      blendColor(fillRef.current.color, a.fill.color, b.fill.color, k);
      fillRef.current.intensity = lerpNum(fillRef.current.intensity, a.fill.intensity + (b.fill.intensity - a.fill.intensity) * k);
      lerpVec(fillRef.current.position, a.fill.pos, b.fill.pos);
    }
    // Accent
    if (accentRef.current) {
      blendColor(accentRef.current.color, a.accent.color, b.accent.color, k);
      accentRef.current.intensity = lerpNum(accentRef.current.intensity, a.accent.intensity + (b.accent.intensity - a.accent.intensity) * k);
      lerpVec(accentRef.current.position, a.accent.pos, b.accent.pos);
    }
    // Hemisphere
    if (hemiRef.current) {
      blendColor(hemiRef.current.color, a.hemi.sky, b.hemi.sky, k);
      blendColor(hemiRef.current.groundColor, a.hemi.ground, b.hemi.ground, k);
      hemiRef.current.intensity = lerpNum(hemiRef.current.intensity, a.hemi.intensity + (b.hemi.intensity - a.hemi.intensity) * k);
    }
  });

  // Initial values come from STAGE 0; the rig animates them per frame.
  return (
    <>
      <ambientLight  ref={ambRef}  intensity={STAGES[0].amb.intensity} color={STAGES[0].amb.color} />
      <directionalLight ref={keyRef}  position={STAGES[0].key.pos as any}  intensity={STAGES[0].key.intensity}  color={STAGES[0].key.color} />
      <directionalLight ref={fillRef} position={STAGES[0].fill.pos as any} intensity={STAGES[0].fill.intensity} color={STAGES[0].fill.color} />
      <pointLight    ref={accentRef} position={STAGES[0].accent.pos as any} intensity={STAGES[0].accent.intensity} color={STAGES[0].accent.color} />
      <hemisphereLight ref={hemiRef} args={[STAGES[0].hemi.sky, STAGES[0].hemi.ground, STAGES[0].hemi.intensity]} />
    </>
  );
}

// ---------- main canvas ----------
export default function CinematicCanvas() {
  const progressRef = useScrollProgress();
  const [dpr, setDpr] = useState<[number, number]>([1, 1.5]);

  return (
    <div
      className="cinematic-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // z-index, filter blur, and the foreground swap are owned by CSS
        // (global.css) so the scroll-driven CSS variables can drive them.
      }}
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        camera={{ fov: 32, near: 0.1, far: 100, position: [3, 1, 4] }}
      >
        <PerformanceMonitor onIncline={() => setDpr([1, 2])} onDecline={() => setDpr([1, 1.25])} />

        {/* Lighting is now scroll-driven (showroom → film noir → synthwave). */}
        <DramaticLights progressRef={progressRef} />

        <Suspense fallback={null}>
          {/* Self-hosted HDRI — keeps CSP tight (no external CDN required). */}
          <Environment files="/hdri/warehouse.hdr" environmentIntensity={0.7} />
          <Car />
          <ContactShadows
            position={[0, -0.95, 0]}
            opacity={0.6}
            scale={6}
            blur={2.4}
            far={2.6}
            color="#000"
          />
        </Suspense>

        <Rig progressRef={progressRef} />
        <Exposure />
      </Canvas>
    </div>
  );
}
