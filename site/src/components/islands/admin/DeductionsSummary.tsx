/**
 * Read-only summary of an employee's deductions, shown inside the
 * payroll card. Displays unpaid totals split by type and the latest
 * 3 entries. CTA dispatches autolife:focus-deductions to switch tabs.
 */

import type { Deduction, SalaryPayout } from '../../../lib/admin/types';

interface Props {
  employeeId: string;
  deductions: Deduction[];   // already filtered to this employee
  payouts: SalaryPayout[];
}

function dotDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}

export default function DeductionsSummary({ employeeId, deductions, payouts }: Props) {
  let advCount = 0, advSum = 0, fineCount = 0, fineSum = 0;
  for (const d of deductions) {
    if (d.payoutId) continue;
    if (d.type === 'advance') { advCount++; advSum += d.amount; }
    else                      { fineCount++; fineSum += d.amount; }
  }
  const totalUnpaid = advSum + fineSum;

  const sorted = deductions.slice().sort((a, b) =>
    a.givenAt < b.givenAt ? 1 : (a.givenAt > b.givenAt ? -1 : 0)
  );
  const latest = sorted.slice(0, 3);

  const goToTab = () => {
    window.dispatchEvent(new CustomEvent('autolife:focus-deductions', {
      detail: { employeeId },
    }));
  };

  return (
    <section className="aap__ds">
      <h4 className="aap__ds-title">Удержания</h4>

      {totalUnpaid === 0 && deductions.length === 0 ? (
        <p className="aap__ds-empty">Удержаний нет.</p>
      ) : (
        <>
          <div className="aap__ds-summary">
            <div className="aap__ds-total">Висит к учёту: <strong>{totalUnpaid} ₽</strong></div>
            <div className="aap__ds-split">
              <span>💸 {advCount} аванс{advCount === 1 ? '' : advCount < 5 ? 'а' : 'ов'} · {advSum} ₽</span>
              <span>⚠ {fineCount} штраф{fineCount === 1 ? '' : fineCount < 5 ? 'а' : 'ов'} · {fineSum} ₽</span>
            </div>
          </div>

          {latest.length > 0 && (
            <ul className="aap__ds-latest">
              {latest.map(d => {
                const linked = d.payoutId ? payouts.find(p => p.id === d.payoutId) : null;
                return (
                  <li key={d.id}>
                    <span>{dotDate(d.givenAt)}</span>
                    <span>{d.amount} ₽</span>
                    <span className={`aap__ds-type is-${d.type}`}>{d.type === 'fine' ? 'штраф' : 'аванс'}</span>
                    <span className="aap__ds-note">«{d.note ?? '—'}»</span>
                    <span className={`aap__ds-status is-${linked ? 'paid' : 'unpaid'}`}>
                      {linked ? `✓ ${dotDate(linked.paidAt)}` : '⏳'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {deductions.length > 3 && (
            <p className="aap__ds-more">Ещё {deductions.length - 3} — см. вкладку Удержания</p>
          )}
        </>
      )}

      <button type="button" className="aap__ds-link" onClick={goToTab}>
        Управлять во вкладке "Удержания" →
      </button>
    </section>
  );
}
