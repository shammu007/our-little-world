# Identity, privacy and limitations

**No login screen, by design.** Each browser silently becomes a Supabase *anonymous user*. Its session token is stored in that browser's localStorage.

What that means in practice:

- **One identity per browser.** A different browser, a private window, or clearing site data creates a brand-new identity. The entrance questions will be asked again (they are remembered per browser), and the owner must re-enter the owner code to edit.
- **Two participant slots.** The server has exactly two slots, `me` and `sweetheart`. Joining claims one. A slot held by another identity can only be taken over when that holder has been silent for about 90 seconds (heartbeats every 30 s), so switching phones works after a short wait. Only slot holders can read photos, the clue, use the realtime room or try the portal.
- **Duplicate sessions.** Opening the same role in a second tab or device makes the newest one active; the older one shows "You are inside somewhere else" with a **Continue here** button.
- **Entrance questions are not security.** They are checked in the browser and their answers ship in the JavaScript bundle. They are a playful greeting only.
- **Access code is a light lock.** If set, it is checked on the server (bcrypt hash, rate limited). It stops strangers with the link from taking an empty slot, but anyone you share it with can use it.
- **What is actually protected (Supabase mode):** the letter and accepted answers live in a private schema and are only returned by `verify_portal()` after a correct answer from a slot holder (30 guesses per 10 minutes). Photos live in a private bucket and are served through 6-hour signed URLs to slot holders only. Editing requires the owner code. These rules are covered by `supabase/tests/10_authorization_test.sql`.
- **Abuse limits.** A determined person could keep creating anonymous identities to get around per-user rate limits; Supabase limits anonymous sign-ins per IP (about 30 per hour by default). For a two-person birthday site this is a reasonable trade-off.
- **Shared world state is ephemeral.** Candle state is synced over Broadcast and handed to late joiners by whoever is already inside. When nobody is online, the cake simply relights for the next visit.
- **Demo mode** (no Supabase variables) keeps everything in one browser and protects nothing.
- **Old devices.** The 3D scene needs WebGL. Very old phones may run slowly; Settings → Light lowers resolution, removes shadows and thins out plants.
