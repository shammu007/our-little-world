# Our Little World

A small, cozy 3D birthday world for two people. Walk through a sage-green garden to a three-tier cake with 25 candles, read the "happy 25! sweetheart" sign, visit a white gallery hall with framed photos, and answer the riddle at the glowing blue portal to unlock a love letter. Two devices can explore together in real time.

Built with React, TypeScript, Vite, React Three Fiber, Drei, Rapier, Zustand and Supabase (anonymous auth, Postgres + RLS, private Storage, Realtime Presence/Broadcast). Deploys to Vercel as a static SPA.

## Quick start (demo mode, no accounts needed)

```bash
npm install
npm run dev          # http://localhost:5173
```

Without Supabase variables the app runs in **demo mode**: content and edits live in this browser (localStorage + IndexedDB), and two tabs of the same browser act as two players. Demo mode is for trying things out; nothing in it is private.

## Just want to look? (no install)

`npm run build:standalone` writes `standalone/index.html`: one self-contained file you can double-click to open in Chrome, Edge, Firefox or Safari. It runs the demo with example content. (The normal `dist/` build needs a web server, so double-clicking `dist/index.html` shows a blank page.)

## Real setup (protected letter, private photos, two devices)

Follow **[docs/SETUP.md](docs/SETUP.md)**: create a Supabase project, run one SQL file, set your owner code, add two environment variables, push to GitHub and import into Vercel. About 15 minutes.

## Make it yours

| What | Where |
| --- | --- |
| Welcome text, sign text, entrance questions, avatar colours | `src/content/content.ts` (public, ships in the bundle) |
| Photos, captions, order, wall | In game: pencil button → **Photos** (owner only) |
| Portal clue, hint, accepted answers, love letter | In game: pencil button → **Portal & letter** (owner only, stored on the server) |
| Shared entrance access code | In game: pencil button → **Access code**, or `supabase/setup_codes.sql` |

Never put the real letter or answers in `src/content/*`: those files are public. `demoSecrets.ts` is only used in demo mode.

## Controls

- Desktop: `WASD`/arrows walk, `Shift` run, `Space` hop, drag the mouse to look, scroll to zoom, `E` interact, `Esc` close.
- Phone: left side joystick, drag right side to look, big round button to interact.
- Settings: mute, reduced motion (also follows the OS setting), Beautiful/Light graphics.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check app + tests, production build to `dist/` |
| `npm run test:unit` | Vitest: answer matching, gallery layout, movement interpolation |
| `npm run test:e2e` | Playwright: welcome flow, movement + collisions, cake, gallery, portal + letter, editor, two-player sync, mobile controls |
| `npm run test:sql` | Runs the migration and 44 authorization checks on a local PostgreSQL (`PGHOST`/`PGPORT`/`PGUSER`) |

## Project layout

```
src/
  content/      editable content + bundled placeholder gallery
  backend/      Backend interface, Supabase adapter, offline demo adapter
  net/          realtime transports (Supabase / BroadcastChannel) and room sync
  world/        3D scene: garden, cake, house, gallery, portal, avatars, player
  ui/           welcome, HUD, overlays, editor, touch controls
supabase/
  migrations/   schema, RLS, RPCs, storage + realtime policies
  setup_codes.sql
  tests/        SQL authorization tests
tests/          Playwright end-to-end tests
```

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for what anonymous identity can and cannot do, [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) for a manual checklist, [CREDITS.md](CREDITS.md) for asset licensing, and [PROGRESS.md](PROGRESS.md) for status.
