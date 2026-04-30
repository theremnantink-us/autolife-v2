/**
 * AdminApp — single React island that holds the three admin panels:
 *
 *   1. Дашборд      — статистика (визиты, записи, выручка, активность)
 *   2. Записи       — контроль записей (просмотр, смена статуса, mark complete)
 *   3. Зарплаты     — калькулятор зарплат + авансов + смен админов
 *
 * State lives in localStorage via src/lib/admin/store.ts. Pure functions in
 * src/lib/admin/salary.ts. UI is glass-styled to match the rest of the site.
 *
 * When Supabase lands, swap the store imports and the UI is unaffected.
 */

import { useEffect, useMemo, useState } from 'react';
import { employees, type Employee } from '../../../data/employees';
import {
  appointmentsStore, deductionsStore, accrualsStore,
  seedIfEmpty, resetAll,
} from '../../../lib/admin/store';
import { unpaidSummary } from '../../../lib/admin/payout';
import type {
  AppointmentRecord, Deduction,
} from '../../../lib/admin/types';
import { supabase } from '../../../lib/supabase';
import Journal from './Journal';
import PayrollPanel from './PayrollPanel';
import DeductionsPanel from './DeductionsPanel';
import AdminLogin from './AdminLogin';
import AdminBookingCalendar from './AdminBookingCalendar';

type Tab = 'dashboard' | 'bookings' | 'calendar' | 'journal' | 'salaries' | 'deductions';

export default function AdminApp() {
  const [tab, setTab]         = useState<Tab>('dashboard');
  const [tick, setTick]       = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed]   = useState(false);

  // Auth check — runs once on mount
  useEffect(() => {
    if (!supabase) {
      // Supabase not configured: allow access so dev can still work locally
      setAuthed(true);
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Seed sample data on first open so the panels aren't empty.
  useEffect(() => { if (authed) { seedIfEmpty(); setTick(t => t + 1); } }, [authed]);

  // Cross-tab: jump to journal when PayoutForm fires autolife:focus-accrual
  useEffect(() => {
    const handler = () => setTab('journal');
    window.addEventListener('autolife:focus-accrual', handler);
    return () => window.removeEventListener('autolife:focus-accrual', handler);
  }, []);

  useEffect(() => {
    const handler = () => setTab('salaries');
    window.addEventListener('autolife:focus-payout', handler);
    return () => window.removeEventListener('autolife:focus-payout', handler);
  }, []);

  useEffect(() => {
    const handler = () => setTab('deductions');
    window.addEventListener('autolife:focus-deductions', handler);
    return () => window.removeEventListener('autolife:focus-deductions', handler);
  }, []);

  // Force re-pull from store after any mutation
  const refresh = () => setTick(t => t + 1);

  const apps        = useMemo<AppointmentRecord[]>(() => appointmentsStore.list(),  [tick]);
  const deductions  = useMemo<Deduction[]>        (() => deductionsStore.list(),   [tick]);

  // Auth loading / login screens
  if (!authReady) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>Загрузка…</div>;
  }
  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setAuthed(false);
  }

  return (
    <div className="aap">
      <header className="aap__head">
        <h1 className="aap__title">Админ-панель</h1>
        <nav className="aap__tabs" role="tablist">
          {([
            ['dashboard', 'Статистика'],
            ['bookings',  'Записи'],
            ['calendar',  'Календарь'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`aap__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id as Tab)}
            >{label}</button>
          ))}
          <span className={`aap__tabs-group${(tab === 'journal' || tab === 'salaries' || tab === 'deductions') ? ' is-active' : ''}`}>
            {([
              ['journal',    'Журнал'],
              ['salaries',   'Зарплаты'],
              ['deductions', 'Удержания'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`aap__tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id as Tab)}
              >{label}</button>
            ))}
          </span>
        </nav>
        <button
          type="button"
          className="aap__reset"
          onClick={() => { if (confirm('Сбросить все локальные данные админки?')) { resetAll(); seedIfEmpty(); refresh(); } }}
          title="Сбросить демо-данные"
        >Сброс</button>
        {supabase && (
          <button type="button" className="aap__reset" onClick={handleLogout} title="Выйти">Выйти</button>
        )}
      </header>

      {tab === 'dashboard' && <Dashboard apps={apps} deductions={deductions} />}
      {tab === 'bookings'  && <Bookings  apps={apps} onChange={refresh} />}
      {tab === 'calendar'  && <AdminBookingCalendar onChange={refresh} />}
      {tab === 'journal'   && <Journal   tick={tick} onChange={refresh} />}
      {tab === 'salaries'   && <PayrollPanel    tick={tick} onChange={refresh} />}
      {tab === 'deductions' && <DeductionsPanel tick={tick} onChange={refresh} />}

      <Style />
    </div>
  );
}

