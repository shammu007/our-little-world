-- ─────────────────────────────────────────────────────────────────────────────
--  Our Little World: database, storage and realtime authorization
--
--  Identity: every visitor is a Supabase *anonymous* user (no login UI).
--  Room membership: a visitor becomes a member by claiming one of exactly two
--  participant slots ('me', 'sweetheart') through join_room(). Members can read
--  photos and the portal clue and use the realtime channel. The love letter
--  is only ever returned by verify_portal() after a correct answer.
--  Owner: whoever proves the owner code via claim_owner(). Owners edit content.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- Private schema: not exposed through the Data API, not readable by clients.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------- tables ----

create table if not exists private.app_secrets (
  id boolean primary key default true check (id),
  owner_code_hash text,
  access_code_hash text
);
insert into private.app_secrets (id) values (true) on conflict do nothing;

create table if not exists private.portal_secret (
  id boolean primary key default true check (id),
  accepted_answers text[] not null default '{}',
  letter jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists attempts_lookup on private.attempts (user_id, kind, created_at desc);

create table if not exists public.room_slots (
  role text primary key check (role in ('me', 'sweetheart')),
  user_id uuid references auth.users (id) on delete set null,
  display_name text,
  last_seen timestamptz
);
insert into public.room_slots (role) values ('me'), ('sweetheart') on conflict do nothing;

create table if not exists public.owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_public (
  id boolean primary key default true check (id),
  clue text not null default '',
  hint text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null check (length(storage_path) between 1 and 300),
  caption text not null default '' check (length(caption) <= 280),
  wall text not null default 'left' check (wall in ('left', 'back', 'right')),
  sort_order int not null default 0,
  aspect real not null default 1.5 check (aspect between 0.2 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe placeholder content (replace it in-game as the owner).
insert into public.portal_public (id, clue, hint)
values (true, 'Example clue: I have keys but open no doors, and I play the songs you love. What am I?', 'Example hint: you can find one with black and white keys.')
on conflict do nothing;

insert into private.portal_secret (id, accepted_answers, letter)
values (
  true,
  array['piano', 'a piano'],
  jsonb_build_object(
    'title', 'A letter for you',
    'greeting', 'Dear sweetheart,',
    'paragraphs', jsonb_build_array(
      'This is a placeholder letter stored safely on the server. Replace it in the editor under "Portal & letter".',
      'It is only sent to a visitor after the right answer is given at the portal.',
      'Happy 25th birthday.'
    ),
    'signature', 'With love, me'
  )
)
on conflict do nothing;

-- -------------------------------------------------------------- helpers ----

create or replace function private.normalize_answer(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- lower-case, strip accents (via unaccent-free translate of common marks),
  -- turn punctuation into spaces and collapse whitespace. Mirrors normalizeAnswer() in the app.
  select trim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p, ''),
        'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿÑñÇç',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuYyyNnCc')),
      '[^[:alnum:][:space:]]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

create or replace function private.too_many_attempts(p_uid uuid, p_kind text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from private.attempts where created_at < now() - interval '1 day';
  select count(*) into n from private.attempts
   where user_id = p_uid and kind = p_kind and created_at > now() - p_window;
  if n >= p_limit then
    return true;
  end if;
  insert into private.attempts (user_id, kind) values (p_uid, p_kind);
  return false;
end
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.room_slots where user_id = (select auth.uid()))
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.owners where user_id = (select auth.uid()))
$$;

-- ----------------------------------------------------------------- RPCs ----

-- Public: tells the entrance screen whether to ask for a shared access code.
create or replace function public.room_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('access_code_required', access_code_hash is not null)
  from private.app_secrets where id
$$;

-- Claims (or re-claims) a participant slot. Two slots exist, so at most two
-- people are members at once. A slot held by someone else is only taken over
-- when its holder has been silent for 90 seconds (e.g. switched devices).
create or replace function public.join_room(p_role text, p_access_code text default null, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_slot public.room_slots;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_role not in ('me', 'sweetheart') then
    return jsonb_build_object('ok', false, 'reason', 'bad_role');
  end if;

  select access_code_hash into v_hash from private.app_secrets where id;
  if v_hash is not null then
    if private.too_many_attempts(v_uid, 'join', 20, interval '10 minutes') then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited');
    end if;
    if p_access_code is null
       or extensions.crypt(private.normalize_answer(p_access_code), v_hash) <> v_hash then
      return jsonb_build_object('ok', false, 'reason', 'bad_code');
    end if;
  end if;

  select * into v_slot from public.room_slots where role = p_role for update;
  if v_slot.user_id is not null
     and v_slot.user_id <> v_uid
     and v_slot.last_seen is not null
     and v_slot.last_seen > now() - interval '90 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'slot_busy');
  end if;

  -- one person, one slot
  update public.room_slots set user_id = null, last_seen = null, display_name = null
   where user_id = v_uid and role <> p_role;
  update public.room_slots
     set user_id = v_uid, display_name = left(coalesce(p_display_name, p_role), 40), last_seen = now()
   where role = p_role;

  return jsonb_build_object('ok', true, 'is_owner', exists (select 1 from public.owners where user_id = v_uid));
end
$$;

create or replace function public.heartbeat()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.room_slots set last_seen = now() where user_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- Marks the slot as free to take over immediately (keeps the binding otherwise).
create or replace function public.leave_room()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_slots set last_seen = null where user_id = (select auth.uid())
$$;

-- The only way to read the letter: a correct answer from a room member.
create or replace function public.verify_portal(p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret private.portal_secret;
  v_norm text := private.normalize_answer(p_answer);
  v_hint text;
begin
  if v_uid is null or not public.is_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if private.too_many_attempts(v_uid, 'portal', 30, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  select * into v_secret from private.portal_secret where id;
  if v_norm <> '' and exists (
    select 1 from unnest(v_secret.accepted_answers) a where private.normalize_answer(a) = v_norm
  ) then
    return jsonb_build_object('ok', true, 'letter', v_secret.letter);
  end if;
  select hint into v_hint from public.portal_public where id;
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'hint', v_hint);
end
$$;

create or replace function public.claim_owner(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
begin
  if v_uid is null then
    return false;
  end if;
  if private.too_many_attempts(v_uid, 'owner', 10, interval '10 minutes') then
    raise exception 'Too many tries. Please wait a few minutes.';
  end if;
  select owner_code_hash into v_hash from private.app_secrets where id;
  if v_hash is null then
    raise exception 'No owner code is set yet. Run supabase/setup_codes.sql in the SQL editor first.';
  end if;
  if p_code is null or extensions.crypt(p_code, v_hash) <> v_hash then
    return false;
  end if;
  insert into public.owners (user_id) values (v_uid) on conflict do nothing;
  return true;
end
$$;

create or replace function public.am_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner()
$$;

create or replace function public.owner_get_portal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can do that.' using errcode = '42501';
  end if;
  select jsonb_build_object('clue', p.clue, 'hint', p.hint, 'accepted_answers', s.accepted_answers, 'letter', s.letter)
    into r
    from public.portal_public p cross join private.portal_secret s
   where p.id and s.id;
  return r;
end
$$;

create or replace function public.owner_save_portal(p_clue text, p_hint text, p_answers text[], p_letter jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can do that.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_answers, 1), 0) = 0 then
    raise exception 'Add at least one accepted answer.';
  end if;
  if jsonb_typeof(p_letter -> 'paragraphs') <> 'array' then
    raise exception 'The letter needs paragraphs.';
  end if;
  update public.portal_public set clue = left(coalesce(p_clue, ''), 600), hint = left(coalesce(p_hint, ''), 300), updated_at = now() where id;
  update private.portal_secret set accepted_answers = p_answers, letter = p_letter, updated_at = now() where id;
end
$$;

-- Replaces the whole gallery in one transaction (simple, keeps order consistent).
create or replace function public.owner_save_photos(p_photos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can do that.' using errcode = '42501';
  end if;
  if jsonb_array_length(p_photos) > 24 then
    raise exception 'The hall fits at most 24 photos.';
  end if;
  delete from public.photos where id not in (select (e ->> 'id')::uuid from jsonb_array_elements(p_photos) e);
  insert into public.photos (id, storage_path, caption, wall, sort_order, aspect, updated_at)
  select (e ->> 'id')::uuid, e ->> 'storage_path', left(coalesce(e ->> 'caption', ''), 280), e ->> 'wall',
         coalesce((e ->> 'sort_order')::int, 0), coalesce((e ->> 'aspect')::real, 1.5), now()
    from jsonb_array_elements(p_photos) e
  on conflict (id) do update
    set storage_path = excluded.storage_path, caption = excluded.caption, wall = excluded.wall,
        sort_order = excluded.sort_order, aspect = excluded.aspect, updated_at = now();
end
$$;

create or replace function public.owner_set_access_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can do that.' using errcode = '42501';
  end if;
  update private.app_secrets
     set access_code_hash = case when nullif(trim(coalesce(p_code, '')), '') is null then null
                                 else extensions.crypt(private.normalize_answer(p_code), extensions.gen_salt('bf')) end
   where id;
end
$$;

-- ------------------------------------------------------------ privileges ----

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.room_info(), public.join_room(text, text, text), public.heartbeat(), public.leave_room(),
  public.verify_portal(text), public.claim_owner(text), public.am_owner(), public.owner_get_portal(),
  public.owner_save_portal(text, text, text[], jsonb), public.owner_save_photos(jsonb),
  public.owner_set_access_code(text), public.is_member(), public.is_owner()
  from public, anon;
grant execute on function
  public.room_info(), public.join_room(text, text, text), public.heartbeat(), public.leave_room(),
  public.verify_portal(text), public.claim_owner(text), public.am_owner(), public.owner_get_portal(),
  public.owner_save_portal(text, text, text[], jsonb), public.owner_save_photos(jsonb),
  public.owner_set_access_code(text), public.is_member(), public.is_owner()
  to authenticated;

-- ------------------------------------------------------------------ RLS ----

alter table public.room_slots enable row level security;
alter table public.owners enable row level security;
alter table public.portal_public enable row level security;
alter table public.photos enable row level security;

drop policy if exists "members see slots" on public.room_slots;
create policy "members see slots" on public.room_slots for select to authenticated using ((select public.is_member()));

drop policy if exists "see own owner row" on public.owners;
create policy "see own owner row" on public.owners for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members read clue" on public.portal_public;
create policy "members read clue" on public.portal_public for select to authenticated using ((select public.is_member()));

drop policy if exists "members view photos" on public.photos;
create policy "members view photos" on public.photos for select to authenticated using ((select public.is_member()));
-- writes go through owner_save_photos(); no direct insert/update/delete policies.

revoke all on public.room_slots, public.owners, public.portal_public, public.photos from anon;
revoke insert, update, delete on public.room_slots, public.owners, public.portal_public, public.photos from authenticated;
grant select on public.room_slots, public.owners, public.portal_public, public.photos to authenticated;

-- -------------------------------------------------------------- storage ----

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "olw members read gallery" on storage.objects;
create policy "olw members read gallery" on storage.objects for select to authenticated
  using (bucket_id = 'gallery' and (select public.is_member()));

drop policy if exists "olw owner uploads gallery" on storage.objects;
create policy "olw owner uploads gallery" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_owner()));

drop policy if exists "olw owner updates gallery" on storage.objects;
create policy "olw owner updates gallery" on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner()));

drop policy if exists "olw owner deletes gallery" on storage.objects;
create policy "olw owner deletes gallery" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner()));

-- ------------------------------------------------- realtime authorization ----
-- Private channels: only room members may join "room:*" topics, for both
-- broadcast and presence.

drop policy if exists "olw members receive" on realtime.messages;
create policy "olw members receive" on realtime.messages for select to authenticated
  using ((select realtime.topic()) like 'room:%' and (select public.is_member()));

drop policy if exists "olw members send" on realtime.messages;
create policy "olw members send" on realtime.messages for insert to authenticated
  with check ((select realtime.topic()) like 'room:%' and (select public.is_member()));
