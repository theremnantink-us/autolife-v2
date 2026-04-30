/**
 * One row of the daily accruals journal: an employee's name, one or two
 * amount inputs (depending on role / isMultiRole), a note input, and a
 * tiny status indicator. Locked rows render values as plain text with a
 * "выплачено dd.mm" badge and an "Отвязать" action.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Employee } from '../../../data/employees';
import type { SalaryAccrual } from '../../../lib/admin/types';
import { isLockedByPayout } from '../../../lib/admin/journal';

type RoleKind = 'admin' | 'master';

interface Payout { id: string; paidAt: string; totalAmount: number; }

interface Props {
  employee: Employee;
  date: string;                  // YYYY-MM-DD
  rowAccruals: SalaryAccrual[];  // 0..2 entries (one per roleKind)
  payouts: Payout[];
  onSaveAmount: (params: { roleKind: RoleKind; amount: number | null; note?: string }) => void;
  onSaveNote:   (params: { roleKind: RoleKind; note: string }) => void;
  onUnlock:     (accrualId: string) => void;
}

function showAdminCol(emp: Employee): boolean {
  return emp.role !== 'master';
}
function showMasterCol(emp: Employee): boolean {
  return emp.role !== 'admin-shift' || emp.isMultiRole === true;
}
function dotDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}

export default function JournalDayRow({
  employee, rowAccruals, payouts,
  onSaveAmount, onSaveNote, onUnlock,
}: Props) {
  const adminRow  = rowAccruals.find(a => a.roleKind === 'admin');
  const masterRow = rowAccruals.find(a => a.roleKind === 'master');

  const adminLocked  = adminRow  ? isLockedByPayout(adminRow,  payouts) : false;
  const masterLocked = masterRow ? isLockedByPayout(masterRow, payouts) : false;
  const lockedRow    = adminLocked && masterLocked
    ? adminRow
    : (adminLocked ? adminRow : (masterLocked ? masterRow : null));
  const lockedPayout = lockedRow ? payouts.find(p => p.id === lockedRow.payoutId) ?? null : null;

  return (
    <tr className={`jdr${lockedRow ? ' is-locked' : ''}`}>
      <th scope="row" className="jdr__name">{employee.name}</th>

      <td className="jdr__cell">
        {showAdminCol(employee)
          ? <AmountField
              initial={adminRow?.amount ?? null}
              locked={adminLocked}
              onCommit={(amount) => onSaveAmount({ roleKind: 'admin', amount, note: adminRow?.note })}
            />
          : <span className="jdr__dash" aria-label="не применимо">—</span>}
      </td>

      <td className="jdr__cell">
        {showMasterCol(employee)
          ? <AmountField
              initial={masterRow?.amount ?? null}
              locked={masterLocked}
              onCommit={(amount) => onSaveAmount({ roleKind: 'master', amount, note: masterRow?.note })}
            />
          : <span className="jdr__dash" aria-label="не применимо">—</span>}
      </td>

      <td className="jdr__cell jdr__note-cell">
        <NoteField
          initial={(masterRow ?? adminRow)?.note ?? ''}
          locked={!!lockedRow}
          onCommit={(note) => onSaveNote({
            roleKind: masterRow ? 'master' : (adminRow ? 'admin' : 'master'),
            note,
          })}
        />
      </td>

      <td className="jdr__cell jdr__status">
        {lockedRow && lockedPayout
          ? <LockBadge payout={lockedPayout} onUnlock={() => onUnlock(lockedRow.id)} />
          : <SaveDot accruals={rowAccruals} />}
      </td>
    </tr>
  );
}

/* ───────── AmountField ───────── */

function AmountField({
  initial, locked, onCommit,
}: { initial: number | null; locked: boolean; onCommit: (amount: number | null) => void }) {
  const [val, setVal] = useState<string>(initial == null ? '' : String(initial));
  const [err, setErr] = useState<string | null>(null);
  const lastCommitted = useRef<string>(initial == null ? '' : String(initial));

  useEffect(() => {
    const next = initial == null ? '' : String(initial);
    setVal(next);
    lastCommitted.current = next;
    setErr(null);
  }, [initial]);

  if (locked) {
    return <span className="jdr__locked-val">{initial == null ? '' : `${initial} ₽`}</span>;
  }

  const onBlur = () => {
    const trimmed = val.trim();
    if (trimmed === lastCommitted.current) return;
    if (trimmed === '') {
      setErr(null);
      lastCommitted.current = '';
      onCommit(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n <= 0 || String(n) !== trimmed) {
      setErr('Только положительное целое');
      return;
    }
    setErr(null);
    lastCommitted.current = String(n);
    onCommit(n);
  };

  return (
    <span className="jdr__amount-wrap">
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        className={`jdr__amount${err ? ' has-error' : ''}`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        aria-invalid={!!err}
        aria-label="Сумма ₽"
      />
      {err && <span className="jdr__err" role="alert" title={err}>!</span>}
    </span>
  );
}

/* ───────── NoteField ───────── */

function NoteField({
  initial, locked, onCommit,
}: { initial: string; locked: boolean; onCommit: (note: string) => void }) {
  const [val, setVal] = useState(initial);
  const lastCommitted = useRef(initial);

  useEffect(() => {
    setVal(initial);
    lastCommitted.current = initial;
  }, [initial]);

  if (locked) {
    return <span className="jdr__locked-note">{initial}</span>;
  }

  const onBlur = () => {
    const trimmed = val.trim();
    if (trimmed === lastCommitted.current) return;
    lastCommitted.current = trimmed;
    onCommit(trimmed);
  };

  return (
    <input
      type="text"
      className="jdr__note"
      maxLength={80}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={onBlur}
      placeholder="заметка"
      aria-label="Заметка"
    />
  );
}

/* ───────── SaveDot — shows ✓ briefly after a row save ───────── */

function SaveDot({ accruals }: { accruals: SalaryAccrual[] }) {
  const [pulse, setPulse] = useState(false);
  const sig = accruals.map(a => `${a.id}:${a.amount}:${a.note ?? ''}`).join('|');
  const lastSig = useRef(sig);

  useEffect(() => {
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      return () => clearTimeout(t);
    }
  }, [sig]);

  if (!pulse) return null;
  return <span className="jdr__saved" aria-label="сохранено">✓</span>;
}

/* ───────── LockBadge ───────── */

function LockBadge({
  payout, onUnlock,
}: { payout: Payout; onUnlock: () => void }) {
  const onClick = (e: FormEvent) => {
    e.preventDefault();
    const ok = window.confirm(
      `Отвязать строку из выплаты от ${dotDate(payout.paidAt)}?\n` +
      `Сама выплата останется как есть (сумма ${payout.totalAmount} ₽), но эта строка снова станет редактируемой.`
    );
    if (ok) onUnlock();
  };
  return (
    <span className="jdr__lock">
      <span className="jdr__lock-badge" title={`Включено в выплату от ${dotDate(payout.paidAt)}. Сумма: ${payout.totalAmount} ₽.`}>
        🔒 выплачено {dotDate(payout.paidAt)}
      </span>
      <button type="button" className="jdr__unlock" onClick={onClick} aria-label="Отвязать от выплаты">↩</button>
    </span>
  );
}
