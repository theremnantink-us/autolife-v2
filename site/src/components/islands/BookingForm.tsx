/**
 * BookingForm — online appointment form (#booking).
 *
 * Submits directly to Supabase (table: bookings). After insert, the
 * `notify-booking` Edge Function is invoked to fan out to Telegram + email.
 *
 * Security:
 *   - Honeypot field <input name="website"> hidden visually + tabindex=-1.
 *   - Submit timestamp guard (require >= 1.5s between mount and submit).
 *   - Inputs sanitized client-side; Supabase RLS gates the actual write.
 *
 * UX:
 *   - Pre-fill from sessionStorage when service cards trigger
 *     `autolife:booking-prefill` event.
 *   - Calendar disables blocked dates (read from `blocked_dates` table).
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import BookingCalendar from './BookingCalendar';
import { bookableEmployees } from '../../data/employees';
import { carBrands, modelsForBrand } from '../../data/cars';
import { submitBooking, listClosedDays } from '../../lib/bookings';

const MASTER_ANY = '';   // sentinel: «любой свободный»

const SERVICE_GROUPS = [
  {
    label: 'Детейлинг',
    options: [
      'Детейлинг мойка (от 6000 руб.)',
      'Полировка кузова (от 25000 руб.)',
      'Восстановление хромированных элементов (от 1500 руб.)',
      'Химчистка кожаных сидений (от 4000 руб.)',
      'Химчистка салона (от 18000 руб.)',
      'Полировка фар (от 2000 руб.)',
      'Антидождь на стёкла (от 3500 руб.)',
      'Керамическое покрытие (от 30000 руб.)',
    ],
  },
  {
    label: 'Шиномонтаж',
    options: [
      'Шиномонтаж (от 450 руб.)',
      'Балансировка колёс (от 150 руб.)',
      'Ремонт бокового пореза (от 1000 руб.)',
      'Замена покрышек (от 190 руб.)',
      'Хранение шин (от 5500 руб.)',
      'Шлифовка бортов диска (от 300 руб.)',
    ],
  },
];

interface FormState {
  name: string;
  phone: string;
  carBrand: string;
  carModel: string;
  service: string;
  master: string;        // employee id, '' = «любой свободный»
  date: string;          // 'YYYY-MM-DD HH:mm'
  additionalInfo: string;
  website: string;       // honeypot
}
type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  name: '', phone: '', carBrand: '', carModel: '',
  service: '', master: MASTER_ANY, date: '', additionalInfo: '', website: '',
};

function sanitizeText(s: string, max = 500): string {
  return s.replace(/[<>]/g, '').slice(0, max);
}

/** Russian mobile phone mask: +7 (XXX) XXX-XX-XX. Stateless — re-formats
 *  the entire value on every keystroke from its digits, so paste / autofill
 *  / backspace all behave naturally without cursor tricks. */
