/**
 * Right column of the Зарплаты tab — composes PayoutForm, PayoutHistory,
 * and AdvanceMiniForm for the selected employee. Provides the mobile
 * "← Назад" affordance.
 */

import type { Employee } from '../../../data/employees';
import type { SalaryAccrual, Deduction, SalaryPayout } from '../../../lib/admin/types';
import PayoutForm from './PayoutForm';
import PayoutHistory from './PayoutHistory';
import DeductionsSummary from './DeductionsSummary';

interface Props {
  employee: Employee;
  allAccruals: SalaryAccrual[];
  allDeductions: Deduction[];
  allPayouts: SalaryPayout[];
  showBack: boolean;
  onBack: () => void;
  onChange: () => void;
  onJumpToAccrual: (date: string, employeeId: string, roleKind: 'admin' | 'master') => void;
}

export default function PayrollEmployeeCard({
  employee, allAccruals, allDeductions, allPayouts,
  showBack, onBack, onChange, onJumpToAccrual,
}: Props) {
  const employeePayouts     = allPayouts.filter(p => p.employeeId === employee.id);
  const employeeDeductions  = allDeductions.filter(d => d.employeeId === employee.id);

  return (
    <div className="aap__payroll-card">
      <header className="aap__payroll-card-head">
        {showBack && (
          <button
            type="button"
            className="aap__payroll-back"
            onClick={onBack}
            aria-label="Назад к списку"
          >← Назад</button>
        )}
        <h3 className="aap__payroll-card-name">{employee.name}</h3>
      </header>

      <PayoutForm
        employee={employee}
        allAccruals={allAccruals}
        allDeductions={allDeductions}
        onSaved={onChange}
        onJumpToAccrual={onJumpToAccrual}
      />

      <PayoutHistory
        payouts={employeePayouts}
        allAccruals={allAccruals}
        allDeductions={allDeductions}
        onChange={onChange}
      />

      <DeductionsSummary
        employeeId={employee.id}
        deductions={employeeDeductions}
        payouts={employeePayouts}
      />
    </div>
  );
}
