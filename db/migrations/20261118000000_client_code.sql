-- Client code (avatar_text): canonical 1-4 uppercase A-Z0-9 identifier.
-- Run scripts/backfill-client-codes.ts before applying this migration so
-- existing values are normalized, duplicates resolved, and missing codes set.
--
-- After the backfill has been verified, `set not null` can be added in a
-- follow-up migration to guarantee every client has a code.

create unique index if not exists clients_avatar_text_unique
  on public.clients (upper(avatar_text))
  where avatar_text is not null;

alter table public.clients
  add constraint clients_avatar_text_format
  check (avatar_text is null or avatar_text ~ '^[A-Z0-9]{1,4}$');
