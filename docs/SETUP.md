# Setup: Supabase, GitHub and Vercel

Everything below happens in web dashboards. Supabase and Vercel labels move around now and then; if a name differs slightly, look for the closest match.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**. Pick a region close to both of you and save the database password somewhere safe.
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**. (Leave CAPTCHA off: the app does not send a CAPTCHA token.)
3. **SQL Editor → New query**: paste the whole of `supabase/migrations/20261022000000_our_little_world.sql` and run it. It creates the tables, row-level security, RPC functions, the private `gallery` storage bucket and the realtime policies.
   - Using the Supabase CLI instead? `npx supabase link --project-ref <ref>` then `npx supabase db push`.
4. **SQL Editor → New query**: open `supabase/setup_codes.sql`, replace `REPLACE-WITH-A-LONG-OWNER-CODE` with your own owner code (and optionally uncomment the access-code block), run it. Do not save the real codes in the repository.
5. **Realtime → Settings**: turn off **Allow public access** (private channels only). The app already uses private channels; this makes the server refuse anything else.
6. **Project Settings → API Keys** (or **Data API**): copy the **Project URL** and the **publishable / anon** key. Never use the `service_role` / secret key in the app.
7. **Authentication → URL Configuration**: set **Site URL** to your Vercel URL once you have it (step 3 below). Anonymous sign-in uses no redirects, so nothing else is needed there.

## 2. Run locally against Supabase

```bash
cp .env.example .env.local
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open the site, choose **Me**, answer the questions, enter, click the pencil button and type your owner code. Upload 12 to 20 photos, write captions, pick walls, then fill in **Portal & letter** with your real clue, answers and letter. To test two players on one computer, use a normal window and a private window (they get different anonymous identities).

## 3. Push to GitHub

Create an **empty private** repository on GitHub (no README), then:

```bash
git remote add origin https://github.com/<you>/our-little-world.git
git push -u origin main
```

`.env.local` is git-ignored; double-check with `git status` that no keys are staged.

## 4. Deploy on Vercel

1. https://vercel.com/new → **Import** the GitHub repository.
2. Framework preset: **Vite** (detected). Build command `npm run build`, output `dist` (already in `vercel.json`).
3. **Environment Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_ROOM_ID`) for Production and Preview.
4. **Deploy**. `vercel.json` rewrites every non-asset path to `index.html`, so refreshing any URL works.
5. Copy the production URL into Supabase **Authentication → URL Configuration → Site URL**.
6. Open the URL on your phone and computer and run through `docs/ACCEPTANCE.md`.

## Changing things later

- New photos / letter: in game, as the owner. No redeploy needed.
- Welcome text, sign, entrance questions, avatar colours: edit `src/content/content.ts`, commit, push (Vercel redeploys automatically).
- Fresh start of the participant slots: run the reset lines at the bottom of `supabase/setup_codes.sql`.
