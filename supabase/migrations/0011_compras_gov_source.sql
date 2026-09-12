insert into public.sources (
  source_key, name, type, base_url, active, schedule, health_status
)
values (
  'compras-gov',
  'Compras.gov.br — Dados Abertos',
  'compras-gov',
  'https://dadosabertos.compras.gov.br',
  true,
  'hourly',
  'healthy'
)
on conflict (type, base_url) do update set
  source_key = excluded.source_key,
  name = excluded.name,
  active = excluded.active,
  schedule = excluded.schedule;

-- Mitigação: desativar esta fonte interrompe a coleta sem apagar oportunidades
-- ou o histórico de saúde já registrado.

