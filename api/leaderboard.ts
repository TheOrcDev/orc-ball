import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Self-contained serverless handler — do not import from ../src.
 * Vercel only packs the api/ entry + node_modules; src/ is not available at runtime.
 */

const TOP_N = 20;
const NAME_MAX = 12;
const NAME_MIN = 1;
const SCORE_MAX = 10_000_000;
const SCORE_MIN = 1;
/** Min seconds between submissions per IP. */
const RATE_LIMIT_SEC = 20;
const NAME_ALLOWED = /^[A-Za-z0-9 _.\-]+$/;

type ScoreRow = {
  id: string;
  name: string;
  score: number;
  at: number;
};

type RankedEntry = ScoreRow & { rank: number };

function sanitizeName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[^\w .\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

function isValidName(name: string): boolean {
  return (
    name.length >= NAME_MIN &&
    name.length <= NAME_MAX &&
    NAME_ALLOWED.test(name)
  );
}

function isValidScore(score: number): boolean {
  return (
    Number.isInteger(score) && score >= SCORE_MIN && score <= SCORE_MAX
  );
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

function clientIp(req: VercelRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].split(',')[0]!.trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function toRanked(rows: ScoreRow[]): RankedEntry[] {
  return rows.map((row, i) => ({
    id: String(row.id),
    name: String(row.name),
    score: Number(row.score),
    at: Number(row.at),
    rank: i + 1,
  }));
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(503).json({
      error: 'Leaderboard storage is not configured',
      entries: [],
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = (await sql`
        SELECT
          id::text AS id,
          name,
          score,
          (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS at
        FROM leaderboard_scores
        ORDER BY score DESC, created_at ASC
        LIMIT ${TOP_N}
      `) as ScoreRow[];

      res.status(200).json({ entries: toRanked(rows) });
      return;
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const name = sanitizeName(String(body?.name ?? ''));
      const score = Math.floor(Number(body?.score));

      if (!isValidName(name)) {
        res.status(400).json({ error: 'Invalid name' });
        return;
      }
      if (!isValidScore(score)) {
        res.status(400).json({ error: 'Invalid score' });
        return;
      }

      const ip = clientIp(req);

      // Atomic-ish rate limit: only update if last submit was long enough ago
      // (or no row yet). Empty result ⇒ rate limited.
      const rateRows = await sql`
        INSERT INTO leaderboard_rate_limits (ip, last_submit_at)
        VALUES (${ip}, now())
        ON CONFLICT (ip) DO UPDATE
          SET last_submit_at = now()
          WHERE leaderboard_rate_limits.last_submit_at
            < now() - make_interval(secs => ${RATE_LIMIT_SEC})
        RETURNING ip
      `;
      if (rateRows.length === 0) {
        res
          .status(429)
          .json({ error: 'Too many submissions — try again shortly' });
        return;
      }

      const inserted = (await sql`
        INSERT INTO leaderboard_scores (name, score)
        VALUES (${name}, ${score})
        RETURNING
          id::text AS id,
          name,
          score,
          (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS at
      `) as ScoreRow[];

      const entry = inserted[0];
      if (!entry) {
        res.status(500).json({ error: 'Insert failed' });
        return;
      }

      const entryScore = Number(entry.score);
      const entryAt = Number(entry.at);

      const rankRows = (await sql`
        SELECT COUNT(*)::int AS better
        FROM leaderboard_scores
        WHERE
          score > ${entryScore}
          OR (
            score = ${entryScore}
            AND created_at < to_timestamp(${entryAt / 1000})
          )
      `) as { better: number }[];
      const rank = Number(rankRows[0]?.better ?? 0) + 1;

      const topRows = (await sql`
        SELECT
          id::text AS id,
          name,
          score,
          (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS at
        FROM leaderboard_scores
        ORDER BY score DESC, created_at ASC
        LIMIT ${TOP_N}
      `) as ScoreRow[];

      res.status(201).json({
        ok: true,
        rank,
        entry: {
          id: String(entry.id),
          name: String(entry.name),
          score: entryScore,
          at: entryAt,
          rank,
        },
        entries: toRanked(topRows),
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('leaderboard error', err);
    res.status(500).json({ error: 'Leaderboard failed' });
  }
}
