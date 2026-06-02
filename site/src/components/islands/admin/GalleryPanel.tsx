/**
 * GalleryPanel — admin CRUD for the public gallery (Supabase-backed).
 *
 * Upload photos, edit title/caption/category, reorder, hide/show, delete.
 * Changes are live on the site immediately (the public gallery reads the
 * same `gallery_items` table on each visit).
 */
import { useEffect, useRef, useState } from 'react';
import {
  listGalleryAll, createGalleryItem, updateGalleryItem,
  deleteGalleryItem, reorderGallery, uploadGalleryImage,
  type GalleryRow, type GalleryCategory,
} from '../../../lib/gallery';
import { supabaseReady } from '../../../lib/supabase';

const CATEGORIES: { id: GalleryCategory; label: string }[] = [
  { id: 'washing',   label: 'Мойка' },
  { id: 'detailing', label: 'Детейлинг' },
  { id: 'tires',     label: 'Шиномонтаж' },
];

export default function GalleryPanel() {
  const [items, setItems]     = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = () => {
    setLoading(true);
    listGalleryAll().then(setItems).finally(() => setLoading(false));
  };
  useEffect(reload, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setError(null);
    try {
      const base = items.length;
      let i = 0;
      for (const file of Array.from(files)) {
        const url = await uploadGalleryImage(file);
        await createGalleryItem({
          src: url,
          title: file.name.replace(/\.[^.]+$/, ''),
          category: 'detailing',
          sort_order: base + (++i),
        });
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function patch(id: string, p: Partial<GalleryRow>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...p } : it));
    try { await updateGalleryItem(id, p); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); reload(); }
  }

  async function remove(item: GalleryRow) {
    if (!confirm(`Удалить «${item.title || item.caption || 'фото'}»?`)) return;
    setBusy(true);
    try { await deleteGalleryItem(item.id, item.src); reload(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setItems(reordered);
    try { await reorderGallery(reordered.map(it => it.id)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); reload(); }
  }

  if (!supabaseReady) {
    return <div className="glp__empty">Supabase не настроен — галерея доступна только для чтения (статические фото).</div>;
  }

  return (
    <div className="glp">
      <div className="glp__bar">
        <div>
          <h2 className="glp__h">Галерея</h2>
          <p className="glp__sub">{items.length} фото · изменения видны на сайте сразу</p>
        </div>
        <label className={`glp__upload${busy ? ' is-busy' : ''}`}>
          {busy ? 'Загрузка…' : '＋ Добавить фото'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>
      </div>

      {error && <div className="glp__error">⚠️ {error}</div>}
      {loading ? (
        <div className="glp__empty">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="glp__empty">Пока нет фото. Нажмите «Добавить фото».</div>
      ) : (
        <div className="glp__grid">
          {items.map((it, i) => (
            <div key={it.id} className={`glp__card${it.visible ? '' : ' is-hidden'}`}>
              <div className="glp__thumb">
                <img src={it.src} alt={it.alt} loading="lazy" />
                <div className="glp__order">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Выше">↑</button>
                  <span>{i + 1}</span>
                  <button type="button" onClick={() => move(i, +1)} disabled={i === items.length - 1} title="Ниже">↓</button>
                </div>
              </div>

              <label className="glp__field">
                <span>Заголовок</span>
                <input
                  type="text"
                  value={it.title}
                  onChange={(e) => setItems(prev => prev.map(x => x.id === it.id ? { ...x, title: e.target.value } : x))}
                  onBlur={(e) => patch(it.id, { title: e.target.value })}
                />
              </label>
              <label className="glp__field">
                <span>Подпись</span>
                <input
                  type="text"
                  value={it.caption}
                  onChange={(e) => setItems(prev => prev.map(x => x.id === it.id ? { ...x, caption: e.target.value } : x))}
                  onBlur={(e) => patch(it.id, { caption: e.target.value })}
                />
              </label>

              <div className="glp__row">
                <select
                  value={it.category}
                  onChange={(e) => patch(it.id, { category: e.target.value as GalleryCategory })}
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <label className="glp__check" title="Высокая плитка (2 ряда)">
                  <input type="checkbox" checked={it.tall} onChange={(e) => patch(it.id, { tall: e.target.checked })} />
                  Высокая
                </label>
              </div>

              <div className="glp__actions">
                <button
                  type="button"
                  className="glp__btn"
                  onClick={() => patch(it.id, { visible: !it.visible })}
                >{it.visible ? '👁 Видно' : '🚫 Скрыто'}</button>
                <button type="button" className="glp__btn glp__btn--danger" onClick={() => remove(it)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .glp { display: flex; flex-direction: column; gap: 16px; }
        .glp__bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .glp__h { font-family: var(--font-display); font-size: 20px; margin: 0; }
        .glp__sub { color: var(--text-muted); font-size: 13px; margin: 4px 0 0; }
        .glp__upload {
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
          padding: 11px 18px; border-radius: var(--r-sm); font-weight: 600; font-size: 14px;
          background: var(--chrome-gradient); color: #0b0c0e; border: 1px solid rgba(255,255,255,0.25);
          white-space: nowrap;
        }
        .glp__upload.is-busy { opacity: 0.6; pointer-events: none; }
        .glp__error { color: #ff8a8a; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.25);
          padding: 10px 14px; border-radius: var(--r-sm); font-size: 13px; }
        .glp__empty { color: var(--text-muted); padding: 40px 0; text-align: center; }

        .glp__grid {
          display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .glp__card {
          display: flex; flex-direction: column; gap: 10px; padding: 12px;
          border-radius: var(--r-md); background: var(--glass-bg);
          border: 1px solid var(--hairline);
        }
        .glp__card.is-hidden { opacity: 0.55; }
        .glp__thumb { position: relative; aspect-ratio: 4/3; border-radius: var(--r-sm); overflow: hidden; background: #0e1013; }
        .glp__thumb img { width: 100%; height: 100%; object-fit: cover; }
        .glp__order {
          position: absolute; top: 8px; right: 8px; display: flex; align-items: center; gap: 4px;
          background: rgba(8,9,11,0.7); border: 1px solid var(--hairline-strong); border-radius: 999px; padding: 3px 6px;
        }
        .glp__order button {
          width: 24px; height: 24px; border-radius: 50%; border: 0; cursor: pointer;
          background: rgba(255,255,255,0.1); color: var(--chrome-1); font-size: 13px;
        }
        .glp__order button:disabled { opacity: 0.3; cursor: default; }
        .glp__order span { font-size: 12px; color: var(--text-muted); min-width: 16px; text-align: center; }

        .glp__field { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-muted); }
        .glp__field input {
          padding: 7px 10px; border-radius: var(--r-sm); border: 1px solid var(--hairline);
          background: var(--bg-elev); color: var(--text); font-size: 14px;
        }
        .glp__row { display: flex; gap: 10px; align-items: center; }
        .glp__row select {
          flex: 1; padding: 7px 10px; border-radius: var(--r-sm); border: 1px solid var(--hairline);
          background: var(--bg-elev); color: var(--text); font-size: 13px;
        }
        .glp__check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
        .glp__actions { display: flex; gap: 8px; margin-top: 2px; }
        .glp__btn {
          flex: 1; padding: 8px; border-radius: var(--r-sm); cursor: pointer; font-size: 13px;
          background: var(--bg-elev); color: var(--text); border: 1px solid var(--hairline);
        }
        .glp__btn:hover { border-color: var(--hairline-strong); }
        .glp__btn--danger { color: #ff8a8a; }
      `}</style>
    </div>
  );
}
