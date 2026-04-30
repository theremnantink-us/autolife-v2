<?php
/**
 * POST /track_visit.php — best-effort site-visit logger.
 *
 * Hardened in the redesign security pass:
 *   - Method must be POST.
 *   - Per-IP rate limit: 60 hits / 5 min (covers normal browsing + reloads).
 *   - User agent + referer length-clipped to defeat log-injection / DoS.
 *   - 204 No Content on success — no JSON body needed; saves bandwidth.
 *   - All errors swallowed (return 204) so a logger fault never breaks UX.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/lib/security_headers.php';

send_security_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

try {
    if (!check_rate_limit('track_visit', 60, 300)) {
        http_response_code(204);
        exit;
    }

    if (isDbConnected()) {
        $pdo = get_pdo();
        // Best-effort: only insert if the table exists.
        $exists = $pdo->query("SHOW TABLES LIKE 'site_visits'");
        if ($exists && $exists->rowCount() > 0) {
            $ip   = substr((string) ($_SERVER['REMOTE_ADDR']     ?? ''), 0, 45);
            $ua   = substr((string) ($_SERVER['HTTP_USER_AGENT']  ?? ''), 0, 255);
            $ref  = substr((string) ($_SERVER['HTTP_REFERER']     ?? 'Direct'), 0, 255);
            $now  = date('Y-m-d H:i:s');

            $stmt = $pdo->prepare(
                'INSERT INTO site_visits (ip_address, user_agent, page_visited, visit_time)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([$ip, $ua, $ref, $now]);
        }
    }
} catch (Throwable $e) {
    error_log('track_visit error: ' . $e->getMessage());
}

http_response_code(204);
