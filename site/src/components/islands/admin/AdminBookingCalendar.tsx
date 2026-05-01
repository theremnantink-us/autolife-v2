/**
 * Календарь управления доступностью дат для записи.
 *
 * Клик по дню → закрыть/открыть дату.
 * Красный = закрыто вручную, зелёный = открыто.
 *
 * Данные хранятся в Supabase (таблица blocked_dates).
 * Все дни недели работают — выходных нет, но админ может закрыть любой день.
 */

import { useEffect, useMemo, useState } from 'react';
import { listBlockedDates, upsertBlockedDate, deleteBlockedDate } from '../../../lib/bookings';

const RU_MONTH = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
] as const;
const RU_DOW = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] as const;

/** Все дни открыты по умолчанию — выходных в графике больше нет. */
const DEFAULT_OPEN: Record<number, boolean> = {
  0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true,
};

interface DayRule {
  date: string;          // YYYY-MM-DD
  closed: boolean;
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Понедельник = 0 … Воскресенье = 6 (для сетки). */
function gridDow(d: Date) {
  const n = d.getDay(); // 0 = Sun
  return n === 0 ? 6 : n - 1;
}

interface Props {
  onChange?: () => void;
}

export default function AdminBookingCalendar({ onChange }: Props) {
  const now   = new Date();
  const today = ymd(now);

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rules, setRules] = useState<DayRule[]>([]);
  const [editDate, setEditDate]   = useState<string | null>(null);
  const [editNote, setEditNote]   = useState('');
  const [busy, setBusy] = useState(false);

  // Initial load from Supabase
  useEffect(() => {
    listBlockedDates().then(rows => {
      setRules(rows.map(r => ({
        date: r.date,
        closed: !r.blocked_slots || r.blocked_slots.length === 0,
        note: r.notes ?? undefined,
      })));
    }).catch(() => { /* tolerate empty */ });
  }, []);

  const rulesMap = useMemo(() => {
    const m = new Map<string, DayRule>();
    rules.forEach(r => m.set(r.date, r));
    return m;
  }, [rules]);

  async function toggleDay(date: string) {
    if (busy) return;
    const rule = rulesMap.get(date);
    setBusy(true);
    try {
      if (rule?.closed) {
        await deleteBlockedDate(date);
        setRules(rs => rs.filter(r => r.date !== date));
      } else {
        await upsertBlockedDate({ date, blocked_slots: [], notes: null });
        setRules(rs => [...rs.filter(r => r.date !== date), { date, closed: true }]);
      }
      onChange?.();
    } catch (err) {
      console.error('[admin-calendar] toggleDay', err);
      alert('Не удалось обновить дату. Проверьте соединение.');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!editDate) return;
    const existing = rulesMap.get(editDate);
    if (!existing) { setEditDate(null); return; }
    const note = editNote.trim() || null;
    try {
      await upsertBlockedDate({ date: editDate, blocked_slots: [], notes: note });
      setRules(rs => rs.map(r => r.date === editDate ? { ...r, note: note ?? undefined } : r));
    } catch (err) {
      console.error('[admin-calendar] saveNote', err);
      alert('Не удалось сохранить заметку.');
    }
    setEditDate(null);
  }

  async function reopenDay(date: string) {
    try {
      await deleteBlockedDate(date);
      setRules(rs => rs.filter(r => r.date !== date));
      onChange?.();
    } catch (err) {
      console.error('[admin-calendar] reopenDay', err);
    }
  }

