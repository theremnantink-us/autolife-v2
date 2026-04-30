# Redesign Phase 2 — Implementation Plan

**Branch:** `redesign-v2` (worktree: `.worktrees/redesign-v2`)
**Started:** 2026-04-25
**Owner:** Claude (driven by Bill)

## Inviolable Rules (carried from Phase 1 audit)

1. **Content is sacred.** All texts, prices, photos, alts, captions come **verbatim** from `public_html/index.php` and `public_html/pricelist.html`. No reordering between sections. No invented content.
2. **Mobile-first.** Base width 360 px, then up to 768/1024/1440. Treat as a PWA.
3. **All 110 pricelist positions** must appear in `/pricelist`. No truncation.
4. **18 service cards** stay grouped in 3 categories (Мойка / Детейлинг / Шиномонтаж) with sticky tabs.
5. Original logo `IMG/Лого.png` only.
6. Yandex API endpoint: `15713727058`, key from `.env`.

## Stack

- Astro 6 + React 19 islands
- `@react-three/fiber` + `drei` + postprocessing (Hero 3D)
- GSAP ScrollTrigger + Lenis (scroll cinema)
- `motion/react` (UI animations)
- DOMPurify (XSS hardening)
- Vanilla CSS + design tokens (no Tailwind)

## Palette (chrome / graphite)

```
--bg            #08090b
--bg-elev       #111316
--graphite      #1a1d22
--graphite-2    #262a30
--chrome-1      #e8eaed
--chrome-2      #9aa0a6
--chrome-3      #5f6368
--text          #f5f6f7
--text-muted    #8a9099
--accent        chrome gradient
```

## Page structure (`/`)

1. Header (sticky glass, 56px)
2. **Hero** — pin-scroll 3D AMG GT, water droplet shader, cinematic camera timeline tied to whole page scroll
3. **Услуги** — 3 sticky tabs, 18 cards (verbatim from `index.php`)
4. **Акции** — 4 cards: «Зима» −15%, «Лето» −10%, **highlight «Химчистка от 18 000 ₽»**, **highlight «Керамика от 30 000 ₽»**
5. **Как проходит запись** — 5-step timeline (replaces "Комфорт")
6. **Галерея** — masonry, 4 filters (Все/Мойка/Детейлинг/Шиномонтаж), 6 photos verbatim, lightbox
7. **Отзывы** — Yandex Search API → fallback iframe widget
8. **Прайс-тизер** — 5 categories teaser → CTA `/pricelist`
9. **Онлайн-запись** — full form with CSRF, optgroup of 14 services
10. **Контакты** — Yandex Maps Constructor (existing `um=constructor:ec84bb9bf...`)
11. Footer

## `/pricelist` page

All 5 categories, 110+ rows verbatim from `pricelist.html`. Mobile: sticky first column + class-of-vehicle switcher (Малый / Средний / Бизнес / Внедорожник / Крупногабарит) for the matrix tables; tire size matrix (R-13…R-23+) gets horizontal scroll.

## Implementation order (commits)

1. **Foundation** — design tokens, Base layout reset, security headers (CSP, X-Frame-Options, referrer-policy via `<meta>` + middleware), wipe/replace previous mis-aligned components.
2. **Header + Footer** — glass nav, logo, menu, mobile drawer.
3. **3D model** — compress GLB (Draco + Meshopt + KTX2), copy to `site/public/models/`, R3F scene scaffold.
4. **Hero scroll cinema** — pin section, ScrollTrigger timeline (rotation, dolly, focus), water droplet shader on hood, mobile fallback video.
5. **Services** — 3 sticky tab categories, 18 cards from content collection (re-seeded verbatim from `index.php`).
6. **Promotions** — 4 cards with two highlights (Химчистка / Керамика), CTA prefills booking form.
7. **Booking timeline** — 5-step animated timeline.
8. **Gallery** — masonry, filters, lightbox, framer scroll reveals.
9. **Reviews** — Yandex API fetch + parse + fallback iframe.
10. **Pricing teaser + Booking form + Contacts** — preserve form fields, CSRF, busy-dates, Flatpickr.
11. **`/pricelist`** — full 110-row page with mobile sticky col.
12. **Security pass** — CSP nonces, server-side rate-limit on `api.php`, honeypot, harden cookies, DOMPurify on any user-rendered content, `lib/csrf.php` review.

## Security baseline (running through every commit)

- **CSP** via Astro middleware: `default-src 'self'; img-src 'self' data: https:; script-src 'self' 'nonce-{n}' https://api-maps.yandex.ru; connect-src 'self' https://search-maps.yandex.ru; frame-src https://yandex.ru;`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- HSTS via webserver (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`)
- Cookies: `Secure; HttpOnly; SameSite=Strict`
- CSRF: keep & extend `public_html/lib/csrf.php` — token rotation on submit, expiry 30min, double-submit cookie.
- Rate limit `api.php`: 5 booking requests / IP / 10min via `lib/ratelimit.php` (token bucket, file-backed).
- Honeypot field `<input name="website" tabindex="-1" autocomplete="off">` hidden visually — submissions with non-empty value rejected.
- Input validation server-side: phone regex, name length, email format. Client validation cosmetic only.
- DOMPurify before any `set:html` or React `dangerouslySetInnerHTML`.
- 3D GLB: validate magic bytes server-side if ever uploadable; for now read-only static asset.
- No third-party trackers. Yandex Metrika optional with consent banner (Phase 5).
- DDoS: configure Timeweb/Cloudflare front (operator action) — document in `docs/ops-security.md`.

## Out of scope (Phase 3+)

- Admin panel + payroll
- Telegram bot
- Brand book in Figma
- Marketing collateral pack
- Yandex Metrika consent banner
