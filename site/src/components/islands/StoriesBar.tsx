/**
 * StoriesBar — Instagram-style stories for the company blog.
 *
 * A horizontal row of cover circles; tapping one opens a fullscreen viewer
 * with per-slide progress bars, auto-advance, tap-to-navigate and a CTA
 * button (defaults to «Записаться» → /#booking). Reads published stories
 * from Supabase; renders nothing when there are none.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  listStoriesPublic, STORY_KIND_LABEL,
  type StoryRow, type StoryKind,
} from '../../lib/stories';

const KIND_COLOR: Record<StoryKind, string> = {
  promo:   'linear-gradient(135deg, #e8eaed, #9aa0a6)',
  service: 'linear-gradient(135deg, #58d68d, #2ecc71)',
  news:    'linear-gradient(135deg, #5dade2, #2e86de)',
};

const SLIDE_MS = 5000;

export default function StoriesBar() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    listStoriesPublic().then(rows => { if (alive) setStories(rows); });
    return () => { alive = false; };
  }, []);

  if (stories.length === 0) return null;

  return (
    <div className="stb">
      <div className="stb__row">
        {stories.map((s, i) => (
          <button key={s.id} type="button" className="stb__item" onClick={() => setOpenIdx(i)}>
            <span className="stb__ring" style={{ background: KIND_COLOR[s.kind] }}>
              <span className="stb__cover">
                {s.cover_url
                  ? <img src={s.cover_url} alt={s.title} loading="lazy" />
                  : <span className="stb__cover-fallback">{s.title.slice(0, 1) || '•'}</span>}
              </span>
            </span>
            <span className="stb__label">{s.title || STORY_KIND_LABEL[s.kind]}</span>
          </button>
        ))}
      </div>

      {openIdx !== null && typeof document !== 'undefined' && createPortal(
        <StoryViewer
          stories={stories}
          startIndex={openIdx}
          onClose={() => setOpenIdx(null)}
        />,
        document.body,
      )}

      <style>{`
        .stb { width: 100%; }
        .stb__row {
          display: flex; gap: 16px; overflow-x: auto; padding: 4px 2px 10px;
          justify-content: center;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .stb__row::-webkit-scrollbar { display: none; }
        .stb__item {
          flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;
          gap: 8px; background: none; border: 0; cursor: pointer; width: 76px;
        }
        .stb__ring {
          width: 72px; height: 72px; border-radius: 50%; padding: 2.5px;
          display: grid; place-items: center;
        }
        .stb__cover {
          width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
          border: 2.5px solid var(--bg, #08090b); display: grid; place-items: center;
          background: #14171b;
        }
        .stb__cover img { width: 100%; height: 100%; object-fit: cover; }
        .stb__cover-fallback { font-family: var(--font-display); font-size: 24px; color: var(--chrome-1); }
        .stb__label {
          font-size: 11px; color: var(--text-muted); text-align: center; line-height: 1.2;
          max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Fullscreen viewer ──────────────────────── */

