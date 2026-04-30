// site/src/lib/types.ts
export interface BookingPayload {
  name: string;
  phone: string;
  carBrand: string;
  carModel: string;
  service: string;
  date: string;              // "YYYY-MM-DD HH:mm"
  additionalInfo: string;
  csrf_token: string;
}

export interface BookingResponse {
  success: boolean;
  message?: string;
  appointment_id?: number;
}

export interface BusyDatesResponse {
  success: boolean;
  busy_dates?: string[];
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  ts: string;
}
