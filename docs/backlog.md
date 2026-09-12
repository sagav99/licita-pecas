# Backlog do produto

## P0 — validação assistida

- [x] experiência de radar com decisão explicável;
- [x] leitura de CSV/XLSX e conferência de cabeçalhos;
- [x] regra inicial de match e contrato multiempresa;
- [x] telas de salvas, catálogo e preferências de alerta;
- [x] substituir dados demonstrativos de catálogo e alertas por consultas isoladas da organização;
- [x] persistir oportunidades salvas e etapas do funil comercial com RLS;
- [x] decisão de stack: Vercel + Supabase + Gemini;
- [x] autenticação SSR por cookies e onboarding transacional de organização;
- [x] escrever migration inicial Supabase com schema mínimo, constraints e RLS (aplicação em projeto ainda pendente);
- [x] persistir catálogo validado no Postgres e arquivo original no Storage;
- [x] integrar descoberta PNCP com paginação, deduplicação e execução recorrente horária;
- [x] configurar a API Compras.gov.br como complemento PNCP com lease e backoff independentes;
- [ ] conectar fonte oficial externa ao ecossistema PNCP/Compras.gov.br para ampliar cobertura;
- [x] definir chaves determinísticas de idempotência para editais, documentos e alertas;
- [x] detectar versões de documentos e campos alterados sem apagar o histórico;
- [x] buscar PDFs oficiais do PNCP em lote limitado, persistir hash/arquivo privado e emitir evento de versão;
- [x] expor decisão de match por vertical com motivos, bloqueios e dados ausentes;
- [x] decidir alertas por opt-out, tipo habilitado e chave de deduplicação;
- [x] encapsular Gemini em adapter injetável com validação de JSON/evidência;
- [x] abstrair leitura nativa de PDF e fallback OCR sem acoplar fornecedor;
- [x] criar repositório em memória mockável com isolamento por organização;
- [x] extrair PDF nativo e acionar OCR somente quando necessário;
- [x] processar fila limitada com Gemini, persistindo texto antes da estruturação, evidência e falha segura;
- [x] incorporar OEM, marca, aplicação e evidência documental ao match resumido;
- [x] coletar itens oficiais do PNCP e incorporar códigos, descrição, quantidade e unidade ao motor;
- [x] criar motor de alertas de novo edital, mudança e prazo com opt-out (entrega por e-mail ainda pendente);
- [ ] validar com 5–10 distribuidores e medir precisão/ruído.

## P1 — operação do piloto

- [ ] completar tela de perfil logístico, marcas e exclusões (organização e schema conectados);
- [ ] histórico de versões e diff de retificações;
- [ ] conectar feedback de qualidade por match (schema e isolamento prontos);
- [ ] observabilidade de fontes, filas e custos;
- [ ] política de retenção, backup/restauração e resposta a incidente;
- [ ] E2E das jornadas de importação, filtro, decisão e isolamento entre organizações.

## Fora do primeiro piloto

- cobrança, WhatsApp, robô de lances, parecer jurídico, todos os ERPs e lançamento simultâneo de outros verticais.
