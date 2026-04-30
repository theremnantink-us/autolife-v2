/**
 * Left column of the Удержания tab — employees with counts of unpaid
 * advances/fines and total unpaid sum.
 */

import type { Employee } from '../../../data/employees';
import type { Deduction } from '../../../lib/admin/types';

interface Props {
  employees: Employee[];
  allDeductions: Deduction[];
  selectedId: string | null;
  onSelect: (employeeId: string) => void;
}

function summarize(empId: string, deds: Deduction[]): { adv: number; advSum: number; fines: number; finesSum: number; total: number } {
  let adv = 0, advSum = 0, fines = 0, finesSum = 0;
  for (const d of deds) {
    if (d.employeeId !== empId) continue;
    if (d.payoutId) continue;
    if (d.type === 'advance') { adv++; advSum += d.amount; }
    else                      { fines++; finesSum += d.amount; }
  }
  return { adv, advSum, fines, finesSum, total: advSum + finesSum };
}

function roleBadge(emp: Employee): string {
  if (emp.role === 'admin-shift')  return 'админ смены';
  if (emp.role === 'admin-master') return 'админ + мастер';
  return 'мастер';
}

export default function DeductionsEmployeeList({
  employees, allDeductions, selectedId, onSelect,
}: Props) {
  return (
    <ul className="aap__d-list" role="listbox" aria-label="Сотрудники">
      {employees.map(emp => {
        const s = summarize(emp.id, allDeductions);
        const active = selectedId === emp.id;
        return (
          <li
            key={emp.id}
            className={`aap__d-list-item${active ? ' is-active' : ''}`}
            role="option"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onSelect(emp.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(emp.id); }}
          >
            <div className="aap__dli-name">{emp.name}</div>
            <div className="aap__dli-role">{roleBadge(emp)}</div>
            <div className="aap__dli-counts">
              <span className="aap__dli-adv">💸 {s.adv}</span>
              <span className="aap__dli-fine">⚠ {s.fines}</span>
              {s.total > 0 && <span className="aap__dli-sum">{s.total} ₽</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
