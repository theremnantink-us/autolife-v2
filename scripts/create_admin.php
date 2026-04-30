<?php
/**
 * One-off script to create/update an admin account.
 * Run manually from CLI:
 *   cd public_html && php ../scripts/create_admin.php <username> <password>
 *
 * Password is hashed with PASSWORD_DEFAULT (bcrypt). Requires the `admins`
 * table from scripts/schema.sql.
 *
 * NOTE: the proper admin panel lands in Phase 5. This script exists only
 * for a future Phase 5 bootstrap — DO NOT invoke in Phase 0.
 */

$publicHtml = __DIR__ . '/../public_html';
require_once $publicHtml . '/config.php';

if ($argc < 3) {
    fwrite(STDERR, "Usage: php create_admin.php <username> <password>\n");
    exit(1);
}

$username = $argv[1];
$password = $argv[2];

$pdo = get_pdo();
if ($pdo === null) {
    fwrite(STDERR, "Нет подключения к БД. Проверь public_html/.env\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $stmt = $pdo->prepare(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
    );
    $stmt->execute([$username, $hash]);
    echo "Admin '$username' upserted.\n";
} catch (PDOException $e) {
    fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
    exit(1);
}
