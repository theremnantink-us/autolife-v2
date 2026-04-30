/**
 * Right column of the Удержания tab — composes DeductionForm and
 * DeductionsList for the selected employee. Mobile back button.
 */

import type { Employee } from '../../../data/employees';
import type { Deduction, SalaryPayout } from '../../../lib/admin/types';
import DeductionForm from './DeductionForm';
import DeductionsList from './DeductionsList';

interface Props {
  employee: Employee;
  allDeductions: Deduction[];
  allPayouts: SalaryPayout[];
  showBack: boolean;
  onBack: () => void;
  onChange: () => void;
}

export default function DeductionsEmployeeCard({
  employee, allDeductions, allPayouts, showBack, onBack, onChange,
}: Props) {
  const employeeDeductions = allDeductions.filter(d => d.employeeId === employee.id);
  const employeePayouts    = allPayouts.filter(p => p.employeeId === employee.id);

  return (
    <div className="aap__d-card">
      <header className="aap__d-card-head">
        {showBack && (
          <button
            type="button"
            className="aap__d-back"
            onClick={onBack}
            aria-label="Назад"
          >← Назад</button>
        )}
        <h3 className="aap__d-card-name">{employee.name}</h3>
      </header>

      <DeductionForm
        employeeId={employee.id}
        employeeName={employee.name}
        onChange={onChange}
      />
      <DeductionsList
        employeeId={employee.id}
        deductions={employeeDeductions}
        payouts={employeePayouts}
        onChange={onChange}
      />
    </div>
  );
}
