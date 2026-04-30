<?php
/**
 * Load .env from public_html/.env and expose env($key).
 *
 * .env format: INI-style. Parsed once per request and cached in a static var.
 * Throws RuntimeException if the file is missing or malformed — that's fatal
 * because every downstream call (DB, Telegram, CORS) depends on it.
 */

function load_env(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $path = __DIR__ . '/../.env';
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('.env missing or not readable at ' . $path);
    }

    $parsed = parse_ini_file($path, false, INI_SCANNER_TYPED);
    if ($parsed === false) {
        throw new RuntimeException('.env parse failed — check syntax');
    }

    $cache = $parsed;
    return $cache;
}

function env(string $key, $default = null)
{
    $vars = load_env();
    return array_key_exists($key, $vars) ? $vars[$key] : $default;
}
