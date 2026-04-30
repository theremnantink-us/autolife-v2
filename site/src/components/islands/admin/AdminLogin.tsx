import { useState } from 'react';
import { supabase, supabaseReady } from '../../../lib/supabase';

interface Props {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!supabase || !supabaseReady) {
      setError('Supabase не настроен — добавьте PUBLIC_SUPABASE_ANON_KEY в .env');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onLogin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === 'Invalid login credentials' ? 'Неверный email или пароль' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adl">
      <div className="adl__card">
        <p className="adl__logo">AUTOLIFE</p>
        <h1 className="adl__title">Вход в панель управления</h1>

        {!supabaseReady && (
          <div className="adl__warn">
            Supabase не настроен.<br />
            Добавьте <code>PUBLIC_SUPABASE_URL</code> и <code>PUBLIC_SUPABASE_ANON_KEY</code> в <code>site/.env</code>.
          </div>
        )}

        <form className="adl__form" onSubmit={handleSubmit} noValidate>
          <div className="adl__field">
            <label className="adl__label" htmlFor="adl-email">Email</label>
            <input
              id="adl-email"
              type="email"
              className="adl__input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="adl__field">
            <label className="adl__label" htmlFor="adl-pw">Пароль</label>
            <input
              id="adl-pw"
              type="password"
              className="adl__input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <p className="adl__error" role="alert">{error}</p>}

          <button type="submit" className="adl__submit" disabled={loading || !supabaseReady}>
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>

      <style>{`
        .adl {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-display);
        }
        .adl__card {
          width: 100%;
          max-width: 380px;
          padding: 36px 32px;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur)) saturate(140%);
          border: 1px solid rgba(232,234,237,0.10);
          border-radius: var(--r-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .adl__logo {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: var(--chrome-2);
          text-transform: uppercase;
          margin: 0;
        }
        .adl__title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .adl__warn {
          padding: 12px 14px;
          background: rgba(212,160,23,0.12);
          border: 1px solid rgba(212,160,23,0.3);
          border-radius: var(--r-sm);
          font-size: 13px;
          color: #d4a017;
          line-height: 1.5;
        }
        .adl__warn code {
          background: rgba(255,255,255,0.08);
          padding: 1px 5px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
        }
        .adl__form { display: flex; flex-direction: column; gap: 14px; }
        .adl__field { display: flex; flex-direction: column; gap: 6px; }
        .adl__label { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(232,234,237,0.55); }
        .adl__input {
          height: 42px;
          padding: 0 14px;
          background: rgba(8,9,11,0.6);
          border: 1px solid rgba(232,234,237,0.12);
          border-radius: var(--r-sm);
          color: var(--text);
          font-family: inherit;
          font-size: 14px;
        }
        .adl__input:focus { outline: none; border-color: var(--chrome-2); }
        .adl__input:disabled { opacity: 0.5; }
        .adl__error {
          padding: 10px 12px;
          background: rgba(232,100,100,0.12);
          border: 1px solid rgba(232,100,100,0.3);
          border-radius: var(--r-sm);
          font-size: 13px;
          color: #e87a7a;
          margin: 0;
        }
        .adl__submit {
          height: 44px;
          border-radius: 999px;
          background: var(--chrome-gradient);
          color: #0b0c0e;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          box-shadow: var(--shadow-chrome);
          transition: opacity 0.15s;
        }
        .adl__submit:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
