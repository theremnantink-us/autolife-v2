<?php
/**
 * GET /csrf.php — returns a session-bound CSRF token as JSON.
 * Consumed by React islands on mount before posting to api.php / feedback_handler.php.
 */

require_once __DIR__ . '/lib/csrf.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Same-origin only; no CORS header needed for fetch from same origin.
// For dev cross-origin (Vite :4321 → PHP :8080), vite proxy strips the concern.

// Rate limit: max 30 CSRF fetches per IP per 10 minutes to prevent session flooding
if (!check_rate_limit('csrf', 30, 600)) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many requests']);
    exit;
}

echo json_encode(['csrf_token' => csrf_generate()]);
