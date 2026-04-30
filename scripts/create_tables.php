<?php
/**
 * One-off script to create/verify DB tables.
 * Run manually from CLI after setting up .env on the server:
 *   cd public_html && php ../scripts/create_tables.php
 *
 * Idempotent — uses CREATE TABLE IF NOT EXISTS. Mirrors scripts/schema.sql.
 */

$publicHtml = __DIR__ . '/../public_html';
require_once $publicHtml . '/config.php';

$pdo = get_pdo();
if ($pdo === null) {
    fwrite(STDERR, "Нет подключения к БД. Проверь public_html/.env\n");
    exit(1);
}

$schemaPath = __DIR__ . '/schema.sql';
if (!is_file($schemaPath)) {
    fwrite(STDERR, "scripts/schema.sql not found\n");
    exit(1);
}

$sql = file_get_contents($schemaPath);
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
    if (str_starts_with($stmt, '--') || $stmt === '') continue;
    try {
        $pdo->exec($stmt);
        echo "✓ " . substr($stmt, 0, 60) . "...\n";
    } catch (PDOException $e) {
        echo "✗ " . $e->getMessage() . "\n";
    }
}

echo "Готово.\n";
