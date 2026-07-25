-- ORC-BALL global leaderboard (Neon Postgres)
-- Applied to project lucky-water-19279588 / neondb

CREATE TABLE IF NOT EXISTS leaderboard_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(12) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_scores_rank_idx
  ON leaderboard_scores (score DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS leaderboard_rate_limits (
  ip TEXT PRIMARY KEY,
  last_submit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
