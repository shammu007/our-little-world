# Progress

_Last updated: 2026-10-22_

## Done and tested

- [x] Vite + React 19 + TypeScript + R3F 9 + Drei + Rapier + Zustand foundation, code-split (welcome screen loads ~77 kB gzip; 3D engine loads in the background)
- [x] Garden: sage ground, instanced low-poly trees, white flowers, swaying grass, stone path, plaza, benches, lanterns, hedge boundary, entrance gate, sky and distant hills
- [x] Cake with exactly 25 animated candles (unit-tested), legible "happy 25! sweetheart" sign, blow-out with smoke, restrained confetti, music-box tune, relight
- [x] House with opening door, roof, windows, porch, large hall: matte white walls, light oak floor, bench, rug, plants
- [x] Gallery: 16 placeholder photos, evenly spaced at one eye level over three walls, aspect ratios preserved (unit-tested), picture lights, prompt + photo viewer with caption and browsing
- [x] Electric-blue portal in the clear centre of the main wall: brightens on approach, shows the clue, friendly retry + hint, magical open animation, animated love letter
- [x] Third-person camera with wall/ceiling collision, kinematic character controller, walls are solid (e2e-tested)
- [x] Cartoon avatars (male for Me, female for Sweetheart) with walk/run/jump/idle/blink animation
- [x] Entrance: welcome → who → personal questions + optional access code → avatar preview → enter. No auth UI
- [x] Supabase: anonymous identity, two participant slots, heartbeat + takeover, owner code, private letter via `verify_portal`, private storage with signed URLs, realtime authorization, rate limits. 44 SQL authorization tests on PostgreSQL 16
- [x] Multiplayer: Presence for who is online, Broadcast for pose (12 Hz throttle), cake and portal events; snapshot interpolation; late-joiner state sync; reconnect with backoff; duplicate-session takeover (e2e-tested with two clients in demo transport)
- [x] Owner editor: upload (auto-resized), captions, order, wall, delete; portal clue/hint/answers/letter; access code
- [x] Mobile: floating joystick, touch look, large interact button, hop (e2e-tested on a Pixel 7 profile)
- [x] Loading screen, hints, toasts, help, settings (mute, reduced motion, graphics quality), WebGL error fallback, offline fallback
- [x] Vercel config with SPA fallback, `.env.example`, setup docs, limitations, acceptance checklist, credits

## Not verifiable here (needs your accounts)

- [ ] Running against a real Supabase project (the client code paths for anonymous sign-in, private realtime channels and signed URLs are written to the documented APIs but were only exercised in demo mode; the SQL was tested on plain PostgreSQL with stubbed Supabase schemas)
- [ ] Vercel deployment and testing on two real phones (see `docs/ACCEPTANCE.md`)
- [ ] Real-GPU performance check (tests ran with software WebGL)

## Ideas for later

- Wave / hug emote between avatars
- Persist the candle state in the database
- Optional background music track
