/**
 * Bookings + availability — Supabase-backed.
 *
 * Public site uses anon key:
 *   - submitBooking()  → INSERT into bookings + fire-and-forget notify
 *   - listBlockedDates() → SELECT closed dates for the calendar
 *
 * Admin (authenticated) uses the same client:
 *   - listBookings(), updateBooking(), deleteBooking()
 *   - upsertBlockedDate(), deleteBlockedDate()
 *   - subscribeNewBookings() → realtime stream of inserts
 */
import { supabase, supabaseReady } from './supabase';

export interface BookingInput {
  name: string;
  phone: string;
  car_brand: string;
  car_model: string;
  service: string;
  master_id: string | null;
  slot_start: string;          // ISO datetime
  additional_info?: string;
}

export interface BookingRow {
  id: string;
  name: string | null;
  phone: string | null;
  car_brand: string | null;
  car_model: string | null;
  service: string | null;
  master_id: string | null;
  slot_start: string | null;
  status: 'new' | 'confirmed' | 'done' | 'cancelled';
  additional_info: string | null;
  notes: string | null;
  service_price: number | null;
  created_at: string;
  // Legacy fields kept for back-compat (tattoo schema)
  date: string | null;
  time_slot: string | null;
}

export interface BlockedDateRow {
  id: string;
  date: string;                 // YYYY-MM-DD
  blocked_slots: string[] | null;  // null/empty = whole day blocked
  notes: string | null;
}

const NOT_READY = new Error('Supabase не настроен');

/** Submit a new booking from the public site. */
export async function submitBooking(input: BookingInput): Promise<BookingRow> {
  if (!supabase || !supabaseReady) throw NOT_READY;

  // Derive legacy date/time_slot for compat with any existing reads
  const slotDate = input.slot_start.slice(0, 10);
  const slotTime = input.slot_start.slice(11, 16);

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      name:            input.name,
      phone:           input.phone,
      car_brand:       input.car_brand,
      car_model:       input.car_model,
      service:         input.service,
      master_id:       input.master_id,
      slot_start:      input.slot_start,
      additional_info: input.additional_info ?? null,
      date:            slotDate,
      time_slot:       slotTime,
      status:          'new',
    })
    .select()
    .single();

  if (error) throw error;

  // Fire-and-forget notification (Telegram + email). Don't block the
  // user on it — the booking is already saved.
  void fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/notify-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(data),
  }).catch(() => { /* notification failures don't break booking */ });

  return data as BookingRow;
}

/** Read blocked dates. Public: anon key allowed. */
export async function listBlockedDates(): Promise<BlockedDateRow[]> {
  if (!supabase || !supabaseReady) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true });
  if (error) { console.warn('[bookings] listBlockedDates', error); return []; }
  return (data ?? []) as BlockedDateRow[];
}

/** Whole-day blocked dates as YYYY-MM-DD strings — for the booking form. */
export async function listClosedDays(): Promise<string[]> {
  const rows = await listBlockedDates();
  return rows
    .filter(r => !r.blocked_slots || r.blocked_slots.length === 0)
    .map(r => r.date);
}

/* ── Admin operations (require authenticated session) ────────────── */

export async function listBookings(): Promise<BookingRow[]> {
  if (!supabase || !supabaseReady) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.warn('[bookings] listBookings', error); return []; }
  return (data ?? []) as BookingRow[];
}

export async function updateBooking(id: string, patch: Partial<BookingRow>): Promise<void> {
  if (!supabase || !supabaseReady) throw NOT_READY;
  const { error } = await supabase.from('bookings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteBooking(id: string): Promise<void> {
  if (!supabase || !supabaseReady) throw NOT_READY;
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertBlockedDate(row: { date: string; blocked_slots?: string[] | null; notes?: string | null }): Promise<void> {
  if (!supabase || !supabaseReady) throw NOT_READY;
  const { error } = await supabase
    .from('blocked_dates')
    .upsert({ date: row.date, blocked_slots: row.blocked_slots ?? null, notes: row.notes ?? null }, { onConflict: 'date' });
  if (error) throw error;
}

export async function deleteBlockedDate(date: string): Promise<void> {
  if (!supabase || !supabaseReady) throw NOT_READY;
  const { error } = await supabase.from('blocked_dates').delete().eq('date', date);
  if (error) throw error;
}

/** Realtime: callback fires for every new booking inserted. */
export function subscribeNewBookings(onInsert: (row: BookingRow) => void): () => void {
  if (!supabase || !supabaseReady) return () => {};
  const channel = supabase
    .channel('bookings-new')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
      onInsert(payload.new as BookingRow);
    })
    .subscribe();
  return () => { supabase?.removeChannel(channel); };
}
