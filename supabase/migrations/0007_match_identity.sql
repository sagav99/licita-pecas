alter table public.matches
  add column if not exists match_key text,
  add column if not exists missing_data jsonb not null default '[]'::jsonb;

create unique index if not exists matches_match_key_unique
  on public.matches (match_key)
  where match_key is not null;

-- Rollback preferencial: interromper o job. As colunas são expansivas e devem
-- permanecer se já houver matches; o índice pode ser removido sem apagar dados.
