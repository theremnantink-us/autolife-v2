<?php
/**
 * POST /api.php — booking form endpoint.
 *
 * Security (Phase 0):
 *   - CSRF token required (hidden input from index.php form)
 *   - Rate-limited per IP+endpoint via lib/rate_limit.php
 *   - CORS restricted to CORS_ORIGIN (from .env)
 *   - Telegram token read from .env, never hardcoded
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/csrf.php';
require_once __DIR__ . '/lib/rate_limit.php';
require_once __DIR__ . '/lib/security_headers.php';
require_once __DIR__ . '/telegram_notifications.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Vary: Origin');
send_security_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new RuntimeException('Только POST запросы разрешены');
    }

    $raw   = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
        $input = $_POST;
    }

    $limit = (int) env('RATE_LIMIT_BOOKING_PER_HOUR', 5);
    if (!check_rate_limit('booking', $limit, 3600)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Слишком много запросов. Попробуйте позже.']);
        exit;
    }

    if (!csrf_verify((string) ($input['csrf_token'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ошибка безопасности (CSRF). Перезагрузите страницу.']);
        exit;
    }

    if (!isDbConnected()) {
        throw new RuntimeException('Нет подключения к базе данных');
    }

    foreach (['name', 'phone', 'carBrand', 'carModel', 'service', 'date'] as $field) {
        if (empty($input[$field])) {
            throw new RuntimeException("Обязательное поле '$field' не заполнено");
        }
    }

    $name           = trim((string) $input['name']);
    $phone          = preg_replace('/[^0-9+]/', '', (string) $input['phone']);
    $carBrand       = trim((string) $input['carBrand']);
    $carModel       = trim((string) $input['carModel']);
    $service        = trim((string) $input['service']);
    $date           = trim((string) $input['date']);
    $additionalInfo = trim((string) ($input['additionalInfo'] ?? ''));

    if (strlen($phone) < 10) {
        throw new RuntimeException('Некорректный номер телефона');
    }

    $appointment_date = DateTime::createFromFormat('Y-m-d H:i', $date);
    if (!$appointment_date) {
        throw new RuntimeException('Неверный формат даты');
    }
    if ($appointment_date < new DateTime()) {
        throw new RuntimeException('Нельзя записаться на прошедшую дату');
    }

    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'INSERT INTO appointments
         (client_name, client_phone, car_brand, car_model, service, appointment_date, additional_info)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $name, $phone, $carBrand, $carModel, $service,
        $appointment_date->format('Y-m-d H:i:s'),
        $additionalInfo,
    ]);
    $appointment_id = (int) $pdo->lastInsertId();

    error_log("Appointment saved successfully. ID: $appointment_id");

    if (TG_BOT_TOKEN && TG_CHAT_ID) {
        try {
            $telegram = new TelegramNotifier(TG_BOT_TOKEN, TG_CHAT_ID);
            $telegram->sendNewAppointmentNotification([
                'id'            => $appointment_id,
                'client_name'   => $name,
                'client_phone'  => $phone,
                'car_brand'     => $carBrand,
                'car_model'     => $carModel,
                'service'       => $service,
                'date'          => $appointment_date->format('d.m.Y H:i'),
                'additional'    => $additionalInfo,
            ]);
        } catch (Throwable $e) {
            // Telegram-сбой не должен валить основной flow — запись уже в БД.
            error_log('Telegram notification failed: ' . $e->getMessage());
        }
    }

    // Rotate CSRF token after successful state-changing op (replay defense).
    $newToken = csrf_rotate();

    echo json_encode([
        'success'        => true,
        'message'        => 'Запись успешно создана! Мы свяжемся с вами для подтверждения.',
        'appointment_id' => $appointment_id,
        'csrf_token'     => $newToken,
    ]);
} catch (Throwable $e) {
    // Internal details go to the log; the client sees a generic message
    // unless this is a known validation error we threw ourselves.
    error_log('API Error: ' . $e->getMessage());
    http_response_code(400);

    $isInternal = $e instanceof PDOException
                || stripos($e->getMessage(), 'SQLSTATE') !== false
                || stripos($e->getMessage(), 'Database') !== false;

    echo json_encode([
        'success' => false,
        'message' => $isInternal
            ? 'Не удалось обработать запрос. Попробуйте позже.'
            : $e->getMessage(),
    ]);
}
