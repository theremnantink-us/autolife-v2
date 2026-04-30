<?php
/**
 * GET /csrf.php — returns a session-bound CSRF token as JSON.
 * Consumed by React islands on mount before posting to api.php / feedback_handler.php.
 */

require_once __DIR__ . '/lib/csrf.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

// Same-origin only; no CORS header needed for fetch from same origin.
// For dev cross-origin (Vite :4321 → PHP :8080), vite proxy strips the concern.

echo json_encode(['csrf_token' => csrf_generate()]);
