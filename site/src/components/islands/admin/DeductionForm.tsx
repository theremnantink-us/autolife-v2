/**
 * Form for issuing a new deduction (advance or fine) to the selected
 * employee. Free-text reason. Confirm dialog only on type='fine'.
 */

import { useState } from 'react';
import { deductionsStore } from '../../../lib/admin/store';

interface Props {
  employeeId: string;
  employeeName: string;
  onChange: () => void;
}

export default function DeductionForm({ employeeId, employeeName, onChange }: Props) {
  const [type, setType]     = useState<'advance' | 'fine'>('advance');
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    if (type === 'fine') {
      const ok = window.confirm(
        `Назначить штраф ${n} ₽ для ${employeeName}?` + (note.trim() ? `\nПричина: «${note.trim()}»` : '')
      );
      if (!ok) return;
    }
    deductionsStore.upsert({
      employeeId,
      type,
      amount: n,
      givenAt: new Date().toISOString(),
      note: note.trim() || undefined,
    });
    setAmount('');
    setNote('');
    setType('advance');
    onChange();
  };

  return (
    <section className="aap__df">
      <h4 className="aap__df-title">Выдать удержание</h4>
      <form className="aap__df-form" onSubmit={submit}>
        <div className="aap__df-types" role="radiogroup" aria-label="Тип удержания">
          <label className={`aap__df-type${type === 'advance' ? ' is-active' : ''}`}>
            <input type="radio" name="dtype" checked={type === 'advance'} onChange={() => setType('advance')} />
            <span>💸 Аванс</span>
          </label>
          <label className={`aap__df-type${type === 'fine' ? ' is-active' : ''}`}>
            <input type="radio" name="dtype" checked={type === 'fine'} onChange={() => setType('fine')} />
            <span>⚠ Штраф</span>
          </label>
        </div>
        <input
          type="number" min={1} step={1} inputMode="numeric"
          className="aap__df-amount"
          placeholder="Сумма ₽"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          aria-label="Сумма"
        />
        <input
          type="text" maxLength={80}
          className="aap__df-note"
          placeholder={type === 'fine' ? 'Причина штрафа' : 'Заметка'}
          value={note}
          onChange={e => setNote(e.target.value)}
          aria-label="Заметка"
        />
        <button
          type="submit"
          className="aap__df-submit"
          disabled={!amount || parseInt(amount, 10) <= 0}
        >{type === 'fine' ? 'Назначить штраф' : 'Выдать аванс'}</button>
      </form>
    </section>
  );
}
