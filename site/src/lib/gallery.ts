/**
 * Gallery — Supabase-backed, editable from the admin panel.
 *
 * Public site (anon key):
 *   - listGalleryPublic() → visible items, ordered, for the bento grid.
 *
 * Admin (authenticated):
 *   - listGalleryAll(), createGalleryItem(), updateGalleryItem(),
 *     deleteGalleryItem(), reorderGallery(), uploadGalleryImage().
 *
 * Falls back to the static `data/gallery.ts` list when Supabase is not
 * configured or the table is empty, so the site never renders blank.
 */
import { supabase, supabaseReady } from './supabase';
import { galleryItems as STATIC_ITEMS } from '../data/gallery';

export type GalleryCategory = 'washing' | 'detailing' | 'tires';

export interface GalleryRow {
  id: string;
  src: string;
  alt: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  tall: boolean;
  sort_order: number;
  visible: boolean;
  created_at: string;
}

const BUCKET = 'gallery';

/** Map the static fallback list into row-shaped objects (no real ids). */
function staticFallback(): GalleryRow[] {
  return STATIC_ITEMS.map((it, i) => ({
    id: `static-${i}`,
    src: it.src,
    alt: it.alt,
    title: it.title,
    caption: it.caption,
    category: it.category,
    tall: !!it.tall,
    sort_order: i + 1,
    visible: true,
    created_at: '',
  }));
}

/** Public: visible items for the site. Falls back to static data. */
export async function listGalleryPublic(): Promise<GalleryRow[]> {
  if (!supabase || !supabaseReady) return staticFallback();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('visible', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { console.warn('[gallery] listGalleryPublic', error); return staticFallback(); }
  if (!data || data.length === 0) return staticFallback();
  return data as GalleryRow[];
}

/** Admin: every item, including hidden ones. */
export async function listGalleryAll(): Promise<GalleryRow[]> {
  if (!supabase || !supabaseReady) return staticFallback();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) { console.warn('[gallery] listGalleryAll', error); return []; }
  return (data ?? []) as GalleryRow[];
}

export interface GalleryInput {
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  category?: GalleryCategory;
  tall?: boolean;
  sort_order?: number;
  visible?: boolean;
}

export async function createGalleryItem(input: GalleryInput): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { error } = await supabase.from('gallery_items').insert({
    src: input.src,
    alt: input.alt ?? '',
    title: input.title ?? '',
    caption: input.caption ?? '',
    category: input.category ?? 'detailing',
    tall: input.tall ?? false,
    sort_order: input.sort_order ?? 999,
    visible: input.visible ?? true,
  });
  if (error) throw error;
}

export async function updateGalleryItem(id: string, patch: Partial<GalleryRow>): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { error } = await supabase.from('gallery_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteGalleryItem(id: string, src?: string): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw error;
  // Best-effort: remove the uploaded file if it lived in our bucket.
  if (src) {
    const path = storagePathFromUrl(src);
    if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
  }
}

/** Persist a new ordering: array of ids in the desired order. */
export async function reorderGallery(ids: string[]): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  await Promise.all(
    ids.map((id, i) =>
      supabase.from('gallery_items').update({ sort_order: i + 1 }).eq('id', id)),
  );
}

/** Upload a file to the gallery bucket, return its public URL. */
export async function uploadGalleryImage(file: File): Promise<string> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Extract the in-bucket object path from a public URL (for deletion). */
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
