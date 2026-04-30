# Spec: Security Hot-fix (Phase 0) — autolife-detail.ru

**Дата:** 2026-04-24
**Автор:** Claude (brainstorming → writing-plans → subagent-driven-development)
**Ветка:** `phase-0/security-hotfix`
**Область:** только Фаза 0 из многофазной программы редизайна. Phase 1+ живут в отдельных спеках и планах.

---

## Контекст

Аудит `public_html/` показал, что текущий сайт развернут на Timeweb с критическими утечками:

| № | Уязвимость | Риск |
|---|---|---|
| 1 | Telegram bot token (50+ chars) захардкожен в `api.php:95` | DoS на владельца бота, фейк-уведомления |
| 2 | DB-пароль MySQL в 4 PHP-файлах | При утечке исходников — полный доступ к БД |
| 3 | Нет `.htaccess` — `create_admin.php`, `db_status.php`, `test_*.php` открыты напрямую | RCE через создание админа, enumeration схемы БД |
| 4 | `Access-Control-Allow-Origin: *` | CSRF через бронирование с любого сайта |
| 5 | Нет rate-limiting | Спам бронирований, брутфорс |
| 6 | Нет CSRF-защиты на формах | Классический CSRF через картинку/iframe |
| 7 | HTTP без редиректа, нет HSTS | MITM, SEO-штраф |
| 8 | Нет security headers (CSP, X-Frame-Options, X-Content-Type-Options) | XSS, clickjacking, MIME-sniffing |

Все 8 фаз большого редизайна (бренд, Figma, 3D, Nano Banana, Supabase, ЛК, SEO, лояльность) будут наслаиваться на этот фундамент. Делать их до закрытия дыр — бессмысленно.

---

## Цель

Секреты → `.env`. Telegram-токен ревокнут и перевыпущен. Dev-утилиты из прода удалены. API защищены rate-limit + CSRF. HTTPS форсирован. Security headers выставлены. CORS закрыт на один домен. Функциональность сайта не меняется.

---

## Архитектура решения

### Файловая структура

```
autolife-detail.ru/
├── .gitignore                   .env, backups, IDE
├── docs/superpowers/specs/      ← эта спека
├── scripts/                     ← one-off утилиты ВНЕ public_html
│   ├── create_admin.php         (для ручного запуска при miграции)
│   ├── create_tables.php
│   ├── generate-vapid-keys.php
│   ├── schema.sql               дамп схемы + CREATE TABLE rate_limits
│   └── backup-YYYY-MM-DD.sql    бэкап перед деплоем (gitignored)
└── public_html/                 то, что уходит на Timeweb
    ├── .env                     секреты (chmod 600, gitignored)
    ├── .env.example             шаблон (в git)
    ├── .htaccess                HTTPS + headers + deny
    ├── config.php               env → константы + get_pdo()
    ├── lib/
    │   ├── env.php              load_env(), env($key)
    │   ├── rate_limit.php       check_rate_limit($endpoint, $limit, $window)
    │   ├── csrf.php             csrf_generate(), csrf_verify($token)
    │   └── security_headers.php send_security_headers()
    ├── index.php                ← бывший index.html + CSRF hidden input
    ├── api.php                  + rate-limit + CSRF + CORS_ORIGIN
    ├── feedback_handler.php     то же
    ├── process_booking.php      то же
    ├── get_appointments.php     config.php вместо хардкода
    ├── busy_dates.php           то же
    ├── stats.php, track_visit.php, telegram_notifications.php, logout.php
    ├── pricelist.html, privacy-policy.html
    ├── manifest.json, icons/, IMG/
    └── index.js, style.css, yandex_bdd728707d02261e.html
```

Удалены из прода: `admin.php` (1 байт), `check_tables.php`, `create_admin.php`, `create_tables.php`, `db_status.php`, `generate-vapid-keys.php`, `test_api.php`, `test_db.php`. `sendCaptcha.php` и `send-notification.php` — удаляются только после grep-проверки, что ни один вызов не живёт.

### Контракты библиотек

**`lib/env.php`**
- `load_env(): array` — читает `.env` один раз на запрос (static cache), возвращает ассоциативный массив. Бросает `RuntimeException` если файл отсутствует или не парсится.
- `env(string $key, $default = null): mixed` — геттер одного ключа.

**`lib/rate_limit.php`**
- `check_rate_limit(string $endpoint, int $limit, int $window_seconds): bool` — возвращает `false` при превышении лимита. При возврате `true` атомарно инсертит запись в таблицу `rate_limits`. Использует `$_SERVER['REMOTE_ADDR']`.

