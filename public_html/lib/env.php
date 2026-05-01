<?php
/**
 * Load .env from public_html/.env and expose env($key).
 *
 * .env format: INI-style. Parsed once per request and cached in a static var.
 * If .env is missing or malformed, returns an empty array — endpoints that
 * need real values must check the result and degrade gracefully (return 503
 * or skip, but never crash with 500).
 */

function load_env(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $path = __DIR__ . '/../.env';
    if (!is_file($path) || !is_readable($path)) {
        error_log('[env] .env missing at ' . $path . ' — using empty config');
        $cache = [];
        return $cache;
    }

    $parsed = @parse_ini_file($path, false, INI_SCANNER_TYPED);
    if ($parsed === false) {
        error_log('[env] .env parse failed — using empty config');
        $cache = [];
        return $cache;
    }

    $cache = $parsed;
    return $cache;
}

function env(string $key, $default = null)
{
    $vars = load_env();
    return array_key_exists($key, $vars) ? $vars[$key] : $default;
}
