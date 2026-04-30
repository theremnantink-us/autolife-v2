/**
 * Журнал — daily accruals tab. Date navigator + employee table + totals.
 * Re-pulls from accrualsStore on every parent `tick` change.
 */

import { useEffect, useMemo, useState } from 'react';
import { employees as ALL_EMPLOYEES } from '../../../data/employees';
import type { SalaryAccrual } from '../../../lib/admin/types';
import { accrualsStore } from '../../../lib/admin/store';
import {
  formatDateInput, addDays, accrualsForDate, summarizeDay,
} from '../../../lib/admin/journal';
import JournalDayRow from './JournalDayRow';

type RoleKind = 'admin' | 'master';

interface Props {
  /** Bumped by AdminApp's tick after we mutate accrualsStore */
  tick: number;
  onChange: () => void;
}

const RU_WEEKDAY = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const RU_MONTH   = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} ${RU_MONTH[m - 1]} ${y}, ${RU_WEEKDAY[dt.getDay()]}`;
}

export default function Journal({ tick, onChange }: Props) {
  const today = formatDateInput(new Date());
  const [date, setDate] = useState<string>(today);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ date: string; employeeId: string; roleKind: 'admin' | 'master' }>).detail;
      if (detail?.date) setDate(detail.date);
    };
    window.addEventListener('autolife:focus-accrual', handler);
    return () => window.removeEventListener('autolife:focus-accrual', handler);
  }, []);

  const allAccruals = useMemo<SalaryAccrual[]>(() => accrualsStore.list(), [tick]);
  const dayAccruals = useMemo(() => accrualsForDate(allAccruals, date), [allAccruals, date]);
  const employees   = useMemo(
    () => ALL_EMPLOYEES.slice().sort((a, b) => {
      const sa = (a as { sortOrder?: number }).sortOrder ?? 0;
      const sb = (b as { sortOrder?: number }).sortOrder ?? 0;
      return sa - sb;
    }),
    []
  );

  const totals  = summarizeDay(dayAccruals);
  const payouts: { id: string; paidAt: string; totalAmount: number }[] = []; // D-2 will populate

  const handleSaveAmount = (employeeId: string) => ({
    roleKind, amount, note,
  }: { roleKind: RoleKind; amount: number | null; note?: string }) => {
    const existing = dayAccruals.find(a => a.employeeId === employeeId && a.roleKind === roleKind);
    if (amount === null) {
      if (existing) accrualsStore.remove(existing.id);
    } else {
      accrualsStore.upsert({
        id: existing?.id,
        employeeId,
        accrualDate: date,
        roleKind,
        amount,
        note: note || existing?.note,
      });
    }
    onChange();
  };

  const handleSaveNote = (employeeId: string) => ({
    roleKind, note,
  }: { roleKind: RoleKind; note: string }) => {
    const existing = dayAccruals.find(a => a.employeeId === employeeId && a.roleKind === roleKind);
    if (!existing) return;
    accrualsStore.upsert({ ...existing, note: note || undefined });
    onChange();
  };

  const handleUnlock = (accrualId: string) => {
    const row = allAccruals.find(a => a.id === accrualId);
    if (!row) return;
    accrualsStore.upsert({ ...row, payoutId: undefined });
    onChange();
  };

  return (
    <div className="aap__panel jrn">
      <div className="jrn__head">
        <button type="button" className="jrn__nav" aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>←</button>
        <label className="jrn__date">
          <span className="jrn__date-label">{humanDate(date)}</span>
          <input
            type="date"
            className="jrn__date-input"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Выбрать дату"
          />
        </label>
        <button type="button" className="jrn__nav" aria-label="Следующий день" onClick={() => setDate(addDays(date, +1))}>→</button>
        <button
          type="button"
          className="jrn__today"
          onClick={() => setDate(today)}
          disabled={date === today}
        >Сегодня</button>
      </div>

      <table className="jrn__table">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            <th scope="col">Админ ₽</th>
            <th scope="col">Мойка ₽</th>
            <th scope="col">Заметка</th>
            <th scope="col" aria-label="Статус сохранения" />
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <JournalDayRow
              key={emp.id}
              employee={emp}
              date={date}
              rowAccruals={dayAccruals.filter(a => a.employeeId === emp.id)}
              payouts={payouts}
              onSaveAmount={handleSaveAmount(emp.id)}
              onSaveNote={handleSaveNote(emp.id)}
              onUnlock={handleUnlock}
            />
          ))}
        </tbody>
      </table>

      <div className={`jrn__totals${totals.total === 0 ? ' is-empty' : ''}`}>
        Итого за день: <strong>{totals.total} ₽</strong>
        <span className="jrn__totals-split">
          (админ: {totals.admin} ₽ · мойка: {totals.master} ₽)
        </span>
      </div>
    </div>
  );
}
