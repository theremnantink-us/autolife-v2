// site/src/lib/api.ts
import type { BookingPayload, BookingResponse, BusyDatesResponse } from './types';

export async function submitBooking(payload: BookingPayload): Promise<BookingResponse> {
  try {
    const res = await fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { success: false, message: 'Сеть недоступна. Попробуйте ещё раз.' };
  }
}

export async function fetchBusyDates(): Promise<string[]> {
  try {
    const res = await fetch('/busy_dates.php');
    if (!res.ok) return [];
    const data: BusyDatesResponse = await res.json();
    return Array.isArray(data.busy_dates) ? data.busy_dates : [];
  } catch {
    return [];
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health.php');
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}
