<?php
require_once 'vendor/autoload.php'; // Если используете Composer

use Minishlink\WebPush\VAPID;

// Генерируем VAPID ключи
$vapidKeys = VAPID::createVapidKeys();

echo "Public Key: " . $vapidKeys['publicKey'] . "\n";
echo "Private Key: " . $vapidKeys['privateKey'] . "\n";

// Или используйте онлайн генератор: https://web-push-codelab.glitch.me/
?>