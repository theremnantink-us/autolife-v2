/**
 * BookingCalendar — custom hour-slot calendar for the booking form.
 *
 * Schedule:
 *   • Mon–Fri 8–22
 *   • Sat–Sun 9–21
 *   • busyDates passed in → mark whole day grey
 *   • Past time on the current day → disabled
 *
 * Emits 'YYYY-MM-DD HH:mm' to onChange.
 */

import { useEffect, useMemo, useState } from 'react';

interface Props {
  value: string;                  // 'YYYY-MM-DD HH:mm'
  onChange: (v: string) => void;
  busyDates?: string[];           // 'YYYY-MM-DD'
  masterId?: string;              // reserved — used once admin/Supabase lands
  hasError?: boolean;
}

const RU_DOW   = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const RU_MONTH = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

/** Working hours per ISO weekday (0 = Sun … 6 = Sat). */
const HOURS: Record<number, { start: number; end: number } | null> = {
  0: { start: 9, end: 21 },        // Sun
  1: { start: 8, end: 22 },        // Mon
  2: { start: 8, end: 22 },
  3: { start: 8, end: 22 },
  4: { start: 8, end: 22 },
  5: { start: 8, end: 22 },        // Fri
  6: { start: 9, end: 21 },        // Sat
};

const pad   = (n: number) => String(n).padStart(2, '0');
const ymd   = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymdhm = (d: Date, h: number) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:00`;

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function isoWeekday(d: Date) {
  // Native getDay: 0 = Sunday … we keep it that way to match HOURS keys.
  return d.getDay();
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth()
    && a.getDate()     === b.getDate();
}

/** Build a month grid (always 6 rows × 7 cols) starting from Monday. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  // We want Monday to be the first column. JS getDay: Mon = 1.
  const offset = (first.getDay() + 6) % 7; // days BEFORE the 1st on Mon-start grid
  const start = new Date(year, month, 1 - offset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export default function BookingCalendar({ value, onChange, busyDates = [], hasError }: Props) {
  const today = startOfDay(new Date());

  // Derive selected date/time from incoming value (so the parent stays the
  // single source of truth and prefill from session storage Just Works).
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }, [value]);

  const [view, setView] = useState(() => {
    const base = parsedValue ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [picked, setPicked] = useState<Date | null>(parsedValue ? startOfDay(parsedValue) : null);
  const pickedHour = parsedValue ? parsedValue.getHours() : null;

  // Sync external value resets (e.g. form cleared on success)
  useEffect(() => {
    if (!value) { setPicked(null); return; }
    if (parsedValue) setPicked(startOfDay(parsedValue));
  }, [value, parsedValue]);

  const cells = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  const busySet = useMemo(() => new Set(busyDates), [busyDates]);

  const isBusyDay   = (d: Date) => busySet.has(ymd(d));
  const isClosed    = (d: Date) => HOURS[isoWeekday(d)] == null;
  const isPast      = (d: Date) => startOfDay(d) < today;
  const isOtherMonth = (d: Date) => d.getMonth() !== view.getMonth();
  const isAvailable = (d: Date) =>
    !isPast(d) && !isClosed(d) && !isBusyDay(d) && !isOtherMonth(d);

  /** Slots for a chosen day: hour-aligned blocks within working hours,
      filtering out past hours on the current day. */
  const slots = useMemo(() => {
    if (!picked) return [];
    const wh = HOURS[isoWeekday(picked)];
    if (!wh) return [];
    const out: { hour: number; disabled: boolean }[] = [];
    const now = new Date();
    const isToday = sameDay(picked, now);
    for (let h = wh.start; h < wh.end; h++) {
      const disabled = isToday && h <= now.getHours();
      out.push({ hour: h, disabled });
    }
    return out;
  }, [picked]);

  function shiftMonth(delta: number) {
    setView(v => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  function pick(d: Date) {
    if (!isAvailable(d)) return;
    setPicked(startOfDay(d));
    // Clear the time slot if user picks a new day — they need to confirm.
    if (parsedValue && !sameDay(parsedValue, d)) onChange('');
  }

  function pickSlot(hour: number) {
    if (!picked) return;
    onChange(ymdhm(picked, hour));
  }

  const monthLabel = `${RU_MONTH[view.getMonth()]} ${view.getFullYear()}`;
  const canPrev    = view > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div className={`bcal${hasError ? ' bcal--error' : ''}`}>
      {/* ── Month grid ─────────────────────────────────────── */}
      <div className="bcal__month">
        <header className="bcal__head">
          <button
            type="button"
            className="bcal__nav"
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            aria-label="Предыдущий месяц"
          >‹</button>
          <span className="bcal__title">{monthLabel}</span>
          <button
            type="button"
            className="bcal__nav"
            onClick={() => shiftMonth(+1)}
            aria-label="Следующий месяц"
          >›</button>
        </header>

        <div className="bcal__dow" aria-hidden="true">
          {RU_DOW.map(d => <span key={d}>{d}</span>)}
        </div>

        <div className="bcal__grid" role="grid" aria-label="Календарь">
          {cells.map((d) => {
            const av  = isAvailable(d);
            const sel = picked && sameDay(d, picked);
            const tdy = sameDay(d, today);
            const cls = [
              'bcal__day',
              isOtherMonth(d) && 'is-other',
              !av && !isOtherMonth(d) && 'is-disabled',
              av && 'is-available',
              sel && 'is-selected',
              tdy && 'is-today',
            ].filter(Boolean).join(' ');
            return (
              <button
                key={ymd(d)}
                type="button"
                className={cls}
                onClick={() => pick(d)}
                disabled={!av}
                aria-pressed={!!sel}
                aria-label={`${d.getDate()} ${RU_MONTH[d.getMonth()]}`}
              >
                <span className="bcal__day-num">{d.getDate()}</span>
                {av && <span className="bcal__day-dot" aria-hidden="true"></span>}
              </button>
            );
          })}
        </div>

        <p className="bcal__legend">
          <span className="bcal__legend-item"><i className="bcal__sw bcal__sw--free"></i>свободно</span>
          <span className="bcal__legend-item"><i className="bcal__sw bcal__sw--off"></i>выходной / занято</span>
        </p>
      </div>

      {/* ── Time slots ─────────────────────────────────────── */}
      <div className="bcal__slots">
        {!picked ? (
          <p className="bcal__empty">Выберите день в календаре слева — справа появятся свободные часы.</p>
        ) : slots.length === 0 ? (
          <p className="bcal__empty">В этот день нет свободных слотов.</p>
        ) : (
          <>
            <h4 className="bcal__slots-title">
              {picked.getDate()} {RU_MONTH[picked.getMonth()]} — выберите время
            </h4>
            <div className="bcal__slots-grid" role="listbox" aria-label="Свободные часы">
              {slots.map(s => {
                const sel = pickedHour === s.hour && !!parsedValue && sameDay(parsedValue, picked);
                return (
                  <button
                    key={s.hour}
                    type="button"
                    className={`bcal__slot${sel ? ' is-selected' : ''}`}
                    onClick={() => pickSlot(s.hour)}
                    disabled={s.disabled}
                    aria-pressed={sel}
                  >
                    {pad(s.hour)}:00
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`
        .bcal {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur)) saturate(140%);
          -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
        }
        .bcal--error { border-color: var(--danger); }
        @media (min-width: 720px) {
          .bcal { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
        }

        /* ── Month side ─────────────────────────────── */
        .bcal__head {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }
        .bcal__title {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: capitalize;
          color: var(--text);
        }
        .bcal__nav {
          width: 30px; height: 30px;
          border-radius: 999px;
          background: rgba(8,9,11,0.45);
          backdrop-filter: blur(8px);
          border: 1px solid var(--hairline);
          color: var(--chrome-1);
          font-size: 18px; line-height: 1;
          display: grid; place-items: center;
          transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
        }
        .bcal__nav:hover:not(:disabled) { background: rgba(20,22,26,0.7); border-color: var(--chrome-2); }
        .bcal__nav:disabled { opacity: 0.35; cursor: not-allowed; }

        .bcal__dow {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px; margin-bottom: 6px;
          font-family: var(--font-display);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--text-dim);
        }
        .bcal__dow span { text-align: center; padding: 4px 0; }

        .bcal__grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .bcal__day {
          position: relative;
          aspect-ratio: 1;
          border-radius: var(--r-sm);
          background: transparent;
          border: 1px solid transparent;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 13px; font-weight: 500;
          font-variant-numeric: tabular-nums;
          display: grid; place-items: center;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out),
                      border-color var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out),
                      transform var(--dur-fast) var(--ease-out);
        }
        .bcal__day-num { position: relative; z-index: 1; }
        .bcal__day-dot {
          position: absolute; bottom: 5px; left: 50%;
          transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%;
          background: #58d68d;
          opacity: 0.85;
        }

        .bcal__day.is-other { color: var(--text-dim); opacity: 0.35; }
        .bcal__day.is-disabled {
          color: var(--text-dim);
          opacity: 0.4;
          cursor: not-allowed;
        }
        .bcal__day.is-disabled .bcal__day-dot { display: none; }
        .bcal__day.is-available {
          background: rgba(20, 30, 24, 0.45);
          border-color: rgba(88, 214, 141, 0.25);
        }
        .bcal__day.is-available:hover {
          background: rgba(30, 50, 40, 0.6);
          border-color: rgba(88, 214, 141, 0.55);
          transform: translateY(-1px);
        }
        .bcal__day.is-today { outline: 1px dashed var(--chrome-2); outline-offset: -2px; }
        .bcal__day.is-selected,
        .bcal__day.is-selected:hover {
          background: var(--chrome-gradient);
          color: #0b0c0e;
          border-color: rgba(255, 255, 255, 0.3);
          font-weight: 700;
        }
        .bcal__day.is-selected .bcal__day-dot { background: #0b0c0e; }

        .bcal__legend {
          display: flex; flex-wrap: wrap; gap: var(--space-3);
          margin-top: var(--space-3);
          font-size: 11px;
          color: var(--text-dim);
          letter-spacing: 0.04em;
        }
        .bcal__legend-item { display: inline-flex; align-items: center; gap: 6px; }
        .bcal__sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
        .bcal__sw--free { background: rgba(88,214,141,0.55); border: 1px solid rgba(88,214,141,0.6); }
        .bcal__sw--off  { background: rgba(80,84,90,0.45);  border: 1px solid var(--hairline); }

        /* ── Slots side ─────────────────────────────── */
        .bcal__slots {
          padding: var(--space-3);
          background: rgba(8,9,11,0.32);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          display: flex;
          flex-direction: column;
          min-height: 220px;
        }
        .bcal__empty {
          margin: auto;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
          max-width: 28ch;
          line-height: 1.5;
        }
        .bcal__slots-title {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--chrome-2);
          margin-bottom: var(--space-3);
        }
        .bcal__slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
          gap: 6px;
        }
        .bcal__slot {
          padding: 10px 0;
          border-radius: 999px;
          background: rgba(8,9,11,0.5);
          border: 1px solid var(--hairline);
          color: var(--chrome-1);
          font-family: var(--font-display);
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out),
                      border-color var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out),
                      transform var(--dur-fast) var(--ease-out);
        }
        .bcal__slot:hover:not(:disabled) {
          background: rgba(22,25,29,0.75);
          border-color: var(--chrome-2);
          transform: translateY(-1px);
        }
        .bcal__slot:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .bcal__slot.is-selected {
          background: var(--chrome-gradient);
          color: #0b0c0e;
          border-color: rgba(255,255,255,0.3);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
