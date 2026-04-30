<?php
/**
 * Health check endpoint — replaces db_status.php.
 *
 * Minimal response: { ok: bool, ts: "YYYY-MM-DD HH:MM:SS" }
 * Intentionally does NOT enumerate tables or leak schema info.
 * The frontend only cares whether booking is currently accepting submissions.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$ok = false;
$pdo = get_pdo();
if ($pdo !== null) {
    try {
        $pdo->query('SELECT 1');
        $ok = true;
    } catch (Throwable $e) {
        error_log('Health check failed: ' . $e->getMessage());
    }
}

echo json_encode([
    'ok' => $ok,
    'ts' => date('Y-m-d H:i:s'),
]);
