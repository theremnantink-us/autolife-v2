/**
 * Удержания tab root. Two-panel grid on desktop, swap on mobile.
 * Listens for autolife:focus-deductions event to set selectedId.
 */

import { useEffect, useMemo, useState } from 'react';
import { employees as ALL_EMPLOYEES } from '../../../data/employees';
import type { Deduction, SalaryPayout } from '../../../lib/admin/types';
import { deductionsStore, payoutsStore } from '../../../lib/admin/store';
import DeductionsEmployeeList from './DeductionsEmployeeList';
import DeductionsEmployeeCard from './DeductionsEmployeeCard';

interface Props {
  tick: number;
  onChange: () => void;
}

const MOBILE_BREAKPOINT = 768;

export default function DeductionsPanel({ tick, onChange }: Props) {
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
    window.addEventListener('autolife:focus-deductions', handler);
    return () => window.removeEventListener('autolife:focus-deductions', handler);
  }, []);

  const employees = useMemo(
    () => ALL_EMPLOYEES.slice().sort((a, b) => {
      const sa = (a as { sortOrder?: number }).sortOrder ?? 0;
      const sb = (b as { sortOrder?: number }).sortOrder ?? 0;
      return sa - sb;
    }),
    []
  );

  const allDeductions = useMemo<Deduction[]>     (() => deductionsStore.list(), [tick]);
  const allPayouts    = useMemo<SalaryPayout[]>  (() => payoutsStore.list(),    [tick]);

  const selected = selectedId ? employees.find(e => e.id === selectedId) ?? null : null;

  const showList = !isMobile || !selected;
  const showCard = !isMobile || !!selected;

  return (
    <div className="aap__panel aap__d">
      {showList && (
        <div className="aap__d-left">
          <DeductionsEmployeeList
            employees={employees}
            allDeductions={allDeductions}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      )}
      {showCard && (
        <div className="aap__d-right">
          {selected
            ? <DeductionsEmployeeCard
                employee={selected}
                allDeductions={allDeductions}
                allPayouts={allPayouts}
                showBack={isMobile}
                onBack={() => setSelectedId(null)}
                onChange={onChange}
              />
            : <div className="aap__d-empty">← выберите сотрудника, чтобы выдать аванс или штраф</div>
          }
        </div>
      )}
    </div>
  );
}
