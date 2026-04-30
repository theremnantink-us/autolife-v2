/**
 * BackgroundPaths — animated SVG curves flowing across the page,
 * inspired by kokonutd's background-paths on 21st.dev.
 *
 * Visual: two layered sets of 36 cascading paths, each animated with
 * framer-motion's pathLength / opacity / pathOffset. Stroke colour is
 * chrome-tinted; opacity stays low so the AMG GT 3D scene reads on top.
 */

import { motion } from 'motion/react';

interface FloatingPathsProps {
  position: number;
}

function FloatingPaths({ position }: FloatingPathsProps) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d:
      `M-${380 - i * 5 * position} -${189 + i * 6}` +
      `C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}` +
      `C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <svg
      className="bgpaths__svg"
      viewBox="0 0 696 316"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((p) => (
        <motion.path
          key={p.id}
          d={p.d}
          stroke="currentColor"
          strokeWidth={p.width}
          strokeOpacity={0.08 + p.id * 0.012}
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{
            pathLength: 1,
            opacity: [0.25, 0.55, 0.25],
            pathOffset: [0, 1, 0],
          }}
          transition={{
            duration: 22 + Math.random() * 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  );
}

export default function BackgroundPaths() {
  return (
    <div
      className="bgpaths"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,                       // beneath CinematicCanvas (z 1)
        pointerEvents: 'none',
        color: '#9aa0a6',                // chrome-2 — currentColor for paths
        overflow: 'hidden',
      }}
    >
      <div className="bgpaths__layer">
        <FloatingPaths position={1} />
      </div>
      <div className="bgpaths__layer bgpaths__layer--mirrored">
        <FloatingPaths position={-1} />
      </div>

      <style>{`
        .bgpaths__layer {
          position: absolute;
          inset: 0;
        }
        .bgpaths__svg {
          position: absolute;
          inset: -10% -10%;
          width: 120%;
          height: 120%;
        }
        .bgpaths__layer--mirrored {
          transform: scaleX(-1);
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
