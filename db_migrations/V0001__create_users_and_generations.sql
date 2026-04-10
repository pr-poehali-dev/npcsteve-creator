CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  yandex_id VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  prompt TEXT NOT NULL,
  model VARCHAR(64) DEFAULT 'flux',
  status VARCHAR(32) DEFAULT 'pending',
  image_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
