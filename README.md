# ORC-BALL

**Play:** [orcball.com](https://orcball.com)

Retro **Breakout / DX-Ball** style arcade game in the browser — Phaser 3, TypeScript, Vite.

Smash brick walls, collect power-ups (glue, laser, multi-ball, fireball, and more), and clear **26 levels**. Progress and high scores save in your browser. Clear the campaign to submit your score to the **global top-20 leaderboard**.

## Play

- Live: https://orcball.com
- Local: `npm install && npm run dev`
- Production: `npm run build && npm run preview`
- API locally: `vercel dev` (loads `DATABASE_URL` from `.env`)

## Leaderboard

Campaign clears can be submitted with a name (max 12 chars). The public board shows the top **20** scores.

Storage is **Neon Postgres** (`leaderboard_scores` table). The API needs:

```bash
DATABASE_URL=postgresql://…  # Neon pooled connection string
```

- Local: copy `.env.example` → `.env` and fill in the URL (or `neonctl env pull` if linked)
- Production: set `DATABASE_URL` on the Vercel project (Production + Preview), then redeploy

Without `DATABASE_URL` the game still runs; the board returns offline / empty.

## Controls

| Input | Action |
|--------|--------|
| ← → / A D or drag | Move paddle |
| SPACE / tap / LAUNCH | Serve ball · fire lasers |
| ESC / P | Pause menu |

## Power-ups

| Letter | Power |
|--------|--------|
| **G** | Glue — ball sticks; SPACE launches |
| **B** | Bullet — ball burns through bricks |
| **L** | Laser — twin beams from paddle ends |
| **M** | Multi-ball |
| **E** / **S** | Expand / shrink paddle |
| **+** | Extra life |

## Stack

- Phaser 3 (arcade physics)
- TypeScript + Vite
- Procedural textures & WebAudio SFX (no binary game assets except menu art)

## License

Private — OrcDev
