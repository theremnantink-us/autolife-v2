-- Schema dump for autolife-detail.ru (ct50507_autolife)
-- Generated: 2026-04-24 (Phase 0 security hot-fix)
-- Source: public_html/create_tables.php + create_admin.php + Phase 0 additions

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- appointments — booking records from the landing page form
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_name VARCHAR(100) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  car_brand VARCHAR(50) NOT NULL,
  car_model VARCHAR(50) NOT NULL,
  service VARCHAR(100) NOT NULL,
  appointment_date DATETIME NOT NULL,
  additional_info TEXT,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appointment_date (appointment_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- site_visits — own visit tracking (pre-Yandex Metrica era)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45),
  user_agent TEXT,
  page_visited VARCHAR(500),
  visit_time DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visit_time (visit_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- busy_dates — admin-marked unavailable dates
-- ============================================================
CREATE TABLE IF NOT EXISTS busy_dates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  reason VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- admins — referenced by create_admin.php but never created in code.
-- Adding here so Phase 5 admin panel has a consistent target.
-- Phase 0 does NOT create admin accounts (admin panel is Phase 5).
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- rate_limits — NEW in Phase 0
-- Per-IP + per-endpoint request log for check_rate_limit()
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  endpoint VARCHAR(64) NOT NULL,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_endpoint_ts (ip, endpoint, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Daily cleanup (add to Timeweb cron or server scheduler)
-- DELETE FROM rate_limits WHERE ts < DATE_SUB(NOW(), INTERVAL 1 DAY);
-- ============================================================
