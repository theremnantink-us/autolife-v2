/**
 * StoriesPanel — admin CRUD for Instagram-style stories / company blog.
 *
 * Create a story (cover + slides), pick kind (акция / услуга / новости),
 * set CTA, choose permanent or ephemeral (expires after N hours), publish
 * toggle, reorder, delete. Live on the site immediately.
 */
import { useEffect, useRef, useState } from 'react';
import {
  listStoriesAll, createStory, updateStory, deleteStory,
  reorderStories, uploadStoryImage, STORY_KIND_LABEL,
  type StoryRow, type StoryKind, type StorySlide,
} from '../../../lib/stories';
import { supabaseReady } from '../../../lib/supabase';

const KINDS: StoryKind[] = ['promo', 'service', 'news'];

export default function StoriesPanel() {
  const [items, setItems]   = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    listStoriesAll().then(setItems).finally(() => setLoading(false));
  };
  useEffect(reload, []);

  async function addStory() {
    setBusy(true); setError(null);
    try {
      const id = await createStory({ title: 'Новая история', kind: 'promo', sort_order: items.length + 1, published: false });
      reload();
      setEditId(id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    const arr = [...items];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    setItems(arr);
    try { await reorderStories(arr.map(s => s.id)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); reload(); }
  }

  if (!supabaseReady) {
    return <div className="stp__empty">Supabase не настроен — истории недоступны.</div>;
  }

  const editing = items.find(s => s.id === editId) ?? null;

  return (
    <div className="stp">
      <div className="stp__bar">
        <div>
          <h2 className="stp__h">Истории и блог</h2>
          <p className="stp__sub">{items.length} · кружки на главной с акциями и новыми услугами</p>
        </div>
        <button type="button" className="stp__add" disabled={busy} onClick={addStory}>
          {busy ? '…' : '＋ Новая история'}
        </button>
      </div>

      {error && <div className="stp__error">⚠️ {error}</div>}

      {loading ? (
        <div className="stp__empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="stp__empty">Пока нет историй. Нажмите «Новая история».</div>
      ) : (
        <div className="stp__list">
          {items.map((s, i) => (
            <div key={s.id} className="stp__item">
              <div className="stp__cover">
                {s.cover_url ? <img src={s.cover_url} alt={s.title} /> : <span>{s.title.slice(0,1) || '•'}</span>}
              </div>
              <div className="stp__meta">
                <strong>{s.title || '(без названия)'}</strong>
                <span className="stp__tags">
                  <span className="stp__tag">{STORY_KIND_LABEL[s.kind]}</span>
                  <span className={`stp__tag ${s.published ? 'stp__tag--on' : 'stp__tag--off'}`}>
                    {s.published ? 'Опубликовано' : 'Черновик'}
                  </span>
                  <span className="stp__tag">{s.permanent ? 'Постоянная' : 'Исчезает'}</span>
                  <span className="stp__tag">{(s.slides?.length ?? 0)} слайд(ов)</span>
                </span>
              </div>
              <div className="stp__ops">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Выше">↑</button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === items.length - 1} title="Ниже">↓</button>
                <button type="button" onClick={() => setEditId(s.id)}>Изменить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <StoryEditor
          story={editing}
          onClose={() => setEditId(null)}
          onSaved={() => { reload(); }}
          onError={setError}
        />
      )}

      <style>{`
        .stp { display: flex; flex-direction: column; gap: 16px; }
        .stp__bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .stp__h { font-family: var(--font-display); font-size: 20px; margin: 0; }
        .stp__sub { color: var(--text-muted); font-size: 13px; margin: 4px 0 0; }
        .stp__add {
          padding: 11px 18px; border-radius: var(--r-sm); font-weight: 600; font-size: 14px; cursor: pointer;
          background: var(--chrome-gradient); color: #0b0c0e; border: 1px solid rgba(255,255,255,0.25); white-space: nowrap;
        }
        .stp__add:disabled { opacity: 0.6; }
        .stp__error { color: #ff8a8a; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.25); padding: 10px 14px; border-radius: var(--r-sm); font-size: 13px; }
        .stp__empty { color: var(--text-muted); padding: 40px 0; text-align: center; }
        .stp__list { display: flex; flex-direction: column; gap: 10px; }
        .stp__item {
          display: flex; align-items: center; gap: 14px; padding: 12px;
          border-radius: var(--r-md); background: var(--glass-bg); border: 1px solid var(--hairline);
        }
        .stp__cover { width: 54px; height: 54px; border-radius: 50%; overflow: hidden; flex: 0 0 auto;
          background: #14171b; display: grid; place-items: center; color: var(--chrome-1); font-family: var(--font-display); }
        .stp__cover img { width: 100%; height: 100%; object-fit: cover; }
        .stp__meta { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .stp__meta strong { color: var(--text); font-size: 15px; }
        .stp__tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .stp__tag { font-size: 11px; color: var(--text-muted); background: var(--bg-elev); border: 1px solid var(--hairline); border-radius: 999px; padding: 2px 8px; }
        .stp__tag--on { color: #58d68d; border-color: rgba(88,214,141,0.4); }
        .stp__tag--off { color: #e6a23c; border-color: rgba(230,162,60,0.4); }
        .stp__ops { display: flex; gap: 6px; flex: 0 0 auto; }
        .stp__ops button {
          padding: 7px 10px; border-radius: var(--r-sm); cursor: pointer; font-size: 13px;
          background: var(--bg-elev); color: var(--text); border: 1px solid var(--hairline);
        }
        .stp__ops button:disabled { opacity: 0.3; cursor: default; }
      `}</style>
    </div>
  );
}

/* ───────────────────────────── Editor ─────────────────────────────── */

function StoryEditor({
  story, onClose, onSaved, onError,
}: {
  story: StoryRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState<StoryRow>(story);
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const slideRef = useRef<HTMLInputElement | null>(null);

  function set<K extends keyof StoryRow>(k: K, v: StoryRow[K]) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try { set('cover_url', await uploadStoryImage(file)); }
    catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); if (coverRef.current) coverRef.current.value = ''; }
  }

  async function addSlides(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const added: StorySlide[] = [];
      for (const f of Array.from(files)) added.push({ url: await uploadStoryImage(f), caption: '' });
      setDraft(d => ({ ...d, slides: [...(d.slides ?? []), ...added], cover_url: d.cover_url || added[0]?.url || '' }));
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); if (slideRef.current) slideRef.current.value = ''; }
  }

  function setSlideCaption(i: number, caption: string) {
    setDraft(d => ({ ...d, slides: d.slides.map((s, idx) => idx === i ? { ...s, caption } : s) }));
  }
  function removeSlide(i: number) {
    setDraft(d => ({ ...d, slides: d.slides.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setBusy(true);
    try {
      await updateStory(draft.id, {
        title: draft.title, kind: draft.kind, cover_url: draft.cover_url,
        slides: draft.slides, cta_label: draft.cta_label, cta_href: draft.cta_href,
        permanent: draft.permanent, expires_at: draft.expires_at, published: draft.published,
      });
      onSaved(); onClose();
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function destroy() {
    if (!confirm('Удалить историю?')) return;
    setBusy(true);
    try { await deleteStory(draft.id); onSaved(); onClose(); }
    catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  // ephemeral helper: store hours; convert to expires_at on toggle
  function setEphemeralHours(hours: number) {
    const exp = new Date(Date.now() + hours * 3600_000).toISOString();
    setDraft(d => ({ ...d, permanent: false, expires_at: exp }));
  }

  return (
    <div className="ste" role="dialog" aria-modal="true">
      <div className="ste__backdrop" onClick={onClose} />
      <div className="ste__panel">
        <div className="ste__head">
          <h3>Редактирование истории</h3>
          <button type="button" className="ste__x" onClick={onClose}>×</button>
        </div>

        <div className="ste__body">
          <label className="ste__f"><span>Название</span>
            <input type="text" value={draft.title} onChange={e => set('title', e.target.value)} />
          </label>

          <div className="ste__grid2">
            <label className="ste__f"><span>Тип</span>
              <select value={draft.kind} onChange={e => set('kind', e.target.value as StoryKind)}>
                {KINDS.map(k => <option key={k} value={k}>{STORY_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="ste__f"><span>Кнопка (текст)</span>
              <input type="text" value={draft.cta_label} onChange={e => set('cta_label', e.target.value)} />
            </label>
          </div>

          <label className="ste__f"><span>Ссылка кнопки</span>
            <input type="text" value={draft.cta_href} onChange={e => set('cta_href', e.target.value)} placeholder="/#booking" />
          </label>

          {/* cover */}
          <div className="ste__f">
            <span>Обложка (кружок)</span>
            <div className="ste__cover-row">
              <div className="ste__cover">{draft.cover_url ? <img src={draft.cover_url} alt="" /> : '—'}</div>
              <label className="ste__upload">
                {busy ? '…' : 'Загрузить'}
                <input ref={coverRef} type="file" accept="image/*" hidden onChange={e => uploadCover(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          {/* slides */}
          <div className="ste__f">
            <span>Слайды ({draft.slides.length})</span>
            <div className="ste__slides">
              {draft.slides.map((sl, i) => (
                <div key={i} className="ste__slide">
                  <img src={sl.url} alt="" />
                  <input
                    type="text" placeholder="Подпись слайда" value={sl.caption ?? ''}
                    onChange={e => setSlideCaption(i, e.target.value)}
                  />
                  <button type="button" onClick={() => removeSlide(i)} aria-label="Удалить слайд">×</button>
                </div>
              ))}
              <label className="ste__upload ste__upload--block">
                {busy ? 'Загрузка…' : '＋ Добавить слайды'}
                <input ref={slideRef} type="file" accept="image/*" multiple hidden onChange={e => addSlides(e.target.files)} />
              </label>
            </div>
          </div>

          {/* lifetime */}
          <div className="ste__f">
            <span>Срок жизни</span>
            <div className="ste__life">
              <label className="ste__radio">
                <input type="radio" checked={draft.permanent} onChange={() => set('permanent', true)} />
                Постоянная
              </label>
              <label className="ste__radio">
                <input type="radio" checked={!draft.permanent} onChange={() => setEphemeralHours(24)} />
                Исчезает
              </label>
              {!draft.permanent && (
                <select
                  value=""
                  onChange={e => setEphemeralHours(Number(e.target.value))}
                >
                  <option value="" disabled>через…</option>
                  <option value="6">6 часов</option>
                  <option value="24">24 часа</option>
                  <option value="72">3 дня</option>
                  <option value="168">7 дней</option>
                </select>
              )}
            </div>
            {!draft.permanent && draft.expires_at && (
              <small className="ste__hint">Исчезнет: {new Date(draft.expires_at).toLocaleString('ru-RU')}</small>
            )}
          </div>

          <label className="ste__radio">
            <input type="checkbox" checked={draft.published} onChange={e => set('published', e.target.checked)} />
            Опубликовано (видно на сайте)
          </label>
        </div>

        <div className="ste__foot">
          <button type="button" className="ste__del" onClick={destroy} disabled={busy}>Удалить</button>
          <div className="ste__foot-r">
            <button type="button" className="ste__cancel" onClick={onClose} disabled={busy}>Отмена</button>
            <button type="button" className="ste__save" onClick={save} disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </div>
      </div>

      <style>{`
        .ste { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px; }
        .ste__backdrop { position: absolute; inset: 0; background: rgba(5,6,8,0.8); backdrop-filter: blur(4px); }
        .ste__panel {
          position: relative; z-index: 1; width: min(560px, 96vw); max-height: 90vh; display: flex; flex-direction: column;
          background: #0e1013; border: 1px solid var(--hairline-strong); border-radius: 16px; overflow: hidden;
        }
        .ste__head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--hairline); }
        .ste__head h3 { margin: 0; font-family: var(--font-display); font-size: 17px; }
        .ste__x { background: none; border: 0; color: var(--text); font-size: 24px; cursor: pointer; }
        .ste__body { padding: 16px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .ste__f { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text-muted); }
        .ste__f > input, .ste__f > select {
          padding: 9px 11px; border-radius: var(--r-sm); border: 1px solid var(--hairline);
          background: var(--bg-elev); color: var(--text); font-size: 14px;
        }
        .ste__grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ste__cover-row { display: flex; align-items: center; gap: 12px; }
        .ste__cover { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: #14171b; display: grid; place-items: center; color: var(--text-muted); }
        .ste__cover img { width: 100%; height: 100%; object-fit: cover; }
        .ste__upload {
          display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 9px 14px;
          border-radius: var(--r-sm); background: var(--bg-elev); color: var(--text); border: 1px solid var(--hairline); font-size: 13px;
        }
        .ste__upload--block { justify-content: center; }
        .ste__slides { display: flex; flex-direction: column; gap: 8px; }
        .ste__slide { display: flex; align-items: center; gap: 10px; }
        .ste__slide img { width: 44px; height: 44px; border-radius: var(--r-sm); object-fit: cover; flex: 0 0 auto; }
        .ste__slide input { flex: 1; padding: 8px 10px; border-radius: var(--r-sm); border: 1px solid var(--hairline); background: var(--bg-elev); color: var(--text); font-size: 13px; }
        .ste__slide button { background: none; border: 0; color: #ff8a8a; font-size: 20px; cursor: pointer; }
        .ste__life { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .ste__life select { padding: 7px 10px; border-radius: var(--r-sm); border: 1px solid var(--hairline); background: var(--bg-elev); color: var(--text); }
        .ste__radio { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); }
        .ste__hint { color: var(--text-muted); font-size: 12px; }
        .ste__foot { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-top: 1px solid var(--hairline); }
        .ste__foot-r { display: flex; gap: 10px; }
        .ste__del { background: none; border: 1px solid rgba(255,80,80,0.3); color: #ff8a8a; padding: 9px 14px; border-radius: var(--r-sm); cursor: pointer; }
        .ste__cancel { background: var(--bg-elev); border: 1px solid var(--hairline); color: var(--text); padding: 9px 16px; border-radius: var(--r-sm); cursor: pointer; }
        .ste__save { background: var(--chrome-gradient); border: 1px solid rgba(255,255,255,0.25); color: #0b0c0e; padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-weight: 600; }
        @media (max-width: 520px) { .ste__grid2 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
