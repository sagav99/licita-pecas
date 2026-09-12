# Changelog

## Unreleased

### Added

- Coletor PNCP paginado, limitado e deduplicado, com fixture sanitizada de contrato.
- Planejador de alertas para novo match, retificação, reclassificação e prazo próximo, sempre deduplicado e com fonte oficial.
- Migration operacional para documentos versionados, fontes, lotes, itens, perfil, preferências, feedback e importações, com RLS e plano de mitigação.
- Buckets privados de catálogos e editais com limites de arquivo e políticas de acesso por organização.
- Cliente Gemini oficial no servidor com JSON Schema, conteúdo não confiável isolado e verificação segura de conectividade.
- Autenticação Supabase SSR, renovação por cookies, login/cadastro e onboarding transacional de organizações.
- Ingestão limitada de documentos oficiais do PNCP com validação de host/PDF/tamanho, Storage privado, hash e evento transacional de versão.
- Processamento assíncrono e limitado de PDFs com texto nativo/OCR, estrutura Gemini e preservação de progresso entre falhas.
- Matching enriquecido por OEM, marca, aplicação e trecho verificado dos documentos processados.
- Snapshots estruturados de itens do PNCP, com hash, inativação auditável e uso direto pelo matcher.
- Estado comercial persistente e isolado por organização para oportunidades salvas e etapas de avaliação.
- Descoberta complementar pelo Compras.gov.br, limitada, deduplicada com o PNCP e monitorada separadamente.

- Chaves determinísticas para impedir duplicidade de editais, versões de documentos e alertas.
- Contrato de ingestão para comparar hashes, emitir eventos de alteração e preservar versões.
- Decisão de aderência configurável por vertical, com bloqueios e dados ausentes explícitos.
- Contrato local de alertas com opt-out, janela de prazo e `dedupe_key`.
- Migration inicial versionada com entidades do MVP, constraints de idempotência e RLS por organização.
- Adapter Gemini injetável com validação de JSON e evidência antes de aceitar uma extração.
- Adapter de documentos que prioriza texto nativo e usa OCR apenas como fallback.
- Repositório em memória para testar persistência de oportunidades sem credenciais ou banco real.
- Radar explicável com filtros, oportunidades salvas, catálogo e preferências de alerta.
- Contratos de domínio para catálogo, PNCP e extração assistida por Gemini.
- Preparação de ambiente para Vercel, Supabase e Gemini sem segredos versionados.

### Changed

- Stack de execução definida como Next.js/Vercel; a preparação anterior para Cloudflare/D1/R2 foi removida.
- Catálogo e alertas deixaram de apresentar exemplos fixos: agora usam dados da organização, estados vazios honestos e preferências persistidas pela sessão autenticada; o radar ganhou filtros reais de UF, valor, prazo e score.
- Documentos longos usam seleção limitada de trechos sem descartar o texto integral; a análise parcial fica auditável e rebaixa o match para revisão humana.
- Perfil de fornecimento permite configurar UFs, raio, marcas, categorias e termos de revisão; as regras aplicáveis passam a orientar o match da organização.
- O cliente pode avaliar a qualidade de cada match com motivo opcional, preservando isolamento entre organizações e sem alterar a decisão automaticamente.
