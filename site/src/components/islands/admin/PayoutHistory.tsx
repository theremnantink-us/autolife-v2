/**
 * List of past payouts for a selected employee. Each row supports:
 *   - expand/collapse details (linked accruals + advances)
 *   - inline note edit (📝)
 *   - rollback (🗑) — calls rollbackPayout, removes the entry, clears
 *     payoutId from previously-linked rows.
 *
 * Sorted newest first. No pagination (deferred; <30 entries hits ~year+).
 */

import { useState } from 'react';
import type { SalaryAccrual, Deduction, SalaryPayout } from '../../../lib/admin/types';
import { payoutsStore } from '../../../lib/admin/store';
import { rollbackPayout } from '../../../lib/admin/payout';

interface Props {
  payouts: SalaryPayout[];        // already filtered to this employee
  allAccruals: SalaryAccrual[];   // for expand-detail lookup
  allDeductions: Deduction[];     // for expand-detail lookup
  onChange: () => void;
}

function dotDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}
function fullDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [y, m, d] = ymd.split('-');
  return `${d}.${m}.${y}`;
}
function periodShort(start: string, end: string): string {
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const sMonth = months[parseInt(sm, 10) - 1];
  const eMonth = months[parseInt(em, 10) - 1];
  if (sm === em) return `${parseInt(sd, 10)}–${parseInt(ed, 10)} ${sMonth}`;
  return `${parseInt(sd, 10)} ${sMonth} – ${parseInt(ed, 10)} ${eMonth}`;
}

export default function PayoutHistory({ payouts, allAccruals, allDeductions, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editValue,  setEditValue]  = useState('');

  const sorted = payouts.slice().sort((a, b) =>
    a.paidAt < b.paidAt ? 1 : (a.paidAt > b.paidAt ? -1 : 0)
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const startEditNote = (p: SalaryPayout) => {
    setEditingId(p.id);
    setEditValue(p.note ?? '');
  };
  const commitEditNote = (p: SalaryPayout) => {
    payoutsStore.upsert({ ...p, note: editValue.trim() || undefined });
    setEditingId(null);
    onChange();
  };

  const rollback = (p: SalaryPayout) => {
    if (!window.confirm(
      `Откатить выплату от ${fullDate(p.paidAt)} (${p.totalAmount} ₽)?\n` +
      `Все строки журнала и авансы из этого периода снова станут «не выплачено». Сама запись о выплате будет удалена.`
    )) return;
    rollbackPayout(p.id);
    onChange();
  };

  if (sorted.length === 0) {
    return (
      <section className="aap__ph">
        <h4 className="aap__ph-title">История выплат</h4>
        <p className="aap__ph-empty">Выплат пока нет.</p>
      </section>
    );
  }

  return (
    <section className="aap__ph">
      <h4 className="aap__ph-title">История выплат</h4>
      <ul className="aap__ph-list">
        {sorted.map(p => {
          const linkedAccruals = allAccruals.filter(a => a.payoutId === p.id);
          const linkedDeductions = allDeductions.filter(a => a.payoutId === p.id);
          const expanded = expandedId === p.id;
          const editing  = editingId === p.id;

          return (
            <li key={p.id} className="aap__ph-row">
              <div className="aap__ph-summary">
                <span className="aap__ph-date">{fullDate(p.paidAt)}</span>
                <span className="aap__ph-period">{periodShort(p.periodStart, p.periodEnd)}</span>
                <span className="aap__ph-amount">{p.totalAmount} ₽</span>
                {editing
                  ? <input
                      className="aap__ph-note-edit"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEditNote(p)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEditNote(p); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                      maxLength={80}
                    />
                  : <span className="aap__ph-note">«{p.note ?? '—'}»</span>
                }
                <button type="button" className="aap__ph-action" onClick={() => toggleExpand(p.id)} aria-label="Подробнее">{expanded ? '▴' : '▾'}</button>
                <button type="button" className="aap__ph-action" onClick={() => startEditNote(p)} aria-label="Редактировать заметку">📝</button>
                <button type="button" className="aap__ph-action" onClick={() => rollback(p)} aria-label="Откатить выплату">🗑</button>
              </div>

              {expanded && (
                <div className="aap__ph-details">
                  <h5>Привязано:</h5>
                  {linkedAccruals.length === 0
                    ? <p className="aap__ph-empty">Начислений нет.</p>
                    : <ul>
                        {linkedAccruals.map(a => (
                          <li key={a.id}>
                            {dotDate(a.accrualDate)} · {a.roleKind === 'admin' ? 'админ' : 'мойка'} · {a.amount} ₽ · «{a.note ?? '—'}»
                          </li>
                        ))}
                      </ul>
                  }
                  <h5>Удержания:</h5>
                  {linkedDeductions.length === 0
                    ? <p className="aap__ph-empty">Удержаний нет.</p>
                    : <ul>
                        {linkedDeductions.map(a => (
                          <li key={a.id}>
                            {dotDate(a.givenAt)} · {a.type === 'fine' ? 'штраф' : 'аванс'} · {a.amount} ₽ · «{a.note ?? '—'}»
                          </li>
                        ))}
                      </ul>
                  }
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