function StoryViewer({
  stories, startIndex, onClose,
}: { stories: StoryRow[]; startIndex: number; onClose: () => void }) {
  const [sIdx, setSIdx] = useState(startIndex);   // story index
  const [slide, setSlide] = useState(0);          // slide index within story
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);    // 0..1 of current slide
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const story = stories[sIdx];
  const slides = story?.slides?.length ? story.slides : (story?.cover_url ? [{ url: story.cover_url }] : []);
  const total = slides.length;

  const goNextSlide = useCallback(() => {
    setSlide(prev => {
      if (prev + 1 < total) return prev + 1;
      // advance to next story
      setSIdx(si => {
        if (si + 1 < stories.length) { return si + 1; }
        onClose();
        return si;
      });
      return 0;
    });
  }, [total, stories.length, onClose]);

  const goPrevSlide = useCallback(() => {
    setSlide(prev => {
      if (prev > 0) return prev - 1;
      setSIdx(si => (si > 0 ? si - 1 : si));
      return 0;
    });
  }, []);

  // Reset timing when slide/story changes
  useEffect(() => {
    elapsedRef.current = 0;
    startRef.current = performance.now();
    setProgress(0);
  }, [sIdx, slide]);

  // Auto-advance timer
  useEffect(() => {
    if (paused || total === 0) return;
    startRef.current = performance.now() - elapsedRef.current;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      elapsedRef.current = elapsed;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) { goNextSlide(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, sIdx, slide, total, goNextSlide]);

  // Keyboard + scroll lock. Lenis runs its own RAF loop, so toggling
  // body overflow alone won't stop the page — we must pause Lenis too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNextSlide();
      else if (e.key === 'ArrowLeft') goPrevSlide();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const lenis = (window as any).__lenis;
    lenis?.stop?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lenis?.start?.();
    };
  }, [onClose, goNextSlide, goPrevSlide]);

  const handleCta = useCallback(() => {
    const href = story?.cta_href || '/#booking';
    onClose();
    const hashIdx = href.indexOf('#');
    const samePage = href.startsWith('#') || href.startsWith('/#');
    if (samePage && hashIdx !== -1) {
      const id = href.slice(hashIdx + 1);
      const el = document.getElementById(id);
      const lenis = (window as any).__lenis;
      if (el && lenis?.scrollTo) lenis.scrollTo(el);
      else if (el) el.scrollIntoView({ behavior: 'smooth' });
      else window.location.href = href;
    } else {
      window.location.href = href;
    }
  }, [story, onClose]);

  if (!story) return null;
  const cur = slides[slide];

  return (
    <div className="stv" role="dialog" aria-modal="true" aria-label={story.title}>
      <div className="stv__backdrop" onClick={onClose} />
      <div className="stv__frame">
        {/* progress bars */}
        <div className="stv__bars">
          {slides.map((_, i) => (
            <div key={i} className="stv__bar">
              <div
                className="stv__bar-fill"
                style={{ width: i < slide ? '100%' : i === slide ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="stv__head">
          <span className="stv__kind">{STORY_KIND_LABEL[story.kind]}</span>
          <span className="stv__title">{story.title}</span>
          <button type="button" className="stv__close" aria-label="Закрыть" onClick={onClose}>×</button>
        </div>

        {/* media */}
        <div className="stv__media"
             onPointerDown={() => setPaused(true)}
             onPointerUp={() => setPaused(false)}
             onPointerLeave={() => setPaused(false)}>
          {cur?.url && <img src={cur.url} alt={cur.caption ?? story.title} />}
          {cur?.caption && <div className="stv__caption">{cur.caption}</div>}
          {/* tap zones */}
          <button type="button" className="stv__tap stv__tap--prev" aria-label="Назад" onClick={goPrevSlide} />
          <button type="button" className="stv__tap stv__tap--next" aria-label="Вперёд" onClick={goNextSlide} />
        </div>

        {/* CTA */}
        <button type="button" className="stv__cta" onClick={handleCta}>
          {story.cta_label || 'Записаться'}
        </button>
      </div>

      <style>{`
        .stv { position: fixed; inset: 0; z-index: var(--z-modal, 9999); display: grid; place-items: center; }
        .stv__backdrop { position: absolute; inset: 0; background: rgba(5,6,8,0.94); backdrop-filter: blur(6px); }
        .stv__frame {
          position: relative; z-index: 1; width: min(440px, 96vw); height: min(86vh, 820px);
          display: flex; flex-direction: column; border-radius: 16px; overflow: hidden;
          background: #0e1013; border: 1px solid var(--hairline-strong, rgba(255,255,255,0.12));
        }
        .stv__bars { display: flex; gap: 4px; padding: 10px 12px 6px; }
        .stv__bar { flex: 1; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.25); overflow: hidden; }
        .stv__bar-fill { height: 100%; background: #fff; }
        .stv__head { display: flex; align-items: center; gap: 10px; padding: 4px 14px 10px; }
        .stv__kind {
          font-family: var(--font-display); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: #0b0c0e; background: var(--chrome-gradient, #e8eaed); padding: 3px 8px; border-radius: 999px;
        }
        .stv__title { color: #fff; font-size: 14px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .stv__close { background: none; border: 0; color: #fff; font-size: 26px; line-height: 1; cursor: pointer; padding: 0 4px; }
        .stv__media { position: relative; flex: 1; background: #000; display: grid; place-items: center; overflow: hidden; }
        .stv__media img { width: 100%; height: 100%; object-fit: cover; }
        .stv__caption {
          position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 16px 16px; color: #fff; font-size: 15px;
          background: linear-gradient(180deg, transparent, rgba(0,0,0,0.85));
        }
        .stv__tap { position: absolute; top: 0; bottom: 0; width: 40%; background: none; border: 0; cursor: pointer; z-index: 2; }
        .stv__tap--prev { left: 0; }
        .stv__tap--next { right: 0; width: 60%; }
        .stv__cta {
          margin: 12px; padding: 14px; border-radius: 12px; border: 0; cursor: pointer;
          font-family: var(--font-display); font-weight: 700; font-size: 15px; color: #0b0c0e;
          background: var(--chrome-gradient, #e8eaed); box-shadow: var(--shadow-chrome, 0 6px 20px rgba(0,0,0,0.4));
        }
      `}</style>
    </div>
  );
}
