# Spec: Redesign (Phase 2) — AutoLife Detail

**Дата:** 2026-04-24
**Автор:** Claude (brainstorming → writing-plans)
**Ветка:** `phase-2/redesign`
**Домен:** `autolife-detail.ru`
**Область:** Phase 2 из 8. Визуальный + архитектурный рерайт фронтенда поверх brand-токенов Phase 1 и PHP-бекенда Phase 0.

---

## Context

Текущий сайт — один `index.html` (65 КБ + 1701 строка CSS на burgundy-тёме) с встроенным vanilla-JS. Фаза 1 зафиксировала новый бренд: chrome-on-black, Michroma + Chakra Petch, «Точность. Материалы. Результат.», позиционирование без классовых qualifier'ов. Фаза 0 закрыла критичные дыры безопасности на PHP-бэкенде.

Phase 2 переписывает фронтенд с нуля с новым IA (гибрид one-pager + service-detail routes), Spline-hero, motion-анимациями и mobile-first-подходом. PHP-бэкенд (api.php, busy_dates.php, health.php, telegram_notifications.php, lib/*) остаётся без изменений и продолжает работать как BFF.

---

## Goals

1. Визуал совпадает с brand system Phase 1 (chrome/black, Michroma wordmark, Chakra Petch body, гибкие токены в CSS custom properties).
2. Новая IA: гибрид главной-one-pager + страниц услуг `/services/[slug]` (9 услуг = 9 SEO-страниц).
3. Spline-scene в hero на desktop, static/video fallback на mobile (<768px).
4. Mobile-first дизайн, Core Web Vitals зелёные на 4G (LCP <2.5s, INP <200ms, CLS <0.1).
5. Сохранение функциональности: online-запись, занятые даты, Telegram-уведомления, Яндекс.Карты.
6. Build-deploy: Astro `dist/` выкладывается на Timeweb рядом с PHP-файлами в `public_html/`, PHP endpoints работают без изменений.

## Non-goals (explicitly out of Phase 2)

- ЛК клиента (Phase 4)
- Регистрация / auth / Supabase (Phase 4)
- Админ-панель (Phase 5)
- Nano Banana генерация фото услуг (Phase 3) — используются placeholder-изображения из существующего IMG/
- Figma-баннеры для акций (Phase 6)
- Yandex.Метрика, Yandex.Бизнес, schema.org полная разметка (Phase 7)
- Программа лояльности (Phase 8)

---

## Architecture

### Tech stack

| Слой | Выбор | Причина |
|---|---|---|
| Framework | **Astro 4+** | Static-first HTML output (SEO/LCP), селективная гидратация «островов», можно рендерить в `.astro` компонентах или React. |
| Island framework | **React 18** | Spline имеет first-class @splinetool/react-spline, motion/framer-motion для React смотрит лучше, flatpickr-react готов. Один framework для всех islands. |
| Animations | **motion** (установлен в Phase 2 infra-коммите) | Для scroll-based анимаций, stagger, fade-in. |
| 3D | **@splinetool/react-spline** (Spline runtime) | Designer-friendly, embed готовой сцены. |
| Styling | **CSS Modules + design tokens** (brand система Phase 1 в `:root`) | Без лишних runtime CSS-in-JS библиотек. |
| Forms | **React Hook Form** + **Zod** валидация, flatpickr | Типобезопасная валидация, совместимая с CSRF-моделью. |
| Backend | **PHP (unchanged)** | Phase 0 hot-fix остаётся. fetch из islands в `/api.php`, `/busy_dates.php`, `/health.php`. |
| Build | **Astro build → `public_html/dist/`** | Деплоится на Timeweb SFTP рядом с PHP. |
| Dev server | `npm run dev` (Astro + Vite HMR) + параллельно PHP built-in (:8080) или MAMP для API | Frontend hot-reload + живой API. |

### Directory structure (target)

```
autolife.ru/
├── site/                                  ← новый Astro-проект
│   ├── astro.config.mjs                   ← integrations: @astrojs/react, @astrojs/sitemap
│   ├── package.json                       ← отдельный от корневого (Astro + deps)
│   ├── tsconfig.json
│   ├── public/
│   │   ├── IMG/                           ← copy/symlink существующих картинок
│   │   ├── icons/
│   │   ├── fonts/                         ← self-hosted Chakra Petch + Michroma (если решим self-host)
│   │   └── video/hero-mobile.mp4         ← mobile Spline fallback
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro                ← главная (9 секций)
│   │   │   ├── services/
│   │   │   │   └── [slug].astro           ← динамическая /services/[slug]
│   │   │   ├── pricing.astro              ← полный прайс
│   │   │   ├── about.astro                ← о компании
│   │   │   └── contacts.astro             ← контакты (или merge в /)
│   │   ├── components/
│   │   │   ├── static/                    ← .astro-компоненты
│   │   │   │   ├── Header.astro
│   │   │   │   ├── Footer.astro
│   │   │   │   ├── ValueProp.astro
│   │   │   │   ├── Process.astro
│   │   │   │   ├── Pricing.astro
│   │   │   │   ├── Contacts.astro
│   │   │   │   └── service-template/
│   │   │   │       ├── ServiceHero.astro
│   │   │   │       ├── WhatIncluded.astro
│   │   │   │       ├── Materials.astro
│   │   │   │       ├── Cases.astro
│   │   │   │       ├── ServicePricing.astro
│   │   │   │       └── FAQ.astro
│   │   │   └── islands/                   ← React-компоненты
│   │   │       ├── SplineHero.tsx         ← hydrate client:visible
│   │   │       ├── BookingForm.tsx        ← hydrate client:load
│   │   │       ├── ServiceBookingCTA.tsx  ← hydrate client:visible
│   │   │       ├── Gallery.tsx            ← hydrate client:visible
│   │   │       ├── YandexReviews.tsx      ← hydrate client:visible
│   │   │       └── ServicesGrid.tsx       ← hydrate client:visible (motion)
│   │   ├── styles/
│   │   │   ├── tokens.css                 ← brand tokens из Phase 1 spec
│   │   │   ├── reset.css
│   │   │   └── global.css
│   │   ├── lib/
│   │   │   ├── api.ts                     ← fetch wrappers для /api.php, /busy_dates.php, /health.php
│   │   │   ├── services.ts                ← service catalog (id, slug, name, price_from, duration, description)
│   │   │   └── csrf.ts                    ← получение CSRF token через GET /csrf.php или meta-тег
│   │   └── content/
│   │       ├── services/                  ← MD/MDX content collection
│   │       │   ├── ceramic.md
│   │       │   ├── polishing.md
│   │       │   ├── leather-cleaning.md
│   │       │   └── ... (9 услуг)
│   │       └── reviews.ts                 ← backup-отзывы если Yandex API не отвечает
│   └── dist/                              ← output Astro build (deployment)
├── public_html/                           ← PHP backend остаётся
│   ├── api.php, health.php, busy_dates.php, lib/...
│   ├── .env, .htaccess, config.php
│   ├── csrf.php                           ← NEW: GET-endpoint для fetch CSRF token
│   └── ... (deploy: `dist/` из site/ копируется СЮДА)
└── docs/superpowers/specs/
```

**Ключевое архитектурное решение:** `site/` живёт отдельно от `public_html/`, в своём npm-workspace. Build копирует `site/dist/` в `public_html/dist/` (либо через `.gitignore` + SFTP deploy, либо через rsync-скрипт). `.htaccess` rewrite направляет все не-`.php` запросы в `dist/`.

### .htaccess extension

```apache
# After existing Phase 0 directives:

# Serve Astro build from /dist/
RewriteCond %{REQUEST_URI} !^/dist/
RewriteCond %{REQUEST_URI} !\.(php|env|htaccess)$
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /dist/$1 [L]

# Default document for / → dist/index.html
DirectoryIndex dist/index.html index.php

# api.php and friends continue to be served directly (no rewrite)
```

### Data flow: booking form

1. Page loads → `public_html/dist/index.html` (Astro-generated).
2. Island `<BookingForm client:load>` mounts React app.
3. Form mount fetches `/csrf.php` → `{csrf_token: "abc123"}`.
4. User fills form, submits → `fetch('/api.php', {body: JSON.stringify({...form, csrf_token})})`.
5. PHP validates CSRF, rate-limits, inserts into MySQL, sends Telegram.
6. Response → React shows success modal.

### Data flow: busy dates (flatpickr)

1. BookingForm mount fetches `/busy_dates.php` → `{success, busy_dates: [...]}`.
2. Flatpickr disables those dates.

### Data flow: Spline hero

1. Desktop (≥768px): `<SplineHero client:visible>` hydrates on viewport intersection. Loads `@splinetool/runtime` lazily, fetches scene from `scene.spline.design/...`.
2. Mobile (<768px): CSS media query swaps to `<video autoplay muted loop>` or static `<picture>` — Spline never loads.
3. Intersection Observer ensures Spline doesn't initialize until hero is ~50% in view (saves bandwidth for users who don't scroll far).

### Data flow: Yandex reviews

1. Server-side (Astro prerender): `YandexReviews.tsx` fetches отзывы через Yandex Places API (требует API-key в `.env`: `YANDEX_API_KEY`).
2. Если API недоступен / ключа нет → fallback на backup-отзывы из `content/reviews.ts` (3-6 вручную).
3. **Phase 7 dependency:** Yandex API требует зарегистрированный Yandex.Бизнес-аккаунт. Если ещё не зарегистрирован на момент реализации Phase 2 — используется iframe-виджет Yandex.Maps встроенный через Yandex-constructor как промежуточное решение.

---

## Information Architecture

### `/` — главная (one-pager, 9 секций)

| # | Секция | Тип | Компонент | Заметки |
|---|---|---|---|---|
| 01 | Hero | island + static | `SplineHero` + `HeroContent` | Spline desktop / video mobile, wordmark Michroma+stroke, CTA |
| 02 | Почему AutoLife | static | `ValueProp.astro` | 3-4 differentiator-карточки, motion fade-in |
| 03 | Услуги (3 категории) | island | `ServicesGrid.tsx` | Мойка / Детейлинг / Шиномонтаж, каждая — бенто-грид 6 услуг, клик → `/services/[slug]` |
| 04 | Процесс | static | `Process.astro` | 4 шага с иконками, horizontal timeline, motion stagger |
| 05 | Галерея работ | island | `Gallery.tsx` | Masonry + lightbox, 8-12 кейсов, filter by category. **Placeholder до Phase 3.** |
| 06 | Отзывы | island | `YandexReviews.tsx` | Yandex Places API или fallback |
| 07 | Ценовые диапазоны | static | `Pricing.astro` | 3-4 price band'а, CTA «Полный прайс» → `/pricing` |
| 08 | Форма записи | island | `BookingForm.tsx` | React Hook Form + Zod + flatpickr + CSRF + POST api.php |
| 09 | Контакты | static | `Contacts.astro` | Адрес, телефон, график, Яндекс.Карты iframe, соцсети, footer |

### `/services/[slug]` — страница услуги (шаблон, 7 блоков)

Применяется к 9 услугам (полный список в `site/src/content/services/`): керамическое покрытие, полировка кузова, химчистка кожи, химчистка салона, полировка фар, восстановление хрома, антидождь, шиномонтаж, детейлинг-мойка.

| # | Блок | Компонент | Источник данных |
|---|---|---|---|
| S1 | Hero услуги | `ServiceHero.astro` | MD frontmatter |
| S2 | Что входит | `WhatIncluded.astro` | MD content (чек-лист) |
| S3 | Материалы | `Materials.astro` | logos[] из MD + `public/brands/` |
| S4 | Кейсы | `Cases.astro` | Filter из общей галереи по service-tag |
| S5 | Цена и длительность | `ServicePricing.astro` | MD frontmatter (price_from, duration, warranty) |
| S6 | FAQ | `FAQ.astro` | MD content + schema.org разметка |
| S7 | CTA с формой | `ServiceBookingCTA.tsx` | React island, pre-fills service-select, submit api.php |

### Service MD frontmatter

```md
---
slug: ceramic
name: Керамическое покрытие
category: Детейлинг
price_from: 30000
duration_hours: 8
warranty_months: 12
materials: [koch-chemie, gyeon, 3m]
hero_image: /IMG/ceramic-hero.webp
cases: [case-maybach-s680, case-911-turbo]
---
```

### Static pages

- `/pricing` — полный прайс всех услуг, фильтр/поиск, CTA к форме записи
- `/about` — AutoLife Detail история, локация, ценности (соответствует ToV Phase 1)
- `/contacts` — дублирует секцию главной или редирект к `/#contacts` (решим на implementation-этапе)

---

## Design tokens (from Phase 1)

Все значения импортируются в `site/src/styles/tokens.css`:

```css
:root {
  /* Surfaces */
  --bg: #0a0a0a;
  --bg-surface: #141414;
  --bg-elevated: #1c1c1c;
  --border: #222222;
  --border-ring: rgba(255,255,255,0.12);

  /* Chrome / silver */
  --chrome-gradient: linear-gradient(180deg, #f5f5f5 0%, #8a8a8a 50%, #4a4a4a 100%);
  --silver: #d8d8d8;

  /* Text */
  --text: #f0f0f0;
  --text-muted: #888888;
  --text-subtle: #5a5a5a;

  /* Functional (minimal) */
  --success: #9ca77c;
  --error: #b54747;
  --warning: #c9a961;

  /* Type */
  --font-wordmark: 'Michroma', sans-serif;
  --font-body: 'Chakra Petch', sans-serif;
  --tracking-wordmark: 0.12em;
  --stroke-wordmark: 0.7px;

  /* Motion */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 180ms;
  --duration-default: 320ms;
  --duration-slow: 680ms;

  /* Layout */
  --container-max: 1280px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 32px;
  --space-xl: 64px;
  --space-2xl: 120px;
}
```

Wordmark-helper:
```css
.wordmark {
  font-family: var(--font-wordmark);
  letter-spacing: var(--tracking-wordmark);
  -webkit-text-stroke: var(--stroke-wordmark) currentColor;
  paint-order: stroke fill;
  background: var(--chrome-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Mobile strategy

**Mobile-first.** Breakpoints:

| Alias | min-width | Цель |
|---|---|---|
| sm | 640px | large phones |
| md | 768px | tablet portrait — **точка перехода на Spline** |
| lg | 1024px | tablet landscape / small desktop |
| xl | 1280px | desktop |
| 2xl | 1536px | large desktop |

**Spline fallback strategy:**

```astro
<!-- index.astro hero -->
<div class="hero-visual">
  <video class="hero-visual-mobile" autoplay muted loop playsinline poster="/IMG/hero-poster.webp">
    <source src="/video/hero-mobile.mp4" type="video/mp4">
  </video>
  <SplineHero client:visible sceneUrl="..." client:media="(min-width: 768px)" />
</div>
```

`client:media` directive ensures React hydration + Spline runtime only load when matching media query fires. На mobile они вообще не попадают в bundle-execution.

**Images:**

- Все картинки услуг через `<Image>` компонент Astro (auto webp/avif, responsive srcset)
- LCP hero image preload'ится: `<link rel="preload" as="image" href="..." media="(max-width: 767px)">`

---

## Build + deploy

### Dev

```
cd site/
npm install
npm run dev                    # Astro :4321 (Vite HMR)
# Отдельно, для живого backend:
cd ..
php -S localhost:8080 -t public_html   # или MAMP
```

В `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://autolife-detail.ru',
  integrations: [react(), sitemap()],
  build: {
    format: 'directory',
  },
  vite: {
    server: {
      proxy: {
        // Dev-прокси к PHP-бекенду
        '/api.php':          'http://localhost:8080',
        '/busy_dates.php':   'http://localhost:8080',
        '/health.php':       'http://localhost:8080',
        '/csrf.php':         'http://localhost:8080',
      },
    },
  },
});
```

### Build

```
cd site/
npm run build                  # output → site/dist/
```

### Deploy (Timeweb SFTP)

Опция A (ручной): `rsync -avz site/dist/ user@autolife-detail.ru:public_html/dist/` + убедиться что `.htaccess` направляет в `dist/`.

Опция B (локальный deploy-скрипт): `scripts/deploy.sh` собирает и заливает.

Опция C (в будущем): GitHub Actions на push в main → rsync. Пока opt-out — Phase 2 deploy вручную заказчиком.

---

## Integration with PHP backend

### Новые endpoints (добавить в public_html/)

- `public_html/csrf.php` — **NEW**. GET endpoint, возвращает `{csrf_token: "..."}`. React islands его дёргают при mount.

```php
<?php
require_once __DIR__ . '/lib/csrf.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode(['csrf_token' => csrf_generate()]);
```

### Изменения в существующих endpoints

Минимальные. `api.php` и `busy_dates.php` продолжают работать как есть — просто теперь дёргаются из React, а не из inline JS.

### CORS

Если Astro dev сервер (`:4321`) и PHP (`:8080`) — разные origins в dev-режиме, `config.php` default `CORS_ORIGIN` в `.env.example` remains `https://autolife-detail.ru` for prod. В dev-режиме Vite-proxy снимает CORS-проблему (запросы идут с того же origin).

Для production: `CORS_ORIGIN=https://autolife-detail.ru`, запросы идут с того же origin — CORS не нужен вообще, но заголовок остаётся для безопасности.

---

## Success criteria

- Lighthouse Mobile: Performance ≥85, Accessibility ≥95, SEO = 100.
- LCP <2.5s на slow-4G simulation (Lighthouse throttling).
- Первые 9 services имеют свою `/services/[slug]` страницу с meta-title + description.
- Sitemap автогенерируется и пингуется Yandex.Вебмастеру.
- Все существующие interactions (запись, занятые даты, Telegram) работают как в pre-redesign версии.
- Mobile Spline fallback: на `<768px` Spline не загружается (проверяется в devtools Network — нет запросов к spline.design).
- CSRF токен обязателен на всех POST-формах.
- brand tokens Phase 1 применены во всех компонентах (0 hardcoded цветов кроме `:root`).

---

## Risks + mitigations

| Риск | Митигация |
|---|---|
| Spline scene-файл 3-5 МБ, медленный LCP даже на desktop | Lazy-load через `client:visible`, preload только poster-image, scene-URL с CDN-кешем |
| Yandex API недоступен в первый deploy (Phase 7 dependency) | Fallback к `content/reviews.ts` (6 вручную отзывов) или iframe-виджету |
| `.htaccess` rewrite в `dist/` ломает Phase 0 `.htaccess` | Протестировать rewrite на staging, совместить с Phase 0 директивами последовательно |
| Деплой конфликтует с PHP-файлами | `site/dist/` в `public_html/dist/`, PHP-файлы в `public_html/*.php`, rewrite разделяет |
| CSP блокирует Spline + Yandex scripts | Дополнить CSP из Phase 0: `script-src ... https://unpkg.com https://prod.spline.design; connect-src ... https://api-maps.yandex.ru https://search-maps.yandex.ru` |
| Astro node_modules > 100 МБ замедлит git | `site/node_modules` в `.gitignore` уже (глобально), только `package.json` + `package-lock.json` коммитятся |
| Параллельная Phase 4 (Supabase) потребует rewrite backend — React islands уже готовы к migration | Архитектурно React + fetch → легко переключить на Supabase SDK в islands без трогания Astro-слоя |

---

## Open questions for implementation

1. **Self-hosted Michroma/Chakra Petch или Google Fonts CDN?** Google Fonts CDN быстрее (Yandex-кеш), но self-host даёт offline dev. **Рекомендация: Google CDN на Phase 2, self-host в Phase 7 оптимизациях если понадобится.**
2. **Spline scene уже существует или надо заказать у дизайнера?** Если нет — используется placeholder-видео или static chrome-изображение до приземления сцены.
3. **Astro content collections для services/** — используем MD или MDX? **Рекомендация: MD с frontmatter,** MDX только если нужны embed'ы внутри контента.
4. **Deploy автоматизация** — в Phase 2 ручной rsync, автоматика откладывается.

---

## Traceability

- **Phase 0 dependencies:** `.htaccess`, CSRF, rate-limit, .env — всё на месте, требуется добавить `csrf.php` GET endpoint и расширить CSP для Spline + Yandex.
- **Phase 1 dependencies:** brand tokens, wordmark-helper, typography scale — копируются в `site/src/styles/tokens.css`.
- **Phase 3 consumer:** Nano Banana заменит placeholder'ы в Gallery + service-hero + cases после Phase 2.
- **Phase 4 consumer:** Supabase-migration добавит auth к React islands; архитектурно совместимо.
- **Phase 7 consumer:** SEO (meta/schema.org) + Yandex API для YandexReviews дотягивает существующий island.
