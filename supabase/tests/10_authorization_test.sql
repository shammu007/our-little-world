-- Authorization tests for the migration. Run with scripts/test-sql.sh.
\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- owner (me)
  ('00000000-0000-0000-0000-00000000000b'),  -- sweetheart
  ('00000000-0000-0000-0000-00000000000c'),  -- a stranger with the link
  ('00000000-0000-0000-0000-00000000000d');  -- sweetheart on a new phone

update private.app_secrets set owner_code_hash = extensions.crypt('owner-secret', extensions.gen_salt('bf')) where id;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('realtime.topic', 'room:our-little-world', false);
end $$;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;

-- ---------- anonymous visitor (no auth) cannot do anything ----------
set role anon;
select pg_temp.assert((select count(*) from information_schema.role_routine_grants where routine_name = 'verify_portal' and grantee = 'anon') = 0, 'anon cannot call verify_portal');
do $$ begin
  begin
    perform public.verify_portal('piano');
    raise exception 'anon called verify_portal';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'anon blocked from RPCs');
do $$ begin
  begin
    perform * from private.portal_secret;
    raise exception 'anon read private';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'anon cannot read private schema');
reset role;

-- ---------- a signed-in non-member sees nothing ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.assert((select count(*) from public.portal_public) = 0, 'non-member cannot read clue');
select pg_temp.assert((select count(*) from public.photos) = 0, 'non-member cannot list photos');
select pg_temp.assert((public.verify_portal('piano') ->> 'reason') = 'not_member', 'non-member cannot verify portal');
select pg_temp.assert((select count(*) from realtime.messages) = 0 and not public.is_member(), 'non-member has no realtime access');
do $$ begin
  begin
    insert into realtime.messages (topic, extension) values ('room:our-little-world', 'broadcast');
    raise exception 'non-member broadcast';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'non-member cannot broadcast');
do $$ begin
  begin
    perform * from private.portal_secret;
    raise exception 'read private';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'authenticated cannot read private schema directly');
reset role;

-- ---------- two participants join ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.assert((public.join_room('me', null, 'Me') ->> 'ok')::boolean, 'owner joins as me');
select pg_temp.assert(public.is_member(), 'owner is member');
select pg_temp.assert((select count(*) from public.portal_public) = 1, 'member reads clue');
select pg_temp.assert(public.heartbeat(), 'heartbeat keeps slot');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert((public.join_room('sweetheart', null, 'Sweetheart') ->> 'ok')::boolean, 'sweetheart joins');
reset role;

-- ---------- a third person cannot take an active slot ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.assert((public.join_room('sweetheart') ->> 'reason') = 'slot_busy', 'stranger cannot take active sweetheart slot');
select pg_temp.assert((public.join_room('me') ->> 'reason') = 'slot_busy', 'stranger cannot take active me slot');
select pg_temp.assert(not public.is_member(), 'stranger still not a member');
reset role;

-- ---------- portal: wrong answer gets a hint, never the letter ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert(public.verify_portal('guitar') ->> 'ok' = 'false' and public.verify_portal('guitar') -> 'letter' is null, 'wrong answer: no letter');
select pg_temp.assert(public.verify_portal('guitar') ->> 'hint' is not null, 'wrong answer: hint returned');
select pg_temp.assert(public.verify_portal('  PIANO!! ') -> 'letter' ->> 'title' = 'A letter for you', 'correct answer (loose match) returns letter');
select pg_temp.assert(public.verify_portal('') ->> 'ok' = 'false', 'empty answer rejected');
-- member but not owner cannot edit
do $$ begin
  begin
    perform public.owner_get_portal();
    raise exception 'non-owner read secret';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'non-owner cannot read portal secret via owner RPC');
do $$ begin
  begin
    insert into public.photos (storage_path) values ('x');
    raise exception 'non-owner inserted photo';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'members cannot write photos directly');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('gallery', 'photos/evil.jpg');
    raise exception 'non-owner uploaded';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'non-owner cannot upload to gallery bucket');
select pg_temp.assert(public.claim_owner('wrong') = false, 'wrong owner code rejected');
select pg_temp.assert(not public.is_owner(), 'still not owner');
insert into realtime.messages (topic, extension) values ('room:our-little-world', 'broadcast');
select pg_temp.assert(true, 'member can broadcast in room topic');
reset role;

-- ---------- owner flow ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.assert(public.claim_owner('owner-secret'), 'owner code accepted');
select pg_temp.assert(public.am_owner(), 'am_owner true');
select public.owner_save_portal('New clue', 'New hint', array['Moon River'], '{"title":"T","greeting":"G","paragraphs":["p1"],"signature":"S"}'::jsonb);
select pg_temp.assert(public.owner_get_portal() ->> 'clue' = 'New clue', 'owner saved portal');
insert into storage.objects (bucket_id, name) values ('gallery', 'photos/a.jpg');
select pg_temp.assert(true, 'owner can upload to gallery bucket');
select public.owner_save_photos('[{"id":"11111111-1111-1111-1111-111111111111","storage_path":"photos/a.jpg","caption":"hi","wall":"back","sort_order":0,"aspect":1.5},{"id":"22222222-2222-2222-2222-222222222222","storage_path":"bundle:placeholders/memory-01.svg","caption":"","wall":"left","sort_order":0,"aspect":1.5}]'::jsonb);
select pg_temp.assert((select count(*) from public.photos) = 2, 'owner saved 2 photos');
select public.owner_save_photos('[{"id":"11111111-1111-1111-1111-111111111111","storage_path":"photos/a.jpg","caption":"changed","wall":"right","sort_order":3,"aspect":1.5}]'::jsonb);
select pg_temp.assert((select count(*) from public.photos) = 1 and (select caption from public.photos) = 'changed', 'save replaces gallery');
select public.owner_set_access_code('Our Secret');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert(public.verify_portal('moon river!') -> 'letter' ->> 'title' = 'T', 'new answer works for sweetheart');
select pg_temp.assert(public.verify_portal('piano') -> 'letter' is null, 'old answer no longer works');
select pg_temp.assert((select count(*) from public.photos) = 1, 'member sees saved photo');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'gallery') = 1, 'member can read gallery objects');
select pg_temp.assert((public.room_info() ->> 'access_code_required')::boolean, 'access code now required');
reset role;

-- ---------- slot takeover after silence, with access code ----------
update public.room_slots set last_seen = now() - interval '5 minutes' where role = 'sweetheart';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.assert((public.join_room('sweetheart', 'nope') ->> 'reason') = 'bad_code', 'wrong access code rejected');
select pg_temp.assert((public.join_room('sweetheart', ' our secret ') ->> 'ok')::boolean, 'new device takes over a stale slot with the code');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.assert(not public.heartbeat(), 'old device learns it lost the slot');
select pg_temp.assert(not public.is_member(), 'old device no longer a member');
select pg_temp.assert((select count(*) from public.photos) = 0, 'old device can no longer read photos');
reset role;

-- ---------- rate limiting ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
set role authenticated;
do $$
declare i int; r jsonb;
begin
  for i in 1..40 loop r := public.verify_portal('wrong ' || i); end loop;
  if r ->> 'reason' <> 'rate_limited' then raise exception 'FAILED: expected rate limit, got %', r; end if;
  raise notice 'ok - portal guesses are rate limited';
end $$;
reset role;

select 'ALL SQL AUTHORIZATION TESTS PASSED' as result;
