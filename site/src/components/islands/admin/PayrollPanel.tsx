/**
 * Зарплаты tab root. Two-panel grid on desktop, swap on mobile.
 * Holds selectedEmployeeId and the mobile back-toggle. Re-pulls store
 * data on every parent tick.
 */

import { useEffect, useMemo, useState } from 'react';
import { employees as ALL_EMPLOYEES } from '../../../data/employees';
import type { SalaryAccrual, Deduction, SalaryPayout } from '../../../lib/admin/types';
import { accrualsStore, deductionsStore, payoutsStore } from '../../../lib/admin/store';
import PayrollEmployeeList from './PayrollEmployeeList';
import PayrollEmployeeCard from './PayrollEmployeeCard';

interface Props {
  tick: number;
  onChange: () => void;
}

const MOBILE_BREAKPOINT = 768;

export default function PayrollPanel({ tick, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ employeeId?: string }>).detail;
      if (detail?.employeeId) setSelectedId(detail.employeeId);
    };
    window.addEventListener('autolife:focus-payout', handler);
    return () => window.removeEventListener('autolife:focus-payout', handler);
  }, []);

  const employees = useMemo(
    () => ALL_EMPLOYEES.slice().sort((a, b) => {
      const sa = (a as { sortOrder?: number }).sortOrder ?? 0;
      const sb = (b as { sortOrder?: number }).sortOrder ?? 0;
      return sa - sb;
    }),
    []
  );

  const allAccruals   = useMemo<SalaryAccrual[]>(() => accrualsStore.list(),   [tick]);
  const allDeductions = useMemo<Deduction[]>    (() => deductionsStore.list(), [tick]);
  const allPayouts    = useMemo<SalaryPayout[]> (() => payoutsStore.list(),    [tick]);

  const selected = selectedId ? employees.find(e => e.id === selectedId) ?? null : null;

  const jumpToAccrual = (date: string, employeeId: string, roleKind: 'admin' | 'master') => {
    window.dispatchEvent(new CustomEvent('autolife:focus-accrual', {
      detail: { date, employeeId, roleKind },
    }));
  };

  const showList = !isMobile || !selected;
  const showCard = !isMobile || !!selected;

  return (
    <div className="aap__panel aap__payroll">
      {showList && (
        <div className="aap__payroll-left">
          <PayrollEmployeeList
            employees={employees}
            allAccruals={allAccruals}
            allDeductions={allDeductions}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      )}
      {showCard && (
        <div className="aap__payroll-right">
          {selected
            ? <PayrollEmployeeCard
                employee={selected}
                allAccruals={allAccruals}
                allDeductions={allDeductions}
                allPayouts={allPayouts}
                showBack={isMobile}
                onBack={() => setSelectedId(null)}
                onChange={onChange}
                onJumpToAccrual={jumpToAccrual}
              />
            : <div className="aap__payroll-empty">← выберите сотрудника, чтобы создать выплату или выдать аванс</div>
          }
        </div>
      )}
    </div>
  );
}