**`lib/csrf.php`**
- `csrf_generate(): string` — создаёт/возвращает токен сессии (32 байта hex). Стартует сессию если не начата.
- `csrf_verify(string $token): bool` — `hash_equals`-сравнение с `$_SESSION['csrf_token']`.

**`lib/security_headers.php`**
- `send_security_headers(): void` — для JSON-эндпоинтов: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`. HSTS и CSP покрывает `.htaccess`.

**`config.php`**
- Define: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `TG_BOT_TOKEN`, `TG_CHAT_ID`, `CORS_ORIGIN`, `APP_ENV`.
- `get_pdo(): PDO` — singleton-PDO на utf8mb4 с `ERRMODE_EXCEPTION` и `EMULATE_PREPARES=false`.

### Схема БД (новая таблица)

```sql
CREATE TABLE rate_limits (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  ip        VARCHAR(45) NOT NULL,
  endpoint  VARCHAR(64) NOT NULL,
  ts        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (ip, endpoint, ts)
);
```

Cleanup: daily cron `DELETE FROM rate_limits WHERE ts < DATE_SUB(NOW(), INTERVAL 1 DAY);`

### Контракт `.env`

```ini
DB_HOST, DB_NAME, DB_USER, DB_PASS
TG_BOT_TOKEN, TG_CHAT_ID
CORS_ORIGIN, APP_ENV, APP_URL
RATE_LIMIT_BOOKING_PER_HOUR=5
RATE_LIMIT_FEEDBACK_PER_HOUR=3
```

### Контракт `.htaccess`

1. Force HTTPS (301).
2. Deny всех dotfiles (`<FilesMatch "^\.">`).
3. Deny dev-скриптов по префиксу (`test_`, `check_`, `create_`, `db_status`, `generate-vapid`, `admin.php`) — паранойя на случай недоудаления.
4. Headers: HSTS (1 год), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP.
5. CSP whitelist: Font Awesome (cdnjs), Google Fonts, Яндекс.Карты (`api-maps.yandex.ru`, `yandex.ru` в frame-src), `api.telegram.org` в connect-src.

### Контракт эндпоинтов

Каждый POST-эндпоинт (api.php, feedback_handler.php, process_booking.php):

```php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/lib/csrf.php';
require_once __DIR__ . '/lib/security_headers.php';

send_security_headers();
header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
header('Vary: Origin');

if (!check_rate_limit($endpoint_key, $limit_from_env, 3600)) { http_response_code(429); ... }
if (!csrf_verify($_POST['csrf_token'] ?? '')) { http_response_code(403); ... }
```

### Контракт форм в index.php

`index.html` → `index.php` (MultiViews на Timeweb работает; если нет — `.htaccess` RewriteRule). В каждую форму:
```html
<input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_generate()) ?>">
```

### Контракт верификации

Готовность Фазы 0 — **все** 7 curl-проверок + 5 UI-проверок зелёные. См. план-файл раздел "Верификация" для точных команд.

---

## Вне скопа

- Редизайн, 3D, Nano Banana, Figma — Фаза 2, 3, 6
- Supabase-миграция, ЛК клиента — Фаза 4
- Админ-панель — Фаза 5
- SEO/Яндекс.Метрика/Бизнес — Фаза 7
- Лояльность + маркетинг — Фаза 8
- Починка `sendEmailNotification()` undefined — отдельная задача
- Dead-code cleanup (hero 2.gif 3 МБ, Mercedes.webp) — делается в Фазе 2

---

## Trade-offs (для записи)

- **`parse_ini_file` vs phpdotenv:** выбран native. Плюс: 0 зависимостей. Минус: не поддерживает interpolation и вложенные значения — не нужно для 10 ключей.
- **Rate-limit в MySQL vs file-based vs APCu:** выбран MySQL. Плюс: персистентный, легко ревьюить, уже есть подключение. Минус: +1 запрос на API-вызов (~1-2ms на Timeweb shared).
- **index.html → index.php vs csrf.php JSON-эндпоинт:** выбран index.php. Плюс: inline-токен не требует JS, работает без JavaScript. Минус: больше не статичен (незначимо — уже есть PHP-зависимость через `busy_dates.php`).

---

## Critical path (blockers from customer)

1. `/revoke` Telegram-бота в @BotFather — требует доступ к Telegram-аккаунту заказчика.
2. Ротация DB-пароля в phpMyAdmin — требует логин Timeweb-панели.

Шаги 1-7 плана (локальный код) делаются без заказчика. Шаги 8-11 (deploy + ротация + verify) требуют его присутствия в 5-минутном окне.
