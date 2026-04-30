<?php
/**
 * GET /busy_dates.php — list of dates that are fully booked.
 *
 * Hardened in the redesign security pass:
 *   - Method must be GET.
 *   - Per-IP rate limit: 60 / 5 min (clients fetch this on every load).
 *   - Public no-cache JSON; returns empty list on DB outage so the form
 *     keeps working with server-side date validation as the safety net.
 *   - Internal exception messages never leak to the client.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/lib/security_headers.php';

header('Content-Type: application/json; charset=utf-8');
send_security_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['success' => false, 'message' => 'Метод не поддерживается']);
    exit;
}

try {
    if (!check_rate_limit('busy_dates', 60, 300)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Слишком много запросов']);
        exit;
    }

    if (!isDbConnected()) {
        echo json_encode(['success' => true, 'busy_dates' => []]);
        exit;
    }

    $pdo = get_pdo();
    $sql = "SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS busy_date
            FROM appointments
            WHERE appointment_date >= CURDATE()
              AND status != 'cancelled'
            GROUP BY DATE(appointment_date)
            HAVING COUNT(*) >= 8
            ORDER BY busy_date";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);

    echo json_encode(['success' => true, 'busy_dates' => $dates]);
} catch (Throwable $e) {
    error_log('busy_dates error: ' . $e->getMessage());
    echo json_encode(['success' => true, 'busy_dates' => []]);
}
