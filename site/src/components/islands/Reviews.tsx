/**
 * Reviews — Yandex business card.
 *
 * Two layers:
 *  1. Live rating summary (★ avg + count) fetched once from Yandex Search
 *     Maps API. Falls back silently to a placeholder if the API returns
 *     nothing useful (free-tier quotas vary).
 *  2. Reviews carousel: official Yandex Maps reviews widget in an iframe —
 *     this is the canonical, ToS-compliant way to surface review text.
 *
 * No personal data is sent to Yandex; only the public org id and our API
 * key (which is rate-limited at the Yandex side).
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  apiKey: string;
  placeId: string;
}

interface OrgSummary {
  name?: string;
  rating?: number;
  reviewCount?: number;
  url?: string;
}

const FALLBACK: OrgSummary = {
  name: 'АвтоЛайф',
  rating: 5.0,
  reviewCount: 0,
  url: 'https://yandex.ru/maps/org/avtolayf/15713727058/',
};

export default function Reviews({ apiKey, placeId }: Props) {
  const [summary, setSummary] = useState<OrgSummary>(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!apiKey || !placeId) { setLoaded(true); return; }
    const ctrl = new AbortController();
    const url = new URL('https://search-maps.yandex.ru/v1/');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('text',  ''); // type=biz with id is sufficient
    url.searchParams.set('type',  'biz');
    url.searchParams.set('lang',  'ru_RU');
    url.searchParams.set('id',    placeId);
    url.searchParams.set('results', '1');

    fetch(url.toString(), { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => {
        const feat = data?.features?.[0]?.properties;
        const meta = feat?.CompanyMetaData;
        const next: OrgSummary = { ...FALLBACK };
        if (meta?.name) next.name = meta.name;
        if (meta?.url)  next.url  = meta.url;
        // Search API exposes rating sometimes; keep fallback if missing
        const r = (meta as any)?.ratings?.avg ?? (feat as any)?.ratings?.avg;
        const c = (meta as any)?.ratings?.count ?? (feat as any)?.ratings?.count;
        if (typeof r === 'number') next.rating = r;
        if (typeof c === 'number') next.reviewCount = c;
        setSummary(next);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoaded(true));

    return () => ctrl.abort();
  }, [apiKey, placeId]);

  const widgetSrc = `https://yandex.ru/maps-reviews-widget/${encodeURIComponent(placeId)}?comments`;
  const stars = Math.round((summary.rating ?? 0) * 10) / 10;

  return (
    <section className="rev" id="reviews" aria-labelledby="reviews-heading">
      <div className="container rev__layout">
        {/* ── Left column: heading + rating summary ─────────────────── */}
        <div className="rev__lead-col">
          <header className="section__head rev__head">
            <p className="eyebrow">Отзывы</p>
            <h2 id="reviews-heading" className="section__title">Что говорят клиенты</h2>
            <p className="section__lead">
              Реальные отзывы из карточки организации в Яндекс.Картах. Обновляются автоматически.
            </p>
          </header>

          <div className="rev__summary glass" aria-live="polite">
            <div className="rev__rating">
              <span className="rev__rating-num" aria-label={`Рейтинг ${stars} из 5`}>{stars.toFixed(1)}</span>
              <span className="rev__stars" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`rev__star${i < Math.round(stars) ? ' is-on' : ''}`}
                  >★</span>
                ))}
              </span>
            </div>
            <div className="rev__meta">
              <p className="rev__brand">{summary.name}</p>
              <p className="rev__count">
                {summary.reviewCount && summary.reviewCount > 0
                  ? `${summary.reviewCount} ${plural(summary.reviewCount, ['отзыв', 'отзыва', 'отзывов'])} на Яндекс.Картах`
                  : 'Карточка организации в Яндекс.Картах'}
              </p>
            </div>
            <a
              href={summary.url ?? FALLBACK.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost rev__cta"
            >
              Открыть в Яндекс
            </a>
          </div>
        </div>

        {/* ── Right column: live widget iframe ──────────────────────── */}
        <div className="rev__widget-wrap">
          <div className={`rev__widget${iframeReady ? ' is-ready' : ''}`}>
            {!iframeReady && <div className="rev__skeleton" aria-hidden="true" />}
            <iframe
              ref={iframeRef}
              title="Отзывы об АвтоЛайф в Яндекс.Картах"
              src={widgetSrc}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setIframeReady(true)}
            />
          </div>
        </div>
      </div>

      <style>{`
        .rev {
          position: relative;
          z-index: 2;
          padding-block: var(--space-9);
          background: transparent;
        }
        /* Animated chrome paths-style border around the reviews container,
           inspired by kokonutd's background-paths. The conic gradient spins
           every 9s; the mask carves out the inner hole so only the 1.5px
           ring is visible. */
        .rev .container {
          position: relative;
          padding: var(--space-7) var(--space-6);
          border-radius: var(--r-lg);
          background:
            linear-gradient(180deg, rgba(8,9,11,0.65) 0%, rgba(8,9,11,0.3) 100%);
          backdrop-filter: blur(8px) saturate(140%);
          -webkit-backdrop-filter: blur(8px) saturate(140%);
          isolation: isolate;
        }
        .rev .container::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1.5px;
          pointer-events: none;
          background: conic-gradient(
            from var(--rev-ring-angle, 0deg),
            transparent 0deg,
            rgba(232,234,237,0.8) 70deg,
            rgba(154,160,166,0.4) 140deg,
            transparent 200deg,
            rgba(232,234,237,0.6) 290deg,
            transparent 360deg
          );
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
                  mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          animation: revRingSpin 9s linear infinite;
        }
        @keyframes revRingSpin {
          from { --rev-ring-angle: 0deg; }
          to   { --rev-ring-angle: 360deg; }
        }
        @property --rev-ring-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        @media (prefers-reduced-motion: reduce) {
          .rev .container::before { animation: none; }
        }
        @media (max-width: 599px) {
          .rev .container { padding: var(--space-5) var(--space-4); }
        }
        .rev__head { max-width: 60ch; margin-bottom: var(--space-6); }

        .rev__summary {
          display: flex;
          align-items: center;
          gap: var(--space-5);
          padding: var(--space-5);
          border-radius: var(--r-lg);
          margin-bottom: var(--space-5);
        }
        /* Two-column layout — copy/CTA left, live Yandex widget right. */
        .rev__layout {
          display: grid;
          gap: var(--space-5);
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
        }
        @media (min-width: 1024px) {
          .rev__layout {
            grid-template-columns: minmax(0, 1fr) 580px;
            gap: var(--space-6);
          }
        }
        .rev__lead-col { display: flex; flex-direction: column; gap: var(--space-4); }

        .rev__rating {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-right: var(--space-5);
          border-right: 1px solid var(--hairline);
        }
        .rev__rating-num {
          font-family: var(--font-wordmark);
          font-weight: 800;
          font-size: clamp(36px, 5vw, 56px);
          line-height: 1;
          background: var(--chrome-gradient);
          -webkit-background-clip: text;
                  background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .rev__stars {
          display: inline-flex;
          gap: 2px;
          font-size: 16px;
          letter-spacing: 1px;
          color: var(--text-dim);
        }
        .rev__star.is-on { color: var(--chrome-1); }

        .rev__meta { flex: 1; min-width: 0; }
        .rev__brand {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 18px;
          color: var(--text);
          margin-bottom: 2px;
        }
        .rev__count {
          color: var(--text-muted);
          font-size: 14px;
        }
        .rev__cta { padding: 10px 18px; font-size: 11px; }

        /* Yandex widget renders at its native ~580px width. On desktop it
           lives in the right column of rev__layout; on mobile it falls
           below the lead column. */
        .rev__widget-wrap {
          display: flex;
          justify-content: center;
        }
        @media (min-width: 1024px) {
          .rev__widget-wrap { justify-content: flex-end; }
        }
        .rev__widget {
          position: relative;
          width: 100%;
          max-width: 580px;
          background: #0e1013;
          border: 1px solid var(--hairline);
          border-radius: var(--r-lg);
          overflow: hidden;
          min-height: 580px;
        }
        .rev__widget iframe {
          width: 100%;
          height: 580px;
          border: 0;
          display: block;
          opacity: 0;
          transition: opacity 0.45s var(--ease-out);
          background: #fff;
          /* Yandex serves a light theme that we can't restyle directly. We
             flip the colour space via a CSS filter — invert turns the white
             background into near-black, hue-rotate restores the original
             hues so star ratings, accents and avatars don't end up cyan. */
          filter: invert(0.92) hue-rotate(180deg);
        }
        .rev__widget.is-ready iframe { opacity: 1; }

        .rev__skeleton {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg,
              transparent 0%,
              rgba(232,234,237,0.04) 35%,
              rgba(232,234,237,0.08) 50%,
              rgba(232,234,237,0.04) 65%,
              transparent 100%
            ),
            var(--graphite);
          background-size: 250% 100%, 100% 100%;
          animation: revShimmer 1.6s linear infinite;
        }
        @keyframes revShimmer {
          0%   { background-position: 100% 0, 0 0; }
          100% { background-position: -100% 0, 0 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rev__skeleton { animation: none; }
        }

        @media (max-width: 767px) {
          .rev__summary {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
          }
          .rev__rating {
            flex-direction: row;
            align-items: baseline;
            gap: var(--space-3);
            padding-right: 0;
            border-right: 0;
            padding-bottom: var(--space-3);
            border-bottom: 1px solid var(--hairline);
            width: 100%;
          }
          .rev__cta { width: 100%; text-align: center; justify-content: center; }
          .rev__widget { min-height: 520px; }
          .rev__widget iframe { height: 520px; }
        }
      `}</style>
    </section>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5)   return forms[1];
  if (b === 1)          return forms[0];
  return forms[2];
}
