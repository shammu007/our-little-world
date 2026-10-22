-- Run this ONCE in Supabase → SQL Editor after the migration.
-- Replace the example values first. Codes are stored as bcrypt hashes.
-- Do not commit your real codes anywhere.

-- 1) Owner code: unlocks the in-game editor (photos, clue, answers, letter).
update private.app_secrets
   set owner_code_hash = extensions.crypt('REPLACE-WITH-A-LONG-OWNER-CODE', extensions.gen_salt('bf'))
 where id;

-- 2) Optional shared access code typed at the entrance. Leave this commented out for no code.
-- update private.app_secrets
--    set access_code_hash = extensions.crypt(private.normalize_answer('REPLACE-WITH-ACCESS-CODE'), extensions.gen_salt('bf'))
--  where id;

-- Handy resets:
-- update public.room_slots set user_id = null, last_seen = null, display_name = null;  -- free both participant slots
-- delete from public.owners;                                                            -- forget all owner devices
