# AutoLife-v2 — Claude Code Guide

## Structure

```
autolife-v2/
├── site/                    # Astro + React frontend (npm run dev inside this dir)
│   ├── src/
│   │   ├── pages/           # index.astro, admin.astro, staff.astro, pricelist.astro
│   │   ├── components/
│   │   │   ├── islands/     # React hydrated components (client:only)
│   │   │   │   ├── admin/   # AdminApp, PayrollPanel, DeductionsPanel, AdminBookingCalendar…
│   │   │   │   ├── BookingForm.tsx   # Main booking form → POST /api.php
│   │   │   │   └── BookingCalendar.tsx
│   │   │   └── static/      # Astro-only components (Header, Footer, Employees…)
│   │   ├── data/            # employees.ts, cars.ts, services.ts, gallery.ts
│   │   ├── lib/
│   │   │   ├── admin/       # store.ts (localStorage), payout.ts, journal.ts, types.ts
│   │   │   ├── supabase.ts  # Supabase client (null when env missing)
│   │   │   └── api.ts       # fetch helpers for /api.php, /csrf.php, /busy_dates.php
│   │   └── content/         # reviews.ts
│   └── public/              # static assets (favicon, robots.txt, models…)
│
├── public_html/             # PHP backend (shared hosting)
│   ├── api.php              # POST /api.php — booking form endpoint
│   ├── csrf.php             # GET /csrf.php — CSRF token
│   ├── busy_dates.php       # GET /busy_dates.php — closed dates from admin calendar
│   ├── config.php           # env() helper, DB, constants
│   ├── lib/
│   │   ├── rate_limit.php
│   │   ├── csrf.php
│   │   └── security_headers.php
│   └── privacy-policy.html  # Static legal page
│
├── supabase/                # Supabase migrations (future)
└── docs/                    # Design specs, security notes
```

## Key Decisions

- **Admin auth**: Supabase Auth (email + password). `PUBLIC_SUPABASE_ANON_KEY` must be set in `site/.env`.
  When key is missing, `supabase` client is `null` and admin bypasses login (dev-only fallback).
- **Admin data**: localStorage via `site/src/lib/admin/store.ts`. Swap store bodies → Supabase when ready.
- **Staff/Employees page**: `/staff` redirects to `/` (see `staff.astro`). Employees section in `index.astro` is commented out.
- **Calendar availability**: `AdminBookingCalendar.tsx` writes to `localStorage['autolife:admin:availability']`.
  `busy_dates.php` on the PHP side should read from Supabase table `booking_availability`.
- **Salary calculator**: No hardcoded deduction defaults. `seedIfEmpty()` seeds empty deductions.
  If old localStorage has stale data (Ivan=5000, Bill=3000), `resetAll()` clears it.
- **Booking form**: CSRF token required from `/csrf.php`. In dev (no PHP backend), form submit button is disabled — expected behavior.
- **Revenue removed from admin**: `servicePrice` column not shown in Bookings table.

## Dev Commands

```bash
cd site && npm run dev          # Astro dev server on :4321
cd site && npm test             # vitest unit tests
cd site && npm run build        # production build
```

## Env Variables (site/.env)

```
PUBLIC_SUPABASE_URL=https://docggsuombfvoycqxrgi.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<from Supabase Dashboard → Settings → API>
PUBLIC_YANDEX_API_KEY=3b583c1c-bc60-4aad-b392-e3149593ef1e
PUBLIC_YANDEX_PLACE_ID=15713727058
```

## Security Checklist

- CSP, X-Frame-Options, HSTS on `/admin` (admin.astro)
- CSRF double-submit cookie on form (csrf.php)
- Honeypot field in BookingForm
- Rate limiting per IP in api.php (RATE_LIMIT_BOOKING_PER_HOUR)
- DDoS: Cloudflare recommended at CDN level; app-level rate limiting in php
- Supabase RLS must be enabled on all tables when data moves there

## Common Tasks

**Add new employee**: edit `site/src/data/employees.ts`
**Add new service**: edit `site/src/data/services.ts` + update BookingForm SERVICE_GROUPS
**Close dates for booking**: Admin panel → Календарь tab
**Pay salary**: Admin panel → Зарплаты → select employee → fill period → confirm
**Reset all admin data**: Admin panel → Сброс button (calls resetAll() + seedIfEmpty())
