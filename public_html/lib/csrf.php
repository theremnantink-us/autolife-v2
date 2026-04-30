<?php
/**
 * Session-based CSRF token generation + verification.
 *
 * - One token per session, valid for any form on the page.
 * - hash_equals() comparison to defeat timing attacks.
 * - Session cookie hardened: HttpOnly, Secure (when HTTPS), SameSite=Strict.
 * - Periodic id regeneration (>30 min) to mitigate session fixation.
 * - csrf_rotate() invalidates the old token and issues a fresh one
 *   (call after successful state-changing POSTs to mitigate replay).
 */

function _csrf_boot_session(): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name('AL_SESS');
    session_start();

    if (empty($_SESSION['__sid_started'])) {
        $_SESSION['__sid_started'] = time();
    } elseif (time() - (int) $_SESSION['__sid_started'] > 1800) {
        session_regenerate_id(true);
        $_SESSION['__sid_started'] = time();
    }
}

function csrf_generate(): string
{
    _csrf_boot_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_verify(string $token): bool
{
    _csrf_boot_session();
    if (empty($_SESSION['csrf_token']) || strlen($token) !== strlen($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Rotate the token after a successful state-changing action.
 * Call from api.php right before responding 200.
 */
function csrf_rotate(): string
{
    _csrf_boot_session();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}
