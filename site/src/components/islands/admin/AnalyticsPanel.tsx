/**
 * AnalyticsPanel — internal analytics built from the bookings table.
 *
 * No revenue figures (intentionally omitted, see CLAUDE.md). Focuses on
 * volume, service mix, status funnel and load distribution so the owner
 * can see demand at a glance. External web analytics (Yandex Metrika,
 * Google Analytics) run on the public site separately.
 */
import { useEffect, useMemo, useState } from 'react';
import { listBookings, type BookingRow } from '../../../lib/bookings';

const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type Range = 30 | 90 | 365;

export default function AnalyticsPanel() {
  const [rows, setRows]     = useState<BookingRow[]>([]);
  const [loading, setLoad]  = useState(true);
  const [range, setRange]   = useState<Range>(30);

  useEffect(() => {
    setLoad(true);
    listBookings().then(setRows).finally(() => setLoad(false));
  }, []);

  const stats = useMemo(() => compute(rows, range), [rows, range]);

  if (loading) return <div className="anp__empty">Загрузка статистики…</div>;

  return (
    <div className="anp">
      <div className="anp__bar">
        <div>
          <h2 className="anp__h">Аналитика</h2>
          <p className="anp__sub">По данным записей · период {range} дн.</p>
        </div>
        <div className="anp__range">
          {([30, 90, 365] as Range[]).map(r => (
            <button key={r} className={`anp__rb${range === r ? ' is-active' : ''}`} onClick={() => setRange(r)}>
              {r === 365 ? 'Год' : `${r} дн.`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="anp__cards">
        <Kpi label="Всего записей" val={stats.total} hint="за период" />
        <Kpi label="Новые" val={stats.byStatus.new} hint="ожидают" />
        <Kpi label="Подтверждено" val={stats.byStatus.confirmed} />
        <Kpi label="Выполнено" val={stats.byStatus.done} />
        <Kpi label="Отменено" val={stats.byStatus.cancelled} />
        <Kpi label="В среднем в день" val={stats.perDay} hint={`пик ${stats.peak} / день`} />
      </div>

      {/* Daily volume */}
      <section className="anp__block">
        <h3 className="anp__bh">Записи по дням</h3>
        <div className="anp__spark">
          {stats.daily.map((d, i) => (
            <div key={i} className="anp__spark-col" title={`${d.label}: ${d.count}`}>
              <div className="anp__spark-bar" style={{ height: `${stats.maxDaily ? (d.count / stats.maxDaily) * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="anp__spark-axis"><span>{stats.daily[0]?.label}</span><span>{stats.daily[stats.daily.length - 1]?.label}</span></div>
      </section>

      <div className="anp__two">
        {/* Top services */}
        <section className="anp__block">
          <h3 className="anp__bh">Популярные услуги</h3>
          {stats.services.length === 0 ? <p className="anp__empty">Нет данных</p> : (
            <div className="anp__bars">
              {stats.services.map(s => (
                <div key={s.name} className="anp__row">
                  <span className="anp__row-lb" title={s.name}>{s.name}</span>
                  <span className="anp__row-track"><span className="anp__row-fill" style={{ width: `${(s.count / stats.services[0].count) * 100}%` }} /></span>
                  <span className="anp__row-n">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Load by weekday */}
        <section className="anp__block">
          <h3 className="anp__bh">Загрузка по дням недели</h3>
          <div className="anp__bars">
            {stats.weekday.map((c, i) => (
              <div key={i} className="anp__row">
                <span className="anp__row-lb">{DOW[i]}</span>
                <span className="anp__row-track"><span className="anp__row-fill" style={{ width: `${stats.maxWeekday ? (c / stats.maxWeekday) * 100 : 0}%` }} /></span>
                <span className="anp__row-n">{c}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .anp { display: flex; flex-direction: column; gap: 18px; }
        .anp__bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .anp__h { font-family: var(--font-display); font-size: 20px; margin: 0; }
        .anp__sub { color: var(--text-muted); font-size: 13px; margin: 4px 0 0; }
        .anp__range { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--aap-border, rgba(255,255,255,0.08)); border-radius: 999px; }
        .anp__rb { padding: 7px 14px; border-radius: 999px; border: 0; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; }
        .anp__rb.is-active { background: var(--chrome-gradient); color: #0b0c0e; }
        .anp__empty { color: var(--text-muted); padding: 24px 0; text-align: center; }

        .anp__cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        .anp__card { padding: 16px; border-radius: var(--r-lg); background: var(--glass-bg); border: 1px solid var(--aap-border, rgba(255,255,255,0.08)); }
        .anp__card-lb { color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
        .anp__card-v { font-size: 28px; font-weight: 700; margin-top: 6px; color: var(--text); font-variant-numeric: tabular-nums; }
        .anp__card-h { color: var(--text-muted); font-size: 12px; margin-top: 4px; }

        .anp__block { padding: 16px; border-radius: var(--r-lg); background: var(--glass-bg); border: 1px solid var(--aap-border, rgba(255,255,255,0.08)); }
        .anp__bh { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--chrome-2); margin: 0 0 14px; }
        .anp__two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 760px) { .anp__two { grid-template-columns: 1fr; } }

        .anp__spark { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
        .anp__spark-col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .anp__spark-bar { width: 100%; min-height: 2px; border-radius: 2px 2px 0 0;
          background: linear-gradient(180deg, var(--chrome-1, #e8eaed), rgba(154,160,166,0.4)); }
        .anp__spark-axis { display: flex; justify-content: space-between; color: var(--text-muted); font-size: 11px; margin-top: 6px; }

        .anp__bars { display: flex; flex-direction: column; gap: 9px; }
        .anp__row { display: grid; grid-template-columns: 130px 1fr 36px; align-items: center; gap: 10px; }
        .anp__row-lb { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .anp__row-track { height: 10px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .anp__row-fill { display: block; height: 100%; border-radius: 999px; background: var(--chrome-gradient, #e8eaed); }
        .anp__row-n { font-size: 13px; color: var(--text-muted); text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

function Kpi({ label, val, hint }: { label: string; val: number | string; hint?: string }) {
  return (
    <div className="anp__card">
      <div className="anp__card-lb">{label}</div>
      <div className="anp__card-v">{val}</div>
      {hint && <div className="anp__card-h">{hint}</div>}
    </div>
  );
}

interface Stats {
  total: number;
  byStatus: { new: number; confirmed: number; done: number; cancelled: number };
  daily: { label: string; count: number }[];
  maxDaily: number;
  services: { name: string; count: number }[];
  weekday: number[];
  maxWeekday: number;
  perDay: number;
  peak: number;
}

function compute(rows: BookingRow[], range: Range): Stats {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - range);

  const dateOf = (b: BookingRow) => new Date(b.created_at || b.slot_start || now);
  const within = rows.filter(b => dateOf(b) >= since);

  const byStatus = { new: 0, confirmed: 0, done: 0, cancelled: 0 };
  const serviceMap = new Map<string, number>();
  const weekday = [0, 0, 0, 0, 0, 0, 0];

  for (const b of within) {
    const s = (b.status ?? 'new') as keyof typeof byStatus;
    if (s in byStatus) byStatus[s]++;
    const svc = (b.service ?? '').trim();
    if (svc) serviceMap.set(svc, (serviceMap.get(svc) ?? 0) + 1);
    const d = dateOf(b);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    weekday[dow]++;
  }

  // Daily buckets — cap visible columns so very long ranges stay readable.
  const buckets = Math.min(range, 60);
  const msPer = (range * 86400000) / buckets;
  const daily: { label: string; count: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = since.getTime() + i * msPer;
    const end = start + msPer;
    const count = within.filter(b => { const t = dateOf(b).getTime(); return t >= start && t < end; }).length;
    const d = new Date(start);
    daily.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, count });
  }

  const services = [...serviceMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total: within.length,
    byStatus,
    daily,
    maxDaily: Math.max(1, ...daily.map(d => d.count)),
    services,
    weekday,
    maxWeekday: Math.max(1, ...weekday),
    perDay: within.length ? Math.round((within.length / range) * 10) / 10 : 0,
    peak: Math.max(0, ...daily.map(d => d.count)),
  };
}
