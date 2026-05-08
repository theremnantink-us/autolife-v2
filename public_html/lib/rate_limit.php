<?php
/**
 * Per-IP, per-endpoint rate limiting backed by MySQL `rate_limits` table.
 *
 * Returns false if the IP has hit the limit in the given window. When it
 * returns true, the current request is logged atomically so subsequent calls
 * see the new count.
 *
 * Daily cleanup (cron): DELETE FROM rate_limits WHERE ts < DATE_SUB(NOW(), INTERVAL 1 DAY);
 */

function check_rate_limit(string $endpoint, int $limit, int $window_seconds): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    $pdo = get_pdo();
    if (!$pdo) return true; // DB unavailable — fail open, let request through

    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM rate_limits
         WHERE ip = ? AND endpoint = ? AND ts > DATE_SUB(NOW(), INTERVAL ? SECOND)'
    );
    $stmt->execute([$ip, $endpoint, $window_seconds]);

    if ((int) $stmt->fetchColumn() >= $limit) {
        return false;
    }

    $pdo->prepare('INSERT INTO rate_limits (ip, endpoint) VALUES (?, ?)')
        ->execute([$ip, $endpoint]);

    return true;
}
