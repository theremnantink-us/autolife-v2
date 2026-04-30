/**
 * New-payout form. Defaults dates to current half-month; recalculates
 * preview reactively via previewPayout. Confirm calls closePayout
 * after a window.confirm dialog. Shows admin/master split when employee
 * is multi-role.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Employee } from '../../../data/employees';
import type { SalaryAccrual, Deduction } from '../../../lib/admin/types';
import { previewPayout, closePayout } from '../../../lib/admin/payout';

interface Props {
  employee: Employee;
  allAccruals: SalaryAccrual[];
  allDeductions: Deduction[];
  onSaved: () => void;
  onJumpToAccrual: (date: string, employeeId: string, roleKind: 'admin' | 'master') => void;
}

function defaultDates(today: Date): { start: string; end: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = today.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (day <= 15) {
    return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-15` };
  }
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { start: `${y}-${pad(m + 1)}-16`, end: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
}

function todayISODate(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function dateDiffDays(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = new Date(ys, ms - 1, ds).getTime();
  const b = new Date(ye, me - 1, de).getTime();
  return Math.round((b - a) / 86400000);
}

export default function PayoutForm({
  employee, allAccruals, allDeductions, onSaved, onJumpToAccrual,
}: Props) {
  const fresh = useMemo(() => defaultDates(new Date()), []);
  const [start, setStart]   = useState(fresh.start);
  const [end, setEnd]       = useState(fresh.end);
  const [paidAt, setPaidAt] = useState(todayISODate());
  const [note, setNote]     = useState('');
  const [touched, setTouched] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Reset to fresh defaults when switching employees, unless user touched
  useEffect(() => {
    if (touched) return;
    setStart(fresh.start);
    setEnd(fresh.end);
    setPaidAt(todayISODate());
    setNote('');
  }, [employee.id, fresh, touched]);

  const preview = previewPayout(employee.id, start, end, allAccruals, allDeductions);

  // Overlap detection: any other (paid) accruals of this employee whose date
  // falls in [start, end].
  const overlapping = allAccruals.find(a =>
    a.employeeId === employee.id &&
    a.payoutId &&
    a.accrualDate >= start &&
    a.accrualDate <= end
  );

  const periodInvalid = start > end;
  const empty = preview.totals.accrualsTotal === 0 && preview.totals.deductionsTotal === 0;
  const negative = preview.totals.net < 0;
  const longPeriod = !periodInvalid && dateDiffDays(start, end) > 100;

  const canSubmit = !periodInvalid && !empty && !negative;

  const showAdmin = employee.role === 'admin-shift' || employee.role === 'admin-master' || employee.isMultiRole === true;
  const showMaster = employee.role !== 'admin-shift' || employee.isMultiRole === true;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = window.confirm(
      `Выплатить ${employee.name} ${preview.totals.net} ₽ (${start}—${end})?`
    );
    if (!ok) return;
    closePayout({
      employeeId: employee.id,
      periodStart: start,
      periodEnd: end,
      paidAt: new Date(paidAt + 'T12:00:00').toISOString(),
      note: note.trim() || undefined,
    });
    setTouched(false);
    setShowDetails(false);
    setNote('');
    onSaved();
  };

  return (
    <section className="aap__pf">
      <h4 className="aap__pf-title">Новая выплата</h4>
      <form className="aap__pf-form" onSubmit={submit}>
        <label className="aap__pf-row">
          <span>Период с</span>
          <input type="date" value={start} onChange={e => { setStart(e.target.value); setTouched(true); }} />
        </label>
        <label className="aap__pf-row">
          <span>Период по</span>
          <input type="date" value={end} onChange={e => { setEnd(e.target.value); setTouched(true); }} />
        </label>
        <label className="aap__pf-row">
          <span>Дата выдачи</span>
          <input type="date" value={paidAt} onChange={e => { setPaidAt(e.target.value); setTouched(true); }} />
        </label>
        <label className="aap__pf-row">
          <span>Заметка</span>
          <input type="text" maxLength={80} value={note} onChange={e => { setNote(e.target.value); setTouched(true); }} />
        </label>

        <div className="aap__pf-preview">
          <div className="aap__pf-preview-line">
            Накоплено за период: <strong>{preview.totals.accrualsTotal} ₽</strong>
          </div>
          {showAdmin && showMaster && (
            <div className="aap__pf-preview-split">
              <span>админ: {preview.totals.adminTotal} ₽</span>
              <span>мойка: {preview.totals.masterTotal} ₽</span>
            </div>
          )}
          <div className="aap__pf-preview-line">
            Удержания в окне: <strong>−{preview.totals.deductionsTotal} ₽</strong>
          </div>
          <div className={`aap__pf-preview-net${negative ? ' is-neg' : ''}`}>
            К выдаче: <strong>{preview.totals.net} ₽</strong>
          </div>

          {periodInvalid && <p className="aap__pf-hint is-error">Период некорректен.</p>}
          {empty && !periodInvalid && <p className="aap__pf-hint">Нечего выплачивать.</p>}
          {negative && <p className="aap__pf-hint is-error" title="нельзя выплачивать отрицательную сумму — снизьте удержания или измените период">Долг сотрудника: {Math.abs(preview.totals.net)} ₽.</p>}
          {longPeriod && <p className="aap__pf-hint is-warn">Слишком длинный период — это типично?</p>}
          {overlapping && <p className="aap__pf-hint is-info">Часть строк уже учтена в прошлых выплатах — пропущены.</p>}
        </div>

        <button
          type="button"
          className="aap__pf-toggle"
          onClick={() => setShowDetails(s => !s)}
        >Подробнее {showDetails ? '▴' : '▾'}</button>

        {showDetails && (
          <div className="aap__pf-details">
            <h5>Начисления:</h5>
            {preview.inWindow.accruals.length === 0
              ? <p className="aap__pf-empty">Нет.</p>
              : <ul>
                  {preview.inWindow.accruals.map(a => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="aap__pf-link"
                        onClick={() => onJumpToAccrual(a.accrualDate, employee.id, a.roleKind)}
                      >
                        {a.accrualDate} · {a.roleKind === 'admin' ? 'админ' : 'мойка'} · {a.amount} ₽ · «{a.note ?? '—'}»
                      </button>
                    </li>
                  ))}
                </ul>
            }
            <h5>Удержания:</h5>
            {preview.inWindow.deductions.length === 0
              ? <p className="aap__pf-empty">Нет.</p>
              : <ul>
                  {preview.inWindow.deductions.map(d => (
                    <li key={d.id}>{d.givenAt.slice(0, 10)} · {d.type === 'fine' ? 'штраф' : 'аванс'} · {d.amount} ₽ · «{d.note ?? '—'}»</li>
                  ))}
                </ul>
            }
          </div>
        )}

        <button
          type="submit"
          className="aap__pf-submit"
          disabled={!canSubmit}
        >Подтвердить выплату</button>
      </form>
    </section>
  );
}