function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

/* ───────────────────────────── Dashboard ──────────────────────────── */

function Dashboard({ apps, deductions }: {
  apps: AppointmentRecord[]; deductions: Deduction[];
}) {
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const isThisMonth = (iso?: string) => iso && iso.slice(0, 10) >= monthStart;

  const completed = apps.filter(a => a.status === 'completed' && isThisMonth(a.completedAt)).length;
  const upcoming  = apps.filter(a => a.status === 'new' || a.status === 'confirmed').length;
  const advTotal  = deductions.filter(a => isThisMonth(a.givenAt)).reduce((s, a) => s + a.amount, 0);

  const accrualsAll    = accrualsStore.list();
  const deductionsAll  = deductionsStore.list();
  const totalUnpaid = employees.reduce(
    (sum, emp) => sum + Math.max(0, unpaidSummary(emp.id, accrualsAll, deductionsAll).total),
    0,
  );

  return (
    <div className="aap__panel">
      <div className="aap__cards">
        <Card label="Выполнено за месяц" value={String(completed)}       hint="завершённых записей" />
        <Card label="Активные записи"    value={String(upcoming)}        hint="новые + подтверждённые" />
        <Card label="Висит к выплате"    value={formatRub(totalUnpaid)}  hint="по всем сотрудникам" />
        <Card label="Выданные авансы"    value={formatRub(advTotal)}     hint="за текущий месяц" />
      </div>

      <h3 className="aap__h3">Активность за 14 дней</h3>
      <ActivityStrip apps={apps} />

      <h3 className="aap__h3">Зарплаты</h3>
      <p className="aap__lead">
        Перейдите в раздел <b>Зарплаты</b> чтобы посмотреть начисления и выплатить сотрудникам.
      </p>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="aap-card">
      <p className="aap-card__label">{label}</p>
      <p className="aap-card__val">{value}</p>
      {hint && <p className="aap-card__hint">{hint}</p>}
    </div>
  );
}

