# ADR 0001 — stack e arquitetura do MVP

- Status: aceito
- Data: 2026-09-10
- Atualizado por decisão do produto em 2026-09-10

## Contexto

O MVP precisa combinar interface rica, autenticação, dados relacionais multiempresa, arquivos de catálogo/editais e leitura assistida de documentos. O produto também precisa começar com baixo custo e permitir validação antes de automações mais caras.

## Decisão

Usar:

- Next.js/React/TypeScript com deploy na Vercel;
- Supabase Postgres para dados relacionais;
- Supabase Auth para identidade;
- Supabase Storage para catálogos e documentos;
- Gemini API no tier gratuito para extração assistida, sempre atrás de uma interface de domínio e com evidência original preservada.

Organizar regras puras em `domain/`, composição em `app/` e integrações futuras em `integrations/`. Toda tabela pertencente a cliente terá `organization_id`, RLS e policies negativas testadas. Chaves de serviço e Gemini existirão apenas no servidor.

## Consequências

- Vercel e Supabase formam o caminho oficial de produção;
- o protótipo de interface permanece desacoplado e usa dados demonstrativos até a etapa de integração;
- o schema inicial será PostgreSQL e suas migrations serão geridas pelo Supabase CLI;
- o tier gratuito do Gemini pode ter limites e indisponibilidade; a coleta não poderá depender de inferência síncrona para registrar o edital;
- texto nativo e OCR precedem Gemini; a saída do modelo nunca substitui a evidência original;
- preços, quotas e termos dos fornecedores devem ser revistos antes do lançamento.

## Rollback/mitigação

As regras de domínio e adaptadores de coleta não dependem dos provedores. Gemini ficará atrás de um contrato substituível. Migrations usarão expansão e forward-fix. Se o tier gratuito não sustentar o piloto, o processamento deve pausar e formar fila, sem descartar documentos ou gerar classificação sem evidência.