function formatPhone(raw: string): string {
  // Keep only digits; if user typed leading 7 or 8, drop it (we always
  // render the country code as +7).
  let digits = raw.replace(/\D/g, '');
  if (digits.length && (digits[0] === '7' || digits[0] === '8')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  if (digits.length === 0)      return '';
  if (digits.length <= 3)       return `+7 (${digits}`;
  if (digits.length <= 6)       return `+7 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 8)       return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

function validate(s: FormState): Errors {
  const e: Errors = {};
  if (s.name.trim().length < 2)             e.name = 'Введите имя';
  if (s.phone.replace(/\D/g, '').length < 10) e.phone = 'Введите телефон (минимум 10 цифр)';
  if (s.carBrand.trim().length < 1)         e.carBrand = 'Укажите марку';
  if (s.carModel.trim().length < 1)         e.carModel = 'Укажите модель';
  if (!s.service)                            e.service = 'Выберите услугу';
  if (!s.date)                               e.date = 'Выберите дату и время';
  return e;
}

export default function BookingForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy]     = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<null | FormState>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const mountedAt = useRef<number>(Date.now());

  // Load blocked dates from Supabase
  useEffect(() => {
    listClosedDays().then(setBusy).catch(() => { /* tolerate empty */ });
  }, []);

  // Pre-fill from service card / promo / employee CTA
  useEffect(() => {
    const apply = () => {
      try {
        const raw = sessionStorage.getItem('autolife:booking-prefill');
        if (!raw) return;
        const { service, master } = JSON.parse(raw) as { service?: string; master?: string };
        if (service) {
          // Find the option that contains the service name
          const all = SERVICE_GROUPS.flatMap(g => g.options);
          const match = all.find(o => o.toLowerCase().includes(service.toLowerCase().split(' ')[0]));
          if (match) setForm(f => ({ ...f, service: match }));
        }
        if (master && bookableEmployees.some(e => e.id === master)) {
          setForm(f => ({ ...f, master }));
        }
        sessionStorage.removeItem('autolife:booking-prefill');
      } catch { /* noop */ }
    };
    apply();
    window.addEventListener('autolife:booking-prefill', apply);
    return () => window.removeEventListener('autolife:booking-prefill', apply);
  }, []);

  // The calendar is now a controlled React component (BookingCalendar).
  // It owns the month grid + slot list, takes busy days as a prop, and
  // emits 'YYYY-MM-DD HH:mm' to the parent — same contract as Flatpickr.

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const allServices = useMemo(() => SERVICE_GROUPS.flatMap(g => g.options), []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setServerErr(null);

    // Honeypot — silent reject (looks like success to bot)
    if (form.website.trim().length > 0) {
      setSuccess(form);
      setForm(EMPTY);
      return;
    }
    // Time-on-page guard
    if (Date.now() - mountedAt.current < 1500) {
      setServerErr('Слишком быстрая отправка. Подождите момент и попробуйте ещё раз.');
      return;
    }

    const v = validate(form);
    if (Object.keys(v).length) { setErrors(v); return; }

    setPending(true);
    try {
      // form.date format: 'YYYY-MM-DD HH:mm' → ISO with Moscow offset
      const slotIso = form.date.replace(' ', 'T') + ':00+03:00';
      await submitBooking({
        name:            sanitizeText(form.name, 80),
        phone:           sanitizeText(form.phone, 24),
        car_brand:       sanitizeText(form.carBrand, 40),
        car_model:       sanitizeText(form.carModel, 40),
        service:         sanitizeText(form.service, 120),
        master_id:       form.master ? sanitizeText(form.master, 40) : null,
        slot_start:      slotIso,
        additional_info: sanitizeText(form.additionalInfo, 1000),
      });
      setSuccess(form);
      setForm(EMPTY);
    } catch (err: any) {
      setServerErr(err?.message ?? 'Не удалось отправить заявку');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bf" id="booking" aria-labelledby="booking-heading">
      <div className="container bf__grid">
        <header className="section__head bf__head">
          <p className="eyebrow">Онлайн-запись</p>
          <h2 id="booking-heading" className="section__title">Записаться в студию</h2>
          <p className="section__lead">
            Заполните форму — мы перезвоним для подтверждения. Услуги мойки также доступны в порядке живой очереди в часы работы.
          </p>

          <div className="bf-info">
            <h3 className="bf-info__title">Как работает запись</h3>
            <ol className="bf-info__steps">
              <li><b>1.</b> Выберите услугу из списка</li>
              <li><b>2.</b> Укажите марку и модель автомобиля</li>
              <li><b>3.</b> Выберите дату и время</li>
              <li><b>4.</b> Оператор перезвонит для подтверждения</li>
            </ol>
            <p className="bf-info__note">
              Если не получается приехать — сообщите за 2 часа.
            </p>
          </div>
        </header>

        <form className="bf-form glass" noValidate onSubmit={onSubmit} aria-busy={pending}>
          <div className="bf-form__row">
            <Field
              label="Имя *" name="name" autoComplete="name"
              value={form.name} error={errors.name}
              onChange={v => set('name', v)}
            />
            <Field
              label="Телефон *" name="phone" type="tel" autoComplete="tel"
              value={form.phone} error={errors.phone}
              onChange={v => set('phone', formatPhone(v))}
              placeholder="+7 (___) ___-__-__"
            />
          </div>

          <div className="bf-form__row">
            <Field
              label="Марка авто *" name="carBrand"
              value={form.carBrand} error={errors.carBrand}
              onChange={v => set('carBrand', v)}
              list="bf-brands"
              autoComplete="off"
              placeholder="например, Mercedes-Benz"
            />
            <Field
              label="Модель *" name="carModel"
              value={form.carModel} error={errors.carModel}
              onChange={v => set('carModel', v)}
              list="bf-models"
              autoComplete="off"
              placeholder={form.carBrand ? 'начните печатать' : 'сначала марка'}
            />
          </div>
          <datalist id="bf-brands">
            {carBrands.map(b => <option key={b} value={b} />)}
          </datalist>
          <datalist id="bf-models">
            {modelsForBrand(form.carBrand).map(m => <option key={m} value={m} />)}
          </datalist>

          <div className="bf-field">
            <label className="bf-field__label" htmlFor="bf-service">Услуга *</label>
            <select
              id="bf-service"
              className={`bf-field__input${errors.service ? ' has-error' : ''}`}
              value={form.service}
              onChange={e => set('service', e.target.value)}
              required
            >
              <option value="">— Выберите услугу —</option>
              {SERVICE_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
            {errors.service && <small className="bf-field__error">{errors.service}</small>}
          </div>

          <div className="bf-field">
            <label className="bf-field__label" htmlFor="bf-master">Мастер</label>
            <select
              id="bf-master"
              className="bf-field__input"
              value={form.master}
              onChange={e => set('master', e.target.value)}
            >
              <option value={MASTER_ANY}>Любой свободный</option>
              {bookableEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.position}
                </option>
              ))}
            </select>
            <small className="bf-field__hint">
              Можно выбрать конкретного мастера — расписание подстроится под него.
            </small>
          </div>

          <div className="bf-field">
            <label className="bf-field__label" htmlFor="bf-date">Дата и время *</label>
            <BookingCalendar
              value={form.date}
              onChange={v => set('date', v)}
              busyDates={busy}
              masterId={form.master}
              hasError={!!errors.date}
            />
            <small className="bf-field__hint">
              Часовые слоты, пн–пт 8:00–22:00, сб–вс 9:00–21:00.
            </small>
            {errors.date && <small className="bf-field__error">{errors.date}</small>}
          </div>

          <div className="bf-field">
            <label className="bf-field__label" htmlFor="bf-info">Дополнительная информация</label>
            <textarea
              id="bf-info"
              className="bf-field__input"
              rows={3}
              maxLength={1000}
              value={form.additionalInfo}
              onChange={e => set('additionalInfo', e.target.value)}
            />
          </div>

          {/* Honeypot — hidden from real users */}
          <div className="hp-field" aria-hidden="true">
            <label>Не заполняйте это поле
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={e => set('website', e.target.value)}
              />
            </label>
          </div>

          {serverErr && (
            <div className="bf-alert bf-alert--err" role="alert">{serverErr}</div>
          )}

          <label className="bf-form__agree">
            <input
              type="checkbox"
              className="bf-form__agree-chk"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              aria-required="true"
            />
            <span>
              Я ознакомился(-ась) и принимаю{' '}
              <a href="/user-agreement.html" target="_blank" rel="noopener">пользовательское соглашение</a>
              {' '}и{' '}
              <a href="/privacy-policy.html" target="_blank" rel="noopener">политику конфиденциальности</a>
            </span>
          </label>

          <button type="submit" className="btn btn--chrome bf-form__submit" disabled={pending || !agreed}>
            {pending ? 'Отправляем…' : 'Записаться'}
          </button>
        </form>
      </div>

      {/* Success modal */}
      {success && (
        <div className="bf-modal" role="dialog" aria-modal="true" aria-label="Запись принята">
          <div className="bf-modal__panel glass">
            <button
              className="bf-modal__close"
              type="button"
              aria-label="Закрыть"
              onClick={() => setSuccess(null)}
            >×</button>
            <h3 className="bf-modal__title">Запись принята</h3>
            <p className="bf-modal__lead">Мы перезвоним для подтверждения в ближайшее время.</p>
            <dl className="bf-modal__list">
              <dt>Имя</dt>           <dd>{success.name}</dd>
              <dt>Телефон</dt>       <dd>{success.phone}</dd>
              <dt>Автомобиль</dt>    <dd>{success.carBrand} {success.carModel}</dd>
              <dt>Услуга</dt>        <dd>{success.service}</dd>
              <dt>Мастер</dt>        <dd>{bookableEmployees.find(e => e.id === success.master)?.name ?? 'Любой свободный'}</dd>
              <dt>Дата и время</dt>  <dd>{success.date}</dd>
            </dl>
            <button className="btn btn--chrome bf-modal__cta" type="button" onClick={() => setSuccess(null)}>
              Понятно
            </button>
          </div>
        </div>
      )}

      <style>{`
        .bf {
          position: relative;
          z-index: 2;
          padding-block: var(--space-9);
          /* Extra inline breathing room — the booking section was hugging
             the viewport edges and pushing its two blocks far apart. */
          padding-inline: clamp(var(--space-3), 3vw, var(--space-6));
          background: transparent;
          overflow-x: clip;
        }
        .bf__grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: minmax(0, 1fr);
          width: 100%;
        }
        .bf__grid > * { min-width: 0; max-width: 100%; }
        @media (min-width: 1024px) {
          .bf__grid {
            /* Tighter gap between info column and form column — they were
               sitting too far apart even on wide screens. */
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
            gap: var(--space-5);
          }
        }
        .bf__head { max-width: 56ch; }

        .bf-info {
          margin-top: var(--space-5);
          padding: var(--space-4);
          background: var(--bg-elev);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
        }
        .bf-info__title {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--chrome-2);
          margin-bottom: 10px;
        }
        .bf-info__steps li { padding: 6px 0; color: var(--text); font-size: 14px; }
        .bf-info__steps b { color: var(--chrome-1); margin-right: 6px; }
        .bf-info__note { color: var(--text-muted); font-size: 13px; margin-top: 8px; }

        .bf-form {
          padding: var(--space-5);
          border-radius: var(--r-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .bf-form__row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: var(--space-3);
        }
        .bf-form__row > * { min-width: 0; }
        @media (max-width: 599px) {
          .bf-form__row { grid-template-columns: minmax(0, 1fr); }
        }
        .bf-field__input { max-width: 100%; }
        .bf-field { min-width: 0; }
        .bf-form { max-width: 100%; min-width: 0; }

        .bf-field { display: flex; flex-direction: column; gap: 6px; }
        .bf-field__label {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--chrome-2);
        }
        .bf-field__input {
          padding: 12px 14px;
          background: var(--bg);
          border: 1px solid var(--hairline);
          border-radius: var(--r-md);
          color: var(--text);
          font-size: 15px;
          font-family: var(--font-body);
          transition: border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
        }
        .bf-field__input:focus {
          outline: none;
          border-color: var(--chrome-2);
          background: var(--bg-elev);
        }
        .bf-field__input.has-error { border-color: var(--danger); }
        .bf-field__hint  { color: var(--text-dim); font-size: 12px; }
        .bf-field__error { color: var(--danger); font-size: 12px; }

        select.bf-field__input {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--chrome-2) 50%),
                            linear-gradient(135deg, var(--chrome-2) 50%, transparent 50%);
          background-position: calc(100% - 18px) 20px, calc(100% - 13px) 20px;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
          padding-right: 36px;
        }
        textarea.bf-field__input { resize: vertical; min-height: 88px; }

        .bf-alert {
          padding: 12px 14px;
          border-radius: var(--r-md);
          font-size: 13px;
        }
        .bf-alert--err {
          background: rgba(207,106,90,0.08);
          border: 1px solid rgba(207,106,90,0.4);
          color: #f5b6ab;
        }

        .bf-form__submit { padding: 14px 20px; }
        .bf-form__submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .bf-form__agree {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .bf-form__agree-chk {
          flex-shrink: 0;
          width: 16px; height: 16px;
          margin-top: 2px;
          accent-color: var(--chrome-1, #e8eaed);
          cursor: pointer;
        }
        .bf-form__agree a { color: var(--chrome-2); text-decoration: underline; }

        /* Modal */
        .bf-modal {
          position: fixed; inset: 0;
          z-index: var(--z-modal);
          display: grid; place-items: center;
          padding: var(--space-4);
          background: rgba(8,9,11,0.86);
          backdrop-filter: blur(8px);
        }
        .bf-modal__panel {
          width: min(100%, 480px);
          padding: var(--space-6);
          border-radius: var(--r-lg);
          position: relative;
        }
        .bf-modal__close {
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px;
          color: var(--chrome-2);
          font-size: 20px;
        }
        .bf-modal__title {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 22px;
          margin-bottom: 8px;
          background: var(--chrome-gradient);
          -webkit-background-clip: text;
                  background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .bf-modal__lead { color: var(--text-muted); font-size: 14px; margin-bottom: var(--space-4); }
        .bf-modal__list { display: grid; grid-template-columns: 1fr 2fr; gap: 6px var(--space-3); margin-bottom: var(--space-5); }
        .bf-modal__list dt { color: var(--text-dim); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
        .bf-modal__list dd { color: var(--text); font-size: 14px; }
        .bf-modal__cta { width: 100%; }

        /* Flatpickr theming overrides live in global.css — :global() is a
           Vue/Svelte construct that React's JSX <style> tag does not honour
           (the calendar portals into <body> and would never match scoped
           rules anyway). */
      `}</style>
    </section>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  /** id of a sibling <datalist> for native autocomplete suggestions */
  list?: string;
}
function Field({ label, name, type = 'text', value, error, onChange, placeholder, autoComplete, list }: FieldProps) {
  return (
    <div className="bf-field">
      <label className="bf-field__label" htmlFor={`bf-${name}`}>{label}</label>
      <input
        id={`bf-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        list={list}
        className={`bf-field__input${error ? ' has-error' : ''}`}
        required={label.includes('*')}
      />
      {error && <small className="bf-field__error">{error}</small>}
    </div>
  );
}
