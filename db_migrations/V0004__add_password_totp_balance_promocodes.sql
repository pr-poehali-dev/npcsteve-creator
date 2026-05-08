-- Добавляем поля для пароля, TOTP, баланса и роли
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL;

-- Промокоды
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  used_by INTEGER REFERENCES users(id),
  used_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  comment TEXT
);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes(code);

-- Помечаем админа
UPDATE users SET is_admin = TRUE WHERE LOWER(email) = 'zenaturin27@gmail.com';
