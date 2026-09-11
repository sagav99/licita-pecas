# Log de ciclos autônomos

Cada passagem registra uma tarefa pequena, reversível e validada localmente. Integrações externas, deploy e uso de credenciais permanecem pendentes.

Após o encerramento das oito passagens agendadas, o desenvolvimento voltou ao modo contínuo por solicitação do usuário.

## Passagem 1 — 2026-09-10

- Fluxo revisado: catálogo → match → evidência → decisão → alerta.
- Implementado contrato determinístico de idempotência em `domain/dedupe.ts`.
- Adicionados testes para editais, documentos e alertas.
- Decisões pendentes: índices únicos no Supabase e política final de versionamento dependem da criação do projeto; não executados.

## Passagem 2 — 2026-09-10

- Fluxo revisado: fonte oficial → identidade por fonte → documento → evento de alteração → alerta.
- Implementado contrato de ingestão em `domain/ingestion.ts` para mudanças de hash e campos relevantes.
- Adicionados testes para reprocessamento idempotente e preservação de versões.
- Decisões pendentes: persistência transacional e índices únicos continuam dependentes do schema Supabase.

## Passagem 3 — 2026-09-11

- Fluxo revisado: requisitos extraídos → sinais técnicos/logísticos → decisão → motivo visível.
- Implementado `domain/matching.ts` com decisões por vertical, bloqueios e campos ausentes.
- Adicionados testes para Licita Peças, Licita Água e bloqueio operacional.
- Nenhuma precisão falsa foi adicionada: dados incompletos continuam em `sem dados suficientes`.

## Continuação direta — 2026-09-11

- Implementada coleta PNCP paginada, limitada e deduplicada, com proteção contra página repetida e fixture de contrato.
- Implementado planejador de alertas que transforma novo match, retificação, reclassificação e prazo em eventos deduplicáveis com fonte oficial.
- Adicionada migration operacional com documentos versionados, lotes, itens, fontes, perfil, preferências, feedback e importações.
- Adicionadas policies RLS e plano de mitigação da migration.
- Validação completa aprovada com 38 testes e auditoria sem vulnerabilidades.

## Passagem 4 — 2026-09-11

- Fluxo revisado: mudança/prazo → preferências da organização → dedupe → entrega.
- Implementado `domain/alerts.ts` para opt-out global, tipos habilitados e janela de 48 horas.
- Adicionados testes que impedem envio quando o cliente opta por não receber e-mails.
- Entrega real de e-mail continua pendente de provedor e segredo externo; o contrato não envia nada.

## Passagem 5 — 2026-09-11

- Fluxo revisado: organização → catálogo → oportunidades → matches → alertas isolados.
- Adicionada `supabase/migrations/0001_initial.sql` com schema MVP, constraints de dedupe e políticas RLS.
- A migration é apenas artefato versionado; não foi executada em nenhum projeto ou banco.
- Pendente: revisar papéis administrativos e aplicar em um projeto Supabase real quando houver credenciais e decisão de rollout.

## Passagem 6 — 2026-09-11

- Fluxo revisado: texto extraído → adapter Gemini → JSON estruturado → evidência → match.
- Implementado adapter Gemini injetável, sem chave embutida e sem chamada externa no ambiente local.
- Saída inválida ou sem trecho de prova é rejeitada antes de chegar ao motor de decisão.

## Passagem 7 — 2026-09-11

- Fluxo revisado: documento oficial → texto nativo → OCR apenas quando necessário → Gemini.
- Criado `integrations/documents/extractor.ts` com leitores injetáveis e estado do método usado.
- Documento sem texto após os dois caminhos é rejeitado, evitando análise sem fonte legível.

## Passagem 8 — 2026-09-11

- Fluxo revisado: organização → oportunidade salva → estado de trabalho → remoção isolada.
- Criado `data/repository.ts` com interface mockável e implementação em memória para desenvolvimento/testes.
- Testes confirmam isolamento entre organizações e operações idempotentes.
- Pendências que exigem decisão/ambiente externo: conectar Supabase real, configurar Storage, provider de e-mail e chave Gemini.
