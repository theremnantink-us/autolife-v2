<?php
/**
 * Central config — loaded by every endpoint.
 *
 * - Reads secrets from .env (see public_html/.env.example)
 * - Exposes DB_*, TG_*, CORS_ORIGIN, APP_ENV as constants
 * - Provides a singleton PDO via get_pdo()
 * - Legacy helpers isDbConnected() / getBusyDates() kept for compatibility
 *   with existing endpoints (api.php, busy_dates.php, track_visit.php).
 */

require_once __DIR__ . '/lib/env.php';

define('DB_HOST',       env('DB_HOST', 'localhost'));
define('DB_NAME',       env('DB_NAME'));
define('DB_USER',       env('DB_USER'));
define('DB_PASS',       env('DB_PASS'));
define('TG_BOT_TOKEN',  env('TG_BOT_TOKEN'));
define('TG_CHAT_ID',    env('TG_CHAT_ID'));
define('CORS_ORIGIN',   env('CORS_ORIGIN', 'https://www.autolife-detail.ru'));
define('APP_ENV',       env('APP_ENV', 'production'));

function get_pdo(): ?PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        $pdo = null;
    }
    return $pdo;
}

// Expose $pdo as a legacy global for code paths that still use it directly.
$pdo = get_pdo();

function isDbConnected(): bool
{
    return get_pdo() !== null;
}

function getBusyDates(): array
{
    $pdo = get_pdo();
    if ($pdo === null) {
        return [];
    }
    try {
        $stmt = $pdo->query('SELECT date FROM busy_dates WHERE date >= CURDATE()');
        return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    } catch (PDOException $e) {
        error_log('Error getting busy dates: ' . $e->getMessage());
        return [];
    }
}
