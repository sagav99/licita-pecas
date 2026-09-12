-- Transparência sobre extrações parciais de documentos longos. O PDF e o
-- texto nativo/OCR integral permanecem armazenados.
alter table public.procurement_documents
  add column if not exists structuring_scope text
    check (structuring_scope is null or structuring_scope in ('full', 'selected_excerpts')),
  add column if not exists structuring_input_characters integer
    check (structuring_input_characters is null or structuring_input_characters >= 0);

comment on column public.procurement_documents.structuring_scope is
  'full: todo o texto foi enviado ao extrator; selected_excerpts: amostra priorizada de documento longo.';

