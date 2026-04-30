/**
 * List of all deductions of the selected employee, with type filter
 * (all/advances/fines), status badge, remove button for unpaid only,
 * and click-on-status to focus the linked payout.
 */

import { useState } from 'react';
import type { Deduction, SalaryPayout } from '../../../lib/admin/types';
import { deductionsStore } from '../../../lib/admin/store';

interface Props {
  employeeId: string;
  deductions: Deduction[];   // already filtered to this employee
  payouts: SalaryPayout[];
  onChange: () => void;
}

function dotDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}

type Filter = 'all' | 'advance' | 'fine';

export default function DeductionsList({ employeeId, deductions, payouts, onChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = deductions.filter(d => filter === 'all' ? true : d.type === filter);
  const sorted = filtered.slice().sort((a, b) =>
    a.givenAt < b.givenAt ? 1 : (a.givenAt > b.givenAt ? -1 : 0)
  );

  const remove = (id: string) => {
    if (!window.confirm('Удалить удержание?')) return;
    deductionsStore.remove(id);
    onChange();
  };

  const focusPayout = (payoutId: string, employeeId: string) => {
    window.dispatchEvent(new CustomEvent('autolife:focus-payout', {
      detail: { employeeId, payoutId },
    }));
  };

  return (
    <section className="aap__dl">
      <header className="aap__dl-head">
        <h4 className="aap__dl-title">Все удержания</h4>
        <div className="aap__dl-filters" role="radiogroup" aria-label="Фильтр">
          {(['all', 'advance', 'fine'] as const).map(f => (
            <button
              key={f}
              type="button"
              className={`aap__dl-filter${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >{f === 'all' ? 'Все' : f === 'advance' ? 'Авансы' : 'Штрафы'}</button>
          ))}
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="aap__dl-empty">Удержаний нет.</p>
      ) : (
        <ul className="aap__dl-rows">
          {sorted.map(d => {
            const linked = d.payoutId ? payouts.find(p => p.id === d.payoutId) : null;
            return (
              <li key={d.id} className="aap__dl-row">
                <span className="aap__dl-date">{dotDate(d.givenAt)}</span>
                <span className="aap__dl-amount">{d.amount} ₽</span>
                <span className={`aap__dl-type is-${d.type}`}>{d.type === 'fine' ? 'штраф' : 'аванс'}</span>
                <span className="aap__dl-note">{d.note ?? '—'}</span>
                {linked
                  ? <button
                      type="button"
                      className="aap__dl-status is-paid"
                      onClick={() => focusPayout(linked.id, employeeId)}
                      title="Перейти к выплате"
                    >✓ учтён {dotDate(linked.paidAt)}</button>
                  : <span className="aap__dl-status is-unpaid">⏳ не учтён</span>
                }
                {!linked && (
                  <button
                    type="button"
                    className="aap__dl-remove"
                    onClick={() => remove(d.id)}
                    aria-label="Удалить"
                  >🗑</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
