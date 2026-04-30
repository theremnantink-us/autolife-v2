<?php
/**
 * Security headers for JSON/PHP endpoints.
 *
 * .htaccess applies the full HTML-page set (CSP, HSTS, Permissions-Policy)
 * to every response, but JSON endpoints under some Apache configurations
 * may not inherit them. This function reapplies the critical subset.
 *
 * Anything purely browser-context (CSP frame ancestors, Permissions-Policy)
 * makes no sense on a JSON endpoint, so we only emit the headers that
 * actually protect the response itself.
 */

function send_security_headers(): void
{
    // Prevent MIME-sniffing attacks
    header('X-Content-Type-Options: nosniff');
    // No iframe embedding of JSON endpoints
    header('X-Frame-Options: DENY');
    // Don't leak referrers cross-origin
    header('Referrer-Policy: strict-origin-when-cross-origin');
    // Block isolation against cross-origin attacks (Spectre)
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Cross-Origin-Opener-Policy: same-origin');
    // Cache control — never cache JSON responses by default
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
}