  /** Build the calendar grid for current month. */
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const offset = gridDow(first);   // blanks before day 1
    const out: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(year, month, d));
    return out;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()); }

  const closedDates = useMemo(
    () => rules.filter(r => r.closed).map(r => r.date).sort(),
    [rules],
  );

  return (
    <div className="abk">
      <div className="abk__layout">

        {/* ─── Calendar ─────────────────────────────────── */}
        <div className="abk__left">
          <div className="abk__nav">
            <button className="abk__nav-btn" onClick={prevMonth} aria-label="Предыдущий месяц">‹</button>
            <span className="abk__month">{RU_MONTH[month]} {year}</span>
            <button className="abk__nav-btn" onClick={nextMonth} aria-label="Следующий месяц">›</button>
            <button className="abk__today-btn" onClick={goToday} disabled={year === now.getFullYear() && month === now.getMonth()}>
              Сегодня
            </button>
          </div>

          <div className="abk__grid-head">
            {RU_DOW.map(d => <span key={d} className="abk__dow">{d}</span>)}
          </div>

          <div className="abk__grid">
            {cells.map((d, i) => {
              if (!d) return <div key={`blank-${i}`} className="abk__blank" />;
              const date        = ymd(d);
              const rule        = rulesMap.get(date);
              const isPast      = date < today;
              const isToday     = date === today;
              const isClosed    = !!rule?.closed;
              const isManual    = isClosed;

              return (
                <button
                  key={date}
                  className={[
                    'abk__day',
                    isToday   ? 'is-today'          : '',
                    isPast    ? 'is-past'            : '',
                    isClosed  ? 'is-closed-manual'  : 'is-open',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !isPast && toggleDay(date)}
                  disabled={isPast || busy}
                  title={
                    isPast    ? 'Прошедшая дата' :
                    rule?.note ? rule.note :
                    isClosed  ? 'Закрыто вручную — нажмите чтобы открыть' :
                    'Открыто — нажмите чтобы закрыть'
                  }
                >
                  <span className="abk__day-num">{d.getDate()}</span>
                  {isManual && <span className="abk__day-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="abk__legend">
            <span className="abk__leg abk__leg--open">Открыто</span>
            <span className="abk__leg abk__leg--manual">Закрыто вручную</span>
          </div>
        </div>

        {/* ─── Sidebar: list of closed dates ────────────── */}
        <div className="abk__right">
          <p className="abk__sidebar-title">Закрытые даты</p>

          {closedDates.length === 0 ? (
            <p className="abk__empty">
              Нет закрытых дат. Кликните на день в календаре, чтобы закрыть его для записи.
            </p>
          ) : (
            <ul className="abk__closed-list">
              {closedDates.map(date => {
                const rule = rulesMap.get(date)!;
                const label = new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
                  weekday: 'short', day: 'numeric', month: 'long',
                });
                return (
                  <li key={date} className="abk__closed-row">
                    <span className="abk__closed-date">{label}</span>
                    {editDate === date ? (
                      <span className="abk__note-edit-wrap">
                        <input
                          className="abk__note-input"
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          placeholder="Причина (необязательно)"
                          onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') setEditDate(null); }}
                          autoFocus
                        />
                        <button className="abk__note-save" onClick={saveNote} title="Сохранить">✓</button>
                        <button className="abk__note-cancel" onClick={() => setEditDate(null)} title="Отмена">✕</button>
                      </span>
                    ) : (
                      <button
                        className="abk__closed-note"
                        onClick={() => { setEditDate(date); setEditNote(rule.note ?? ''); }}
                        title="Редактировать заметку"
                      >
                        {rule.note ? rule.note : <span className="abk__note-placeholder">+ заметка</span>}
                      </button>
                    )}
                    <button
                      className="abk__closed-remove"
                      onClick={() => reopenDay(date)}
                      title="Открыть этот день"
                      aria-label={`Открыть ${date}`}
                    >×</button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="abk__hint">
            Закрытые даты становятся недоступными для онлайн-записи на сайте.
            Нажмите × чтобы снова открыть день.
          </p>
        </div>
      </div>

      <Style />
    </div>
  );
}

function Style() {
  return <style>{`
    .abk { font-family: var(--font-display); }
    .abk__layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 24px;
      padding: 24px;
    }
    @media (max-width: 900px) {
      .abk__layout { grid-template-columns: 1fr; gap: 16px; padding: 16px; }
    }

    /* Nav */
    .abk__nav {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .abk__nav-btn {
      width: 32px; height: 32px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      background: rgba(255,255,255,0.03);
      color: var(--text);
      font-size: 18px;
      display: grid; place-items: center;
      cursor: pointer;
      transition: background 150ms;
    }
    .abk__nav-btn:hover { background: rgba(255,255,255,0.08); }
    .abk__month {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      padding: 0 6px;
      min-width: 160px;
      text-align: center;
    }
    .abk__today-btn {
      margin-left: auto;
      padding: 6px 12px;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      border-radius: 8px;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .abk__today-btn:disabled { opacity: 0.3; cursor: default; }
    .abk__today-btn:not(:disabled):hover { background: rgba(255,255,255,0.06); }

    /* Grid header */
    .abk__grid-head {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 4px;
    }
    .abk__dow {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(232,234,237,0.4);
      padding: 4px 0;
    }

    /* Grid */
    .abk__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .abk__blank { aspect-ratio: 1; }
    .abk__day {
      aspect-ratio: 1;
      border-radius: 8px;
      border: 1px solid transparent;
      background: rgba(255,255,255,0.03);
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      transition: background 120ms, border-color 120ms;
      position: relative;
    }
    .abk__day:disabled { cursor: default; }
    .abk__day:not(:disabled):hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.07); }

    .abk__day.is-today { border-color: var(--chrome-2); }
    .abk__day.is-past  { opacity: 0.35; }

    .abk__day.is-open            { color: var(--text); }
    .abk__day.is-open:not(:disabled):hover { background: rgba(88,214,141,0.08); border-color: rgba(88,214,141,0.3); }

    .abk__day.is-closed-manual   { background: rgba(192,57,43,0.15); border-color: rgba(192,57,43,0.35); color: #e87a7a; }
    .abk__day.is-closed-manual:not(:disabled):hover { background: rgba(88,214,141,0.08); border-color: rgba(88,214,141,0.3); color: var(--text); }

    .abk__day.is-closed-default  { background: rgba(255,255,255,0.02); color: rgba(232,234,237,0.25); }

    .abk__day-num { font-variant-numeric: tabular-nums; line-height: 1; }
    .abk__day-dot {
      width: 4px; height: 4px;
      border-radius: 50%;
      background: #e87a7a;
      flex-shrink: 0;
    }

    /* Legend */
    .abk__legend {
      display: flex;
      gap: 16px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .abk__leg {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .abk__leg::before {
      content: '';
      width: 12px; height: 12px;
      border-radius: 4px;
      border: 1px solid transparent;
    }
    .abk__leg--open::before    { background: rgba(88,214,141,0.15);  border-color: rgba(88,214,141,0.35); }
    .abk__leg--manual::before  { background: rgba(192,57,43,0.15);   border-color: rgba(192,57,43,0.35); }
    .abk__leg--default::before { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.08); }

    /* Sidebar */
    .abk__right {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .abk__sidebar-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--chrome-2);
      margin: 0;
    }
    .abk__empty {
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1.55;
      margin: 0;
    }
    .abk__hint {
      color: rgba(232,234,237,0.35);
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
      margin-top: auto;
    }

    /* Closed list */
    .abk__closed-list {
      list-style: none;
      padding: 0; margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
      max-height: 400px;
    }
    .abk__closed-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(192,57,43,0.2);
      background: rgba(192,57,43,0.06);
    }
    .abk__closed-date {
      font-size: 13px;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .abk__closed-note {
      font-size: 11px;
      color: var(--text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }
    .abk__closed-note:hover { background: rgba(255,255,255,0.06); color: var(--text); }
    .abk__note-placeholder { color: rgba(232,234,237,0.25); font-style: italic; }
    .abk__closed-remove {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1;
      display: grid; place-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }
    .abk__closed-remove:hover { color: #57bb8a; border-color: #57bb8a; }

    /* Note inline edit */
    .abk__note-edit-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      grid-column: 1 / -1;
    }
    .abk__note-input {
      flex: 1;
      height: 28px;
      padding: 0 8px;
      border: 1px solid rgba(232,234,237,0.3);
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      color: var(--text);
      font-family: inherit;
      font-size: 12px;
    }
    .abk__note-save, .abk__note-cancel {
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      display: grid; place-items: center;
    }
    .abk__note-save:hover { color: #57bb8a; border-color: #57bb8a; }
    .abk__note-cancel:hover { color: #e87a7a; border-color: #e87a7a; }
  `}</style>;
}