function ActivityStrip({ apps }: { apps: AppointmentRecord[] }) {
  // 14-day mini-bar chart of completed bookings per day.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const count = apps.filter(a => a.completedAt?.slice(0, 10) === iso).length;
    days.push({ date: iso, count });
  }
  const max = Math.max(1, ...days.map(d => d.count));
  return (
    <div className="aap-act">
      {days.map(d => (
        <div key={d.date} className="aap-act__col" title={`${d.date}: ${d.count}`}>
          <div className="aap-act__bar" style={{ height: `${(d.count / max) * 100}%` }}></div>
          <span className="aap-act__lbl">{d.date.slice(8, 10)}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Bookings ───────────────────────────── */

function Bookings({ apps, onChange }: { apps: AppointmentRecord[]; onChange: () => void; }) {
  const [filter, setFilter] = useState<'all' | AppointmentRecord['status']>('all');
  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => b.slotStart.localeCompare(a.slotStart));

  const setStatus = (id: string, status: AppointmentRecord['status']) => {
    const a = apps.find(x => x.id === id);
    if (!a) return;
    const completedAt = status === 'completed' ? new Date().toISOString() : a.completedAt;
    appointmentsStore.upsert({ ...a, status, completedAt });
    onChange();
  };
  const remove = (id: string) => {
    if (!confirm('Удалить запись?')) return;
    appointmentsStore.remove(id);
    onChange();
  };

  return (
    <div className="aap__panel">
      <div className="aap__filter-row">
        {(['all', 'new', 'confirmed', 'completed', 'cancelled', 'no-show'] as const).map(s => (
          <button
            key={s}
            className={`aap-pill${filter === s ? ' is-active' : ''}`}
            onClick={() => setFilter(s)}
          >{statusLabel(s)}</button>
        ))}
        <span className="aap__count">{filtered.length}</span>
      </div>

      <div className="aap-table">
        <div className="aap-table__head">
          <span>Дата</span><span>Клиент</span><span>Авто</span>
          <span>Услуга</span><span>Цена</span><span>Мастер</span>
          <span>Статус</span><span>Действия</span>
        </div>
        {sorted.length === 0 && <p className="aap__empty">Записей нет.</p>}
        {sorted.map(a => (
          <div key={a.id} className="aap-table__row">
            <span className="aap-table__date">{formatDate(a.slotStart)}</span>
            <span>
              <div>{a.customerName}</div>
              <div className="aap-table__sub"><a href={`tel:${a.customerPhone.replace(/\s/g,'')}`}>{a.customerPhone}</a></div>
            </span>
            <span>{a.carBrand} {a.carModel}</span>
            <span className="aap-table__svc">{a.serviceName}</span>
            <span className="aap-table__price">{formatRub(a.servicePrice)}</span>
            <span>{employeeName(a.masterId) ?? '—'}</span>
            <span>
              <select
                className="aap-select"
                value={a.status}
                onChange={e => setStatus(a.id, e.target.value as AppointmentRecord['status'])}
              >
                {(['new', 'confirmed', 'completed', 'cancelled', 'no-show'] as const).map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </span>
            <span>
              <button className="aap-mini aap-mini--danger" onClick={() => remove(a.id)} title="Удалить">×</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(s: 'all' | AppointmentRecord['status']): string {
  return ({
    all: 'Все', new: 'Новые', confirmed: 'Подтверждены',
    completed: 'Выполнены', cancelled: 'Отменены', 'no-show': 'Не пришли',
  } as const)[s];
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function employeeName(id: string | null): string | null {
  if (!id) return null;
  return employees.find((e: Employee) => e.id === id)?.name ?? id;
}


/* ───────────────────────────── Styles ─────────────────────────────── */

function Style() {
  return <style>{`
    .aap {
      --aap-border: rgba(232,234,237,0.10);
      --aap-text:   #e6e8ec;
      --aap-dim:    #8a9099;
      color: var(--aap-text);
      font-family: var(--font-display);
    }

    .aap__head {
      display: flex; align-items: center; gap: var(--space-4);
      margin-bottom: var(--space-5);
      flex-wrap: wrap;
    }
    .aap__title {
      font-size: clamp(22px, 3vw, 30px); font-weight: 700;
      letter-spacing: -0.01em; color: var(--text);
      margin-right: auto;
    }
    .aap__tabs {
      display: inline-flex; gap: 6px;
      padding: 4px;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur)) saturate(140%);
      border: 1px solid var(--aap-border);
      border-radius: 999px;
    }
    .aap__tab {
      padding: 8px 16px; border-radius: 999px;
      font-family: inherit; font-weight: 600; font-size: 12px;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--aap-dim); background: transparent;
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
    }
    .aap__tab:hover { color: var(--text); }
    .aap__tab.is-active { background: var(--chrome-gradient); color: #0b0c0e; box-shadow: var(--shadow-chrome); }
    .aap__reset {
      padding: 8px 14px; border-radius: 999px;
      font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
      color: var(--aap-dim); border: 1px solid var(--aap-border);
      background: rgba(8,9,11,0.45);
      backdrop-filter: blur(8px);
    }

    .aap__panel { display: flex; flex-direction: column; gap: var(--space-5); }
    .aap__h3   { font-size: 14px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chrome-2); margin-top: var(--space-4); }
    .aap__lead { color: var(--text-muted); font-size: 14px; line-height: 1.55; max-width: 64ch; }
    .aap__empty { color: var(--aap-dim); font-style: italic; padding: var(--space-3); }

    /* Cards row */
    .aap__cards {
      display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .aap-card {
      padding: var(--space-4);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur)) saturate(140%);
      border: 1px solid var(--aap-border);
      border-radius: var(--r-lg);
    }
    .aap-card__label { color: var(--aap-dim); font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
    .aap-card__val   { font-size: clamp(22px, 2.4vw, 28px); font-weight: 700; margin-top: 6px; color: var(--text); font-variant-numeric: tabular-nums; }
    .aap-card__hint  { color: var(--aap-dim); font-size: 12px; margin-top: 4px; }

    /* Activity strip */
    .aap-act {
      display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px;
      height: 96px; align-items: end;
      padding: var(--space-3);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--aap-border);
      border-radius: var(--r-md);
    }
    .aap-act__col { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
    .aap-act__bar {
      width: 100%; min-height: 2px;
      background: var(--chrome-gradient);
      border-radius: 2px 2px 0 0;
    }
    .aap-act__lbl { font-size: 10px; color: var(--aap-dim); font-variant-numeric: tabular-nums; }

    /* Filter pills */
    .aap__filter-row {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    }
    .aap-pill {
      padding: 6px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--aap-dim); border: 1px solid var(--aap-border);
      background: rgba(8,9,11,0.45);
      backdrop-filter: blur(8px);
    }
    .aap-pill.is-active { background: var(--chrome-gradient); color: #0b0c0e; }
    .aap__count { color: var(--aap-dim); font-size: 12px; margin-left: auto; }

    /* Tables */
    .aap-table {
      border: 1px solid var(--aap-border); border-radius: var(--r-md);
      overflow-x: auto;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
    }
    .aap-table__head, .aap-table__row {
      display: grid; gap: 8px;
      grid-template-columns: 130px 1.2fr 1fr 1.2fr 90px 110px 130px 36px;
      padding: 10px 14px;
      align-items: center;
      min-width: 880px;
    }
    .aap-table--ledger .aap-table__head, .aap-table--ledger .aap-table__row {
      grid-template-columns: 140px 1fr 100px 100px 1.5fr 36px;
      min-width: 700px;
    }
    .aap-table__head {
      font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--aap-dim);
      border-bottom: 1px solid var(--aap-border);
    }
    .aap-table__row {
      border-bottom: 1px solid var(--aap-border);
      font-size: 13px;
    }
    .aap-table__row:last-child { border-bottom: none; }
    .aap-table__row > span { display: block; min-width: 0; }
    .aap-table__sub  { color: var(--aap-dim); font-size: 11px; }
    .aap-table__sub a { color: var(--chrome-2); }
    .aap-table__svc  { color: var(--text); }
    .aap-table__price { font-weight: 700; color: var(--chrome-1); font-variant-numeric: tabular-nums; }

    /* Forms */
    .aap-form {
      display: grid; gap: 8px;
      grid-template-columns: minmax(140px, 1fr) 130px 110px 110px minmax(140px, 2fr) auto;
      padding: var(--space-3);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--aap-border);
      border-radius: var(--r-md);
    }
    @media (max-width: 767px) {
      .aap-form { grid-template-columns: 1fr 1fr; }
      .aap-form > button { grid-column: 1 / -1; }
    }
    .aap-input, .aap-select {
      padding: 8px 10px;
      background: rgba(8,9,11,0.6);
      border: 1px solid var(--aap-border);
      border-radius: var(--r-sm);
      color: var(--text); font-family: inherit; font-size: 13px;
      min-width: 0;
    }
    .aap-input:focus, .aap-select:focus { outline: none; border-color: var(--chrome-2); }
    .aap-btn {
      padding: 8px 14px; border-radius: 999px;
      font-weight: 700; font-size: 12px; letter-spacing: 0.08em;
      background: var(--chrome-gradient); color: #0b0c0e;
      box-shadow: var(--shadow-chrome);
    }
    .aap-mini {
      width: 26px; height: 26px;
      display: grid; place-items: center;
      border-radius: 50%; border: 1px solid var(--aap-border);
      background: rgba(8,9,11,0.5);
      color: var(--aap-dim); font-size: 16px; line-height: 1;
    }
    .aap-mini:hover { color: var(--text); border-color: var(--chrome-2); }
    .aap-mini--danger:hover { color: #e87a7a; border-color: #e87a7a; }

    /* Salary cards */
    .aap-payroll {
      display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .aap-pay {
      padding: var(--space-4);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--aap-border);
      border-radius: var(--r-lg);
    }
    .aap-pay__top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-2); }
    .aap-pay__top h4 { font-size: 18px; font-weight: 700; }
    .aap-pay__role { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--aap-dim); }
    .aap-pay__rows { list-style: none; padding: 0; margin: 0; }
    .aap-pay__rows li {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 6px 0; border-bottom: 1px dashed var(--aap-border);
      font-size: 13px;
    }
    .aap-pay__rows li:last-child { border-bottom: none; }
    .aap-pay__rows li b { font-variant-numeric: tabular-nums; color: var(--text); }
    .aap-pay__rows li.is-total { padding-top: var(--space-2); margin-top: 4px; border-top: 1px solid var(--aap-border); border-bottom: none; }
    .aap-pay__rows li.is-total b { font-size: 18px; background: var(--chrome-gradient); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
    .aap-pay__rows .is-neg { color: #e8a47a; }

    .aap-totals {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: var(--space-2) var(--space-3);
      background: rgba(8,9,11,0.45);
      backdrop-filter: blur(8px);
      border: 1px solid var(--aap-border);
      border-radius: var(--r-md);
      font-size: 12px; color: var(--aap-dim);
    }
    .aap-chip {
      padding: 4px 10px; border-radius: 999px;
      background: rgba(232,234,237,0.06);
      color: var(--text); font-size: 12px;
    }

    .aap-field { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--aap-dim); }

    /* ─── Tabs group frame (Журнал · Зарплаты) ─────────────────────────── */
    .aap__tabs-group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: var(--radius-md, 10px);
      background: rgba(255,255,255,0.02);
      transition: border-color 200ms ease, background 200ms ease;
    }
    .aap__tabs-group.is-active {
      border-color: var(--chrome-2, rgba(232,234,237,0.45));
      background: rgba(255,255,255,0.05);
    }

    /* ─── Journal panel ────────────────────────────────────────────────── */
    .jrn { padding: 24px; }
    .jrn__head {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .jrn__nav {
      width: 32px; height: 32px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      color: var(--text);
      cursor: pointer;
      font-size: 14px;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 150ms ease;
    }
    .jrn__nav:hover { background: rgba(255,255,255,0.08); }
    .jrn__date {
      position: relative;
      font-weight: 600;
      font-size: 15px;
      color: var(--text);
      cursor: pointer;
      user-select: none;
      padding: 4px 10px;
      border-radius: 8px;
      transition: background 150ms ease;
    }
    .jrn__date:hover { background: rgba(255,255,255,0.04); }
    .jrn__date-input {
      position: absolute; inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .jrn__today {
      margin-left: auto;
      padding: 6px 12px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: transparent;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
    }
    .jrn__today:disabled { opacity: 0.4; cursor: default; }

    .jrn__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .jrn__table thead th {
      text-align: left;
      font-weight: 500;
      color: var(--text-muted);
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
    }
    .jdr { border-bottom: 1px solid rgba(255,255,255,0.04); }
    .jdr.is-locked { opacity: 0.7; }
    .jdr__name { text-align: left; padding: 12px; font-weight: 500; color: var(--text); white-space: nowrap; }
    .jdr__cell { padding: 8px 12px; vertical-align: middle; }
    .jdr__dash { color: var(--text-muted); opacity: 0.5; }

    .jdr__amount-wrap { position: relative; display: inline-block; }
    .jdr__amount {
      width: 100px;
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      color: var(--text);
      font-size: 14px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .jdr__amount:focus { outline: 1px solid var(--chrome-2, rgba(232,234,237,0.5)); outline-offset: 0; }
    .jdr__amount.has-error { border-color: #c0392b; }
    .jdr__err {
      position: absolute; right: -16px; top: 50%; transform: translateY(-50%);
      color: #c0392b; font-weight: 700;
    }
    .jdr__note {
      width: 100%;
      min-width: 140px;
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
    }
    .jdr__note:focus { outline: 1px solid var(--chrome-2, rgba(232,234,237,0.5)); outline-offset: 0; }
    .jdr__note-cell { width: 32%; }

    .jdr__locked-val { font-variant-numeric: tabular-nums; color: var(--text-muted); }
    .jdr__locked-note { color: var(--text-muted); font-style: italic; font-size: 13px; }

    .jdr__status { width: 120px; text-align: right; }
    .jdr__saved { color: #57bb8a; font-weight: 700; font-size: 13px; }

    .jdr__lock { display: inline-flex; align-items: center; gap: 6px; }
    .jdr__lock-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px;
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(255,255,255,0.04);
      white-space: nowrap;
    }
    .jdr__unlock {
      border: none; background: transparent;
      color: var(--text-muted); cursor: pointer;
      font-size: 14px; padding: 2px 4px;
    }
    .jdr__unlock:hover { color: var(--text); }

    .jrn__totals {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      font-size: 14px;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .jrn__totals.is-empty { opacity: 0.5; }
    .jrn__totals-split {
      margin-left: 8px;
      color: var(--text-muted);
      font-size: 13px;
    }

    @media (max-width: 640px) {
      .jrn { padding: 12px; }
      .jdr__amount { width: 80px; }
      .jdr__note-cell { width: auto; }
      .jrn__table { font-size: 13px; }
      .aap__tabs-group { width: 100%; justify-content: center; }
    }

/* ─── PayrollPanel ─────────────────────────────────────────────────── */
.aap__payroll {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  padding: 24px;
}
.aap__payroll-left { min-width: 0; }
.aap__payroll-right { min-width: 0; }
.aap__payroll-empty {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border, rgba(255,255,255,0.08));
  border-radius: 12px;
}

@media (max-width: 768px) {
  .aap__payroll { grid-template-columns: 1fr; gap: 16px; padding: 12px; }
}

/* List */
.aap__payroll-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.aap__payroll-list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.aap__payroll-list-item:hover { background: rgba(255,255,255,0.05); }
.aap__payroll-list-item.is-active {
  border-color: var(--chrome-2, rgba(232,234,237,0.4));
  background: rgba(255,255,255,0.06);
}
.aap__pli-name  { font-weight: 600; color: var(--text); grid-column: 1; }
.aap__pli-role  { font-size: 11px; color: var(--text-muted); grid-column: 1; grid-row: 2; }
.aap__pli-amount{
  grid-column: 2; grid-row: 1 / span 2;
  align-self: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--text);
}
.aap__pli-amount.is-zero { color: var(--text-muted); font-weight: 400; }
.aap__pli-amount.is-neg  { color: #c0392b; }

/* Card */
.aap__payroll-card {
  display: flex; flex-direction: column; gap: 24px;
  padding: 20px;
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 14px;
  background: rgba(255,255,255,0.02);
}
.aap__payroll-card-head {
  display: flex; align-items: center; gap: 12px;
}
.aap__payroll-back {
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: transparent;
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.aap__payroll-card-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* PayoutForm */
.aap__pf-title, .aap__ph-title, .aap__amf-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.aap__pf-form { display: flex; flex-direction: column; gap: 8px; }
.aap__pf-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: 8px;
}
.aap__pf-row > span { font-size: 13px; color: var(--text-muted); }
.aap__pf-row input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
}
.aap__pf-preview {
  margin-top: 8px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  font-variant-numeric: tabular-nums;
}
.aap__pf-preview-line { font-size: 13px; color: var(--text); margin-bottom: 4px; }
.aap__pf-preview-split {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}
.aap__pf-preview-net {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 16px;
}
.aap__pf-preview-net strong { font-size: 18px; }
.aap__pf-preview-net.is-neg strong { color: #c0392b; }

.aap__pf-hint { margin: 6px 0 0; font-size: 12px; color: var(--text-muted); }
.aap__pf-hint.is-error { color: #c0392b; }
.aap__pf-hint.is-warn  { color: #d4a017; }
.aap__pf-hint.is-info  { color: var(--text-muted); }

.aap__pf-toggle {
  align-self: flex-start;
  border: none; background: transparent;
  color: var(--text-muted); cursor: pointer;
  font-size: 12px; padding: 4px 0;
}
.aap__pf-details {
  font-size: 12px;
  color: var(--text);
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  padding: 10px 12px;
}
.aap__pf-details h5 { margin: 6px 0 4px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.aap__pf-details ul { margin: 0; padding-left: 16px; }
.aap__pf-details li { margin: 2px 0; }
.aap__pf-empty { color: var(--text-muted); font-size: 12px; }
.aap__pf-link {
  border: none; background: transparent;
  color: var(--text); cursor: pointer; padding: 0;
  text-align: left;
  font-size: 12px;
  text-decoration: underline dotted;
}
.aap__pf-link:hover { color: var(--chrome-2, #fff); }
.aap__pf-submit {
  margin-top: 4px;
  height: 40px;
  border: 1px solid var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(232,234,237,0.06);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.aap__pf-submit:disabled { opacity: 0.4; cursor: not-allowed; }

/* PayoutHistory */
.aap__ph-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.aap__ph-row {
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  padding: 10px 12px;
}
.aap__ph-summary {
  display: flex; align-items: center; gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text);
}
.aap__ph-date   { font-weight: 600; }
.aap__ph-period { color: var(--text-muted); }
.aap__ph-amount { font-variant-numeric: tabular-nums; font-weight: 600; }
.aap__ph-note   { color: var(--text-muted); font-style: italic; }
.aap__ph-note-edit {
  flex: 1;
  min-width: 100px;
  height: 28px;
  border: 1px solid var(--chrome-2, rgba(232,234,237,0.4));
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  padding: 0 8px;
  color: var(--text);
  font-size: 12px;
}
.aap__ph-action {
  border: none; background: transparent;
  cursor: pointer; padding: 2px 4px;
  font-size: 14px;
  color: var(--text-muted);
}
.aap__ph-action:hover { color: var(--text); }
.aap__ph-details {
  margin-top: 8px;
  font-size: 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  padding: 10px 12px;
}
.aap__ph-details h5 { margin: 6px 0 4px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
.aap__ph-details ul { margin: 0; padding-left: 16px; }
.aap__ph-empty { color: var(--text-muted); font-size: 12px; margin: 4px 0; }

/* AdvanceMiniForm */
.aap__amf-form {
  display: grid;
  grid-template-columns: 130px 1fr auto;
  gap: 8px;
  margin-bottom: 12px;
}
.aap__amf-form input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
}
.aap__amf-submit {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(232,234,237,0.04);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.aap__amf-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.aap__amf-list ul { list-style: none; padding: 0; margin: 0; }
.aap__amf-list-title {
  margin: 0 0 6px; font-size: 11px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.aap__amf-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
  font-size: 12px;
  color: var(--text);
}
.aap__amf-date { font-variant-numeric: tabular-nums; color: var(--text-muted); width: 48px; }
.aap__amf-amount-text { font-variant-numeric: tabular-nums; font-weight: 600; }
.aap__amf-row-note { color: var(--text-muted); flex: 1; }
.aap__amf-status.is-paid   { color: #57bb8a; font-size: 11px; }
.aap__amf-status.is-unpaid { color: var(--text-muted); font-size: 11px; }
.aap__amf-remove {
  border: none; background: transparent;
  cursor: pointer; padding: 2px 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.aap__amf-remove:hover { color: var(--text); }
.aap__amf-showall {
  border: none; background: transparent;
  color: var(--text-muted); cursor: pointer;
  font-size: 11px; padding: 6px 0;
  text-decoration: underline dotted;
}

@media (max-width: 768px) {
  .aap__pf-row { grid-template-columns: 1fr; gap: 4px; }
  .aap__amf-form { grid-template-columns: 1fr 1fr; }
  .aap__amf-form input:first-child { grid-column: 1 / span 1; }
  .aap__amf-submit { grid-column: 1 / span 2; }
}

/* ─── Deductions tab ──────────────────────────────────────────────── */
.aap__d {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  padding: 24px;
}
.aap__d-left { min-width: 0; }
.aap__d-right { min-width: 0; }
.aap__d-empty {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border, rgba(255,255,255,0.08));
  border-radius: 12px;
}
@media (max-width: 768px) {
  .aap__d { grid-template-columns: 1fr; gap: 16px; padding: 12px; }
}

.aap__d-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.aap__d-list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.aap__d-list-item:hover { background: rgba(255,255,255,0.05); }
.aap__d-list-item.is-active {
  border-color: var(--chrome-2, rgba(232,234,237,0.4));
  background: rgba(255,255,255,0.06);
}
.aap__dli-name  { font-weight: 600; color: var(--text); grid-column: 1; }
.aap__dli-role  { font-size: 11px; color: var(--text-muted); grid-column: 1; grid-row: 2; }
.aap__dli-counts {
  grid-column: 2; grid-row: 1 / span 2;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted);
}
.aap__dli-sum { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 12px; }

.aap__d-card {
  display: flex; flex-direction: column; gap: 24px;
  padding: 20px;
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 14px;
  background: rgba(255,255,255,0.02);
}
.aap__d-card-head { display: flex; align-items: center; gap: 12px; }
.aap__d-back {
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: transparent;
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.aap__d-card-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* DeductionForm */
.aap__df-title, .aap__dl-title, .aap__ds-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.aap__df-form { display: flex; flex-direction: column; gap: 8px; }
.aap__df-types { display: flex; gap: 8px; }
.aap__df-type {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
}
.aap__df-type input { display: none; }
.aap__df-type.is-active {
  border-color: var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(255,255,255,0.05);
  color: var(--text);
}
.aap__df-amount, .aap__df-note {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
}
.aap__df-submit {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(232,234,237,0.06);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.aap__df-submit:disabled { opacity: 0.4; cursor: not-allowed; }

/* DeductionsList */
.aap__dl-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.aap__dl-filters { display: flex; gap: 4px; }
.aap__dl-filter {
  padding: 4px 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: transparent;
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}
.aap__dl-filter.is-active {
  border-color: var(--chrome-2, rgba(232,234,237,0.45));
  background: rgba(255,255,255,0.05);
  color: var(--text);
}
.aap__dl-rows { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
.aap__dl-row {
  display: grid;
  grid-template-columns: 50px 80px 70px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 12px;
  color: var(--text);
}
.aap__dl-date { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.aap__dl-amount { font-variant-numeric: tabular-nums; font-weight: 600; }
.aap__dl-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: lowercase;
}
.aap__dl-type.is-advance { background: rgba(88, 214, 141, 0.12); color: #57bb8a; }
.aap__dl-type.is-fine    { background: rgba(192, 57, 43, 0.16);  color: #c0392b; }
.aap__dl-note { color: var(--text-muted); }
.aap__dl-status { font-size: 11px; }
.aap__dl-status.is-paid {
  border: none; background: transparent;
  color: #57bb8a; cursor: pointer;
  text-decoration: underline dotted;
  padding: 2px 4px;
}
.aap__dl-status.is-unpaid { color: var(--text-muted); }
.aap__dl-remove {
  border: none; background: transparent;
  cursor: pointer; padding: 2px 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.aap__dl-remove:hover { color: var(--text); }
.aap__dl-empty { color: var(--text-muted); font-size: 12px; padding: 8px 0; }

@media (max-width: 768px) {
  .aap__dl-row { grid-template-columns: 50px 1fr auto; row-gap: 4px; }
  .aap__dl-row > .aap__dl-type,
  .aap__dl-row > .aap__dl-note { grid-column: 2 / 3; }
}

/* DeductionsSummary (inside payroll card) */
.aap__ds {
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  padding: 14px 16px;
  background: rgba(255,255,255,0.02);
}
.aap__ds-empty { color: var(--text-muted); font-size: 12px; margin: 0 0 10px; }
.aap__ds-summary { margin-bottom: 10px; }
.aap__ds-total { font-size: 14px; color: var(--text); margin-bottom: 4px; font-variant-numeric: tabular-nums; }
.aap__ds-split { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap; }
.aap__ds-latest { list-style: none; padding: 0; margin: 8px 0; font-size: 12px; }
.aap__ds-latest li {
  display: grid;
  grid-template-columns: 48px 60px 60px 1fr auto;
  gap: 8px;
  padding: 4px 0;
  align-items: center;
  color: var(--text);
}
.aap__ds-type { font-size: 10px; padding: 1px 6px; border-radius: 999px; text-align: center; }
.aap__ds-type.is-advance { background: rgba(88,214,141,0.12); color: #57bb8a; }
.aap__ds-type.is-fine    { background: rgba(192,57,43,0.16); color: #c0392b; }
.aap__ds-note { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aap__ds-status.is-paid   { color: #57bb8a; font-size: 11px; }
.aap__ds-status.is-unpaid { color: var(--text-muted); font-size: 11px; }
.aap__ds-more {
  font-size: 11px; color: var(--text-muted); margin: 4px 0 8px;
}
.aap__ds-link {
  display: block;
  width: 100%;
  text-align: center;
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  background: transparent;
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  margin-top: 4px;
}
.aap__ds-link:hover { background: rgba(255,255,255,0.04); }
  `}</style>;
}
