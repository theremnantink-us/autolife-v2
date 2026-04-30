/**
 * Left column of the Зарплаты tab — list of employees with each one's
 * "к выдаче" total (unpaid accruals minus unpaid advances).
 */

import type { Employee } from '../../../data/employees';
import type { SalaryAccrual, Deduction } from '../../../lib/admin/types';
import { unpaidSummary } from '../../../lib/admin/payout';

interface Props {
  employees: Employee[];
  allAccruals: SalaryAccrual[];
  allDeductions: Deduction[];
  selectedId: string | null;
  onSelect: (employeeId: string) => void;
}

function roleBadge(emp: Employee): string {
  if (emp.role === 'admin-shift')  return 'админ смены';
  if (emp.role === 'admin-master') return 'админ + мастер';
  return 'мастер';
}

export default function PayrollEmployeeList({
  employees, allAccruals, allDeductions, selectedId, onSelect,
}: Props) {
  return (
    <ul className="aap__payroll-list" role="listbox" aria-label="Сотрудники">
      {employees.map(emp => {
        const summary = unpaidSummary(emp.id, allAccruals, allDeductions);
        const active = selectedId === emp.id;
        return (
          <li
            key={emp.id}
            className={`aap__payroll-list-item${active ? ' is-active' : ''}`}
            role="option"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onSelect(emp.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(emp.id); }}
          >
            <div className="aap__pli-name">{emp.name}</div>
            <div className="aap__pli-role">{roleBadge(emp)}</div>
            <div className={`aap__pli-amount${summary.total < 0 ? ' is-neg' : ''}${summary.total === 0 ? ' is-zero' : ''}`}>
              {summary.total === 0 ? '—' : `${summary.total} ₽`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
