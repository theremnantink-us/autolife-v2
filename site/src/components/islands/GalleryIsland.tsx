/**
 * GalleryIsland — public bento gallery, hydrated on the client.
 *
 * Reads items from Supabase (`gallery_items`) so the gallery is fully
 * editable from the admin panel. Falls back to the static list when
 * Supabase is unconfigured or empty. Preserves the original bento layout,
 * category filters and lightbox behaviour.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { listGalleryPublic, type GalleryRow } from '../../lib/gallery';
import { galleryFilters } from '../../data/gallery';

/** Bento size class cycles every 6 tiles — matches the original layout. */
function sizeClass(i: number): string {
  return `gb--${(i % 6) + 1}`;
}

export default function GalleryIsland() {
  const [items, setItems]   = useState<GalleryRow[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    listGalleryPublic().then(rows => { if (alive) setItems(rows); });
    return () => { alive = false; };
  }, []);

  const visible = useMemo(
    () => items.filter(it => filter === 'all' || it.category === filter),
    [items, filter],
  );

  const close = useCallback(() => setLbIndex(null), []);
  const step  = useCallback((delta: number) => {
    setLbIndex(cur => {
      if (cur === null || visible.length === 0) return cur;
      return (cur + delta + visible.length) % visible.length;
    });
  }, [visible.length]);

  useEffect(() => {
    if (lbIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(+1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lbIndex, close, step]);

  const lbItem = lbIndex !== null ? visible[lbIndex] : null;

  return (
    <>
      <div className="gal-filters" role="tablist" aria-label="Фильтр галереи">
        {galleryFilters.map(f => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              className={`gal-filter${on ? ' is-active' : ''}`}
              role="tab"
              aria-selected={on ? 'true' : 'false'}
              onClick={() => setFilter(f.id)}
            >{f.label}</button>
          );
        })}
      </div>

      <div className="gal-bento">
        {visible.map((item, i) => (
          <figure key={item.id} className={`gb ${sizeClass(i)}`} data-category={item.category}>
            <button
              type="button"
              className="gb__btn"
              aria-label={`Открыть: ${item.title} — ${item.caption}`}
              onClick={() => setLbIndex(i)}
            >
              <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
              {item.caption && <span className="gb__chip">{item.caption}</span>}
              <figcaption className="gb__cap">
                <span className="gb__title">{item.title}</span>
                <span className="gb__open" aria-hidden="true">↗</span>
              </figcaption>
            </button>
          </figure>
        ))}
      </div>

      {lbItem && (
        <div
          className="lb"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр работы"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <button className="lb__close" type="button" aria-label="Закрыть" onClick={close}>×</button>
          <button className="lb__nav lb__prev" type="button" aria-label="Предыдущее" onClick={() => step(-1)}>‹</button>
          <button className="lb__nav lb__next" type="button" aria-label="Следующее" onClick={() => step(+1)}>›</button>
          <figure className="lb__frame">
            <img id="lb-img" src={lbItem.src} alt={lbItem.alt} />
            <figcaption className="lb__cap">
              <h3 id="lb-title">{lbItem.title}</h3>
              <p id="lb-sub">{lbItem.caption}</p>
            </figcaption>
          </figure>
        </div>
      )}

      <style>{`
        .gal-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: var(--space-6); }
        .gal-filter {
          padding: 10px 18px; border-radius: 999px;
          font-family: var(--font-display); font-size: 12px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-muted); background: var(--bg-elev);
          border: 1px solid var(--hairline); cursor: pointer;
          transition: color var(--dur-fast) var(--ease-out),
                      background var(--dur-fast) var(--ease-out),
                      border-color var(--dur-fast) var(--ease-out);
        }
        .gal-filter:hover { color: var(--text); border-color: var(--hairline-strong); }
        .gal-filter.is-active {
          background: var(--chrome-gradient); color: #0b0c0e;
          border-color: rgba(255,255,255,0.25); box-shadow: var(--shadow-chrome);
        }

        .gal-bento {
          display: grid; grid-template-columns: repeat(12, 1fr);
          grid-auto-rows: 220px; gap: var(--space-4);
        }
        .gb--1 { grid-column: span 7; grid-row: span 2; }
        .gb--2 { grid-column: span 5; grid-row: span 1; }
        .gb--3 { grid-column: span 5; grid-row: span 1; }
        .gb--4 { grid-column: span 4; grid-row: span 1; }
        .gb--5 { grid-column: span 4; grid-row: span 1; }
        .gb--6 { grid-column: span 4; grid-row: span 1; }

        @media (max-width: 1023px) {
          .gal-bento { grid-template-columns: repeat(6, 1fr); grid-auto-rows: 200px; }
          .gb--1 { grid-column: span 6; grid-row: span 2; }
          .gb--2, .gb--3 { grid-column: span 3; }
          .gb--4, .gb--5, .gb--6 { grid-column: span 2; }
        }
        @media (max-width: 599px) {
          .gal-bento { grid-template-columns: 1fr; grid-auto-rows: 240px; }
          .gb--1, .gb--2, .gb--3, .gb--4, .gb--5, .gb--6 { grid-column: 1; grid-row: span 1; }
          .gb--1 { grid-row: span 2; }
        }

        .gb {
          position: relative; border-radius: var(--r-lg); overflow: hidden;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur)) saturate(140%);
          -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
          border: 1px solid var(--hairline); isolation: isolate;
          transition: transform 0.35s var(--ease-out), border-color 0.35s var(--ease-out),
                      background 0.35s var(--ease-out);
        }
        .gb:hover { border-color: var(--hairline-strong); background: rgba(22, 25, 29, 0.72); }
        .gb__btn {
          display: block; width: 100%; height: 100%; position: relative;
          background: transparent; border: 0; padding: 0; cursor: pointer;
          border-radius: inherit; overflow: hidden;
        }
        .gb__btn img {
          width: 100%; height: 100%; object-fit: cover; filter: saturate(1.05);
          transition: transform 1s var(--ease-out), filter 0.4s var(--ease-out);
        }
        .gb:hover .gb__btn img { transform: scale(1.06); filter: saturate(1.15) brightness(1.05); }
        .gb__chip {
          position: absolute; top: 14px; left: 14px; padding: 5px 10px;
          border-radius: var(--r-sm); background: rgba(8,9,11,0.6);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--hairline-strong);
          font-family: var(--font-display); font-size: 11px; font-weight: 600;
          letter-spacing: 0.06em; color: var(--chrome-1);
        }
        .gb__cap {
          position: absolute; inset: auto 0 0 0; display: flex; align-items: center;
          justify-content: space-between; padding: 14px 16px; color: var(--text);
          background: linear-gradient(180deg, transparent 0%, rgba(8,9,11,0.92) 100%);
          transform: translateY(8px); opacity: 0;
          transition: opacity 0.35s var(--ease-out), transform 0.35s var(--ease-out);
        }
        .gb:hover .gb__cap, .gb:focus-within .gb__cap { opacity: 1; transform: translateY(0); }
        .gb__title { font-family: var(--font-display); font-weight: 600; font-size: 16px; }
        .gb__open { font-size: 18px; color: var(--chrome-1); transition: transform var(--dur-fast) var(--ease-out); }
        .gb:hover .gb__open { transform: translateX(2px) translateY(-2px); }

        .lb {
          position: fixed; inset: 0; z-index: var(--z-modal); display: grid;
          place-items: center; background: rgba(8,9,11,0.92);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          padding: var(--space-5);
        }
        .lb__frame {
          max-width: min(96vw, 1400px); max-height: 86vh; display: flex;
          flex-direction: column; align-items: center; gap: var(--space-3);
        }
        #lb-img {
          max-width: 100%; max-height: 78vh; object-fit: contain;
          border-radius: var(--r-md); box-shadow: 0 20px 80px rgba(0,0,0,0.7);
          background: var(--graphite);
        }
        .lb__cap { text-align: center; }
        #lb-title { font-family: var(--font-display); font-weight: 600; font-size: 18px; color: var(--text); }
        #lb-sub { color: var(--chrome-2); font-size: 14px; margin-top: 4px; }
        .lb__close, .lb__nav {
          position: absolute; background: var(--glass-bg);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--hairline-strong); color: var(--chrome-1);
          border-radius: 50%; width: 44px; height: 44px; font-size: 22px;
          line-height: 1; display: grid; place-items: center; cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        }
        .lb__close:hover, .lb__nav:hover { background: rgba(232,234,237,0.18); transform: scale(1.05); }
        .lb__close { top: 20px; right: 20px; }
        .lb__prev { top: 50%; left: 20px; transform: translateY(-50%); }
        .lb__next { top: 50%; right: 20px; transform: translateY(-50%); }
        .lb__prev:hover { transform: translateY(-50%) scale(1.05); }
        .lb__next:hover { transform: translateY(-50%) scale(1.05); }
        @media (max-width: 599px) {
          .lb__close, .lb__nav { width: 38px; height: 38px; font-size: 18px; }
          .lb__prev { left: 10px; }
          .lb__next { right: 10px; }
        }
      `}</style>
    </>
  );
}
