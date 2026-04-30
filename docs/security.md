# Security posture — AutoLife redesign Phase 2

Status as of 2026-04-25 (branch `redesign-v2`).

## Threat model

Public-facing brochure site with a single state-changing endpoint
(`POST /api.php`). Primary risks:

| Risk | Mitigation |
|---|---|
| **XSS** (stored / reflected) | All user input length-clipped + `< >` stripped client-side; React renders via text nodes (no `dangerouslySetInnerHTML`); Astro `set:html` only on JSON-LD we generate ourselves; CSP forbids inline `eval`. |
| **CSRF** | Per-session token via `lib/csrf.php`, `hash_equals` constant-time compare, rotated on every successful POST. |
| **DDoS / abuse** | Per-IP per-endpoint rate limit via `lib/rate_limit.php` (MySQL-backed). Apache `mod_evasive` + Cloudflare/Timeweb edge expected to handle volumetric layer. |
| **Spam / bot signups** | Honeypot field (`name="website"`, off-screen) + 1.5 s mount-to-submit guard + server-side phone digit count + dump to `error_log` on hit. |
| **Clickjacking** | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` everywhere. |
| **Mixed content / SSL strip** | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Force-HTTPS rewrite in `.htaccess`. |
| **Session fixation** | Session ID regenerated every 30 min; cookie is `HttpOnly; Secure; SameSite=Strict`. |
| **Replay** | CSRF token rotated server-side after every booking; client adopts new token from response. |
| **Spectre / cross-origin leaks** | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-site`. |
| **Server fingerprint leak** | `X-Powered-By` and `Server` headers stripped via `mod_headers`. |
| **DB error exposure** | `api.php` swaps PDOException / SQLSTATE messages for "Не удалось обработать запрос" before responding. |
| **Path traversal** | Astro static export — no dynamic file resolution from user input. PHP endpoints use absolute paths via `__DIR__`. |
| **SQL injection** | Every query uses prepared statements with parameter binding. PDO `ATTR_EMULATE_PREPARES = false`. |
| **Open redirect** | None — `form-action 'self'` and no redirect param accepted. |

## Endpoints

| Path | Method | Rate limit | CSRF | Notes |
|---|---|---|---|---|
| `/api.php` | POST | 5 / 1 hr (env: `RATE_LIMIT_BOOKING_PER_HOUR`) | ✓ | Booking. Honeypot. Phone normalize. Date >= now. CSRF rotated. Telegram notify wrapped in try-catch (notify failure ≠ booking failure). |
| `/csrf.php` | GET | none | n/a | Returns fresh token. Cache-Control: no-store. |
| `/busy_dates.php` | GET | 60 / 5 min | n/a | Returns `[]` on DB outage so calendar still functions. |
| `/track_visit.php` | POST | 60 / 5 min | n/a | UA + Referer length-clipped. 204 on success. Best-effort logger. |
| `/health.php` | GET | none | n/a | Liveness check. |

## CSP (production, set via `.htaccess`)

```
default-src 'self';
img-src 'self' data: blob: https:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' data: https://fonts.gstatic.com;
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'
           https://api-maps.yandex.ru
           https://yastatic.net
           https://www.gstatic.com;
worker-src 'self' blob:;
connect-src 'self'
            https://api.telegram.org
            https://search-maps.yandex.ru
            https://yandex.ru
            https://www.gstatic.com;
frame-src 'self' https://yandex.ru https://api-maps.yandex.ru;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

Notes:
- `'unsafe-eval'` removed in this phase (Spline runtime gone).
- `'wasm-unsafe-eval'` retained for drei's Draco decoder on `/models/amg-gt.glb`.
- `'unsafe-inline'` (style) is currently required for Astro's component-scoped CSS. Future hardening: nonce-based CSP via SSR layer (Phase 3).
- Astro statically rendered pages also include a meta-equiv CSP for defense-in-depth.

## Session cookie

```
Name:     AL_SESS
Path:     /
Secure:   true (when HTTPS)
HttpOnly: true
SameSite: Strict
Lifetime: session
```

## Operational runbook

- **Add a new domain** for Yandex / external service: extend CSP `connect-src` and `frame-src` accordingly in **both** `.htaccess` *and* `site/src/layouts/Base.astro` meta-CSP.
- **Rotate Telegram bot token**: edit `public_html/.env`, then `kill -USR1` PHP-FPM (or restart) to drop opcache + .env cache.
- **Daily cleanup** of rate-limit table: `DELETE FROM rate_limits WHERE ts < DATE_SUB(NOW(), INTERVAL 1 DAY);` — schedule via cron.
- **Force-rotate all sessions**: drop the `AL_SESS` cookie domain in `php.ini` `session.save_path` or change `session_name()`.
- **Telegram failure ≠ booking failure**: `error_log` entries with `Telegram notification failed:` are recoverable; appointment is already in DB.

## Known gaps (queued for Phase 3+)

- Captcha for booking (currently honeypot only — fine until bots target us).
- Audit log for admin actions (admin panel itself not yet built).
- Server-rendered nonce-based CSP (need SSR or middleware hook).
- Subresource integrity (SRI) on Yandex CDN scripts — pinned versions not exposed by Yandex.
- WAF rules at the Timeweb / Cloudflare layer (operator action).
