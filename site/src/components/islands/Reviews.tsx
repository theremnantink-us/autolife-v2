/**
 * Reviews — Yandex business card.
 *
 * Left column: live rating summary fetched from Yandex Search Maps API.
 * Right column: static review cards (Yandex's widget iframe is blocked by
 * their own X-Frame-Options: sameorigin on external domains).
 */

import { useEffect, useState } from 'react';
import { fallbackReviews, type Review } from '../../content/reviews';

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

function StarRow({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="rev__stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`rev__star${i < filled ? ' is-on' : ''}`}>★</span>
      ))}
    </span>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const d = new Date(r.date);
  const label = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
  return (
    <article className="rev-card glass">
      <header className="rev-card__head">
        <div className="rev-card__avatar" aria-hidden="true">
          {r.author.charAt(0)}
        </div>
        <div>
          <p className="rev-card__author">{r.author}</p>
          <p className="rev-card__car">{r.car}</p>
        </div>
        <StarRow rating={r.rating} />
      </header>
      <blockquote className="rev-card__text">{r.text}</blockquote>
      <footer className="rev-card__footer">
        <span className="rev-card__date">{label}</span>
        <span className="rev-card__badge">Яндекс.Карты</span>
      </footer>
    </article>
  );
}

export default function Reviews({ apiKey, placeId }: Props) {
  const [summary, setSummary] = useState<OrgSummary>(FALLBACK);

  useEffect(() => {
    if (!apiKey || !placeId) return;
    const ctrl = new AbortController();
    const url = new URL('https://search-maps.yandex.ru/v1/');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('text',  '');
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
        const r2 = (meta as any)?.ratings?.avg ?? (feat as any)?.ratings?.avg;
        const c  = (meta as any)?.ratings?.count ?? (feat as any)?.ratings?.count;
        if (typeof r2 === 'number') next.rating = r2;
        if (typeof c  === 'number') next.reviewCount = c;
        setSummary(next);
      })
      .catch(() => { /* keep fallback */ });

    return () => ctrl.abort();
  }, [apiKey, placeId]);

  const stars = Math.round((summary.rating ?? 0) * 10) / 10;
  const yandexUrl = summary.url ?? FALLBACK.url;

  return (
    <section className="rev" id="reviews" aria-labelledby="reviews-heading">
      <div className="container rev__layout">

        {/* ── Left column: heading + rating summary ─────────────────── */}
        <div className="rev__lead-col">
          <header className="section__head rev__head">
            <p className="eyebrow">Отзывы</p>
            <h2 id="reviews-heading" className="section__title">Что говорят клиенты</h2>
            <p className="section__lead">
              Реальные отзывы клиентов АвтоЛайф. Все отзывы также доступны на Яндекс.Картах.
            </p>
          </header>

          <div className="rev__summary glass" aria-live="polite">
            <div className="rev__rating">
              <span
                className="rev__rating-num"
                aria-label={`Рейтинг ${stars} из 5`}
              >
                {stars.toFixed(1)}
              </span>
              <StarRow rating={stars} />
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
              href={yandexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost rev__cta"
            >
              Все отзывы →
            </a>
          </div>
        </div>

        {/* ── Right column: static review cards ─────────────────────── */}
        <div className="rev__cards-col">
          {fallbackReviews.map((r, i) => (
            <ReviewCard key={i} r={r} />
          ))}
          <a
            href={yandexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rev__more-link"
          >
            Читать все отзывы на Яндекс.Картах →
          </a>
        </div>
      </div>

      <style>{`
        .rev {
          position: relative;
          z-index: 2;
          padding-block: var(--space-9);
          background: transparent;
        }
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
        .rev__layout {
          display: grid;
          gap: var(--space-5);
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
        }
        @media (min-width: 1024px) {
          .rev__layout {
            grid-template-columns: minmax(0, 1fr) 520px;
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

        /* ── Review cards ─── */
        .rev__cards-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .rev-card {
          padding: var(--space-5);
          border-radius: var(--r-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .rev-card__head {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .rev-card__avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--graphite);
          border: 1px solid var(--hairline);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 16px;
          color: var(--chrome-1);
          flex-shrink: 0;
        }
        .rev-card__author {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 15px;
          color: var(--text);
        }
        .rev-card__car {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 1px;
        }
        .rev-card__head .rev__stars {
          margin-left: auto;
          font-size: 13px;
        }
        .rev-card__text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-dim);
          margin: 0;
          border-left: 2px solid var(--hairline);
          padding-left: var(--space-3);
          font-style: italic;
        }
        .rev-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }
        .rev-card__date {
          font-size: 12px;
          color: var(--text-muted);
        }
        .rev-card__badge {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-dim);
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--hairline);
          border-radius: 4px;
          padding: 2px 8px;
        }
        .rev__more-link {
          display: block;
          text-align: center;
          font-size: 13px;
          color: var(--text-muted);
          text-decoration: none;
          padding: var(--space-3);
          border: 1px solid var(--hairline);
          border-radius: var(--r-lg);
          transition: color 0.2s, border-color 0.2s;
        }
        .rev__more-link:hover {
          color: var(--chrome-1);
          border-color: var(--chrome-1);
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
