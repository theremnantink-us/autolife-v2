/**
 * Stories — Instagram-style stories + company blog, Supabase-backed.
 *
 * Public site (anon key):
 *   - listStoriesPublic() → published, non-expired stories for the bar.
 *
 * Admin (authenticated):
 *   - listStoriesAll(), createStory(), updateStory(), deleteStory(),
 *     reorderStories(), uploadStoryImage().
 */
import { supabase, supabaseReady } from './supabase';

export type StoryKind = 'promo' | 'service' | 'news';

export interface StorySlide {
  url: string;
  caption?: string;
}

export interface StoryRow {
  id: string;
  title: string;
  kind: StoryKind;
  cover_url: string;
  slides: StorySlide[];
  cta_label: string;
  cta_href: string;
  permanent: boolean;
  expires_at: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
}

const BUCKET = 'stories';

export const STORY_KIND_LABEL: Record<StoryKind, string> = {
  promo:   'Акция',
  service: 'Новая услуга',
  news:    'Новости',
};

/** Public: published, non-expired stories ordered for the bar. */
export async function listStoriesPublic(): Promise<StoryRow[]> {
  if (!supabase || !supabaseReady) return [];
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.warn('[stories] listStoriesPublic', error); return []; }
  // Client-side guard for ephemeral expiry (RLS already filters, but be safe).
  const now = Date.now();
  return (data ?? []).filter((s: StoryRow) =>
    s.permanent || !s.expires_at || new Date(s.expires_at).getTime() > now) as StoryRow[];
}

/** Admin: every story. */
export async function listStoriesAll(): Promise<StoryRow[]> {
  if (!supabase || !supabaseReady) return [];
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.warn('[stories] listStoriesAll', error); return []; }
  return (data ?? []) as StoryRow[];
}

export interface StoryInput {
  title?: string;
  kind?: StoryKind;
  cover_url?: string;
  slides?: StorySlide[];
  cta_label?: string;
  cta_href?: string;
  permanent?: boolean;
  expires_at?: string | null;
  published?: boolean;
  sort_order?: number;
}

export async function createStory(input: StoryInput): Promise<string> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { data, error } = await supabase.from('stories').insert({
    title: input.title ?? '',
    kind: input.kind ?? 'promo',
    cover_url: input.cover_url ?? '',
    slides: input.slides ?? [],
    cta_label: input.cta_label ?? 'Записаться',
    cta_href: input.cta_href ?? '/#booking',
    permanent: input.permanent ?? true,
    expires_at: input.expires_at ?? null,
    published: input.published ?? true,
    sort_order: input.sort_order ?? 999,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateStory(id: string, patch: Partial<StoryRow>): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { error } = await supabase.from('stories').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteStory(id: string): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  const { error } = await supabase.from('stories').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderStories(ids: string[]): Promise<void> {
  if (!supabase || !supabaseReady) throw new Error('Supabase не настроен');
  await Promise.all(
    ids.map((id, i) =>
      supabase.from('stories').update({ sort_order: i + 1 }).eq('id', id)),
  );
}

/** Upload media to the stories bucket, return its public URL. */
export async function uploadStoryImage(file: File): Promise<string> {
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
