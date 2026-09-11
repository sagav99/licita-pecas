# Licita Peças SaaS

Fatia vertical do MVP de radar comercial para distribuidoras de autopeças. A interface prioriza oportunidades por aderência ao catálogo e sempre mostra motivos, evidência e acesso à fonte oficial.

## Entregue nesta versão

- radar responsivo com busca, filtro, score explicável e estados comerciais;
- seleção, salvamento e triagem de oportunidades em uma experiência navegável;
- importação de CSV/XLSX com conferência, revalidação no servidor, arquivo privado no Storage e upsert no Postgres;
- regra de match pura e testada, incluindo bloqueio operacional e ausência de dados;
- geração preliminar idempotente de matches por catálogo, região, valor e prazo;
- coleta PNCP paginada, limitada e deduplicada, com persistência em lotes, lease e saúde da fonte;
- ingestão idempotente, versionamento de documentos e eventos de mudança;
- planejador de alertas com opt-out, prazo, retificação e link oficial;
- pipeline server-side de PDF com texto nativo, OCR Gemini somente como fallback e estruturação com evidência;
- migrations Supabase com núcleo operacional e RLS multiempresa;
- navegação entre radar, oportunidades salvas, catálogo e alertas;
- arquitetura definida para Vercel, Supabase Auth/Postgres/Storage e Gemini API;
- ferramenta WebMCP de filtro, quando o navegador oferecer suporte.

Os editais exibidos ainda são dados demonstrativos sanitizados. Autenticação, onboarding e persistência de catálogo usam o Supabase configurado; coleta recorrente, OCR e envio real de alertas permanecem pendentes.

## Rodar localmente

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Verificação

```bash
npm run verify
```

O frontend usa Next.js e está pronto para preview ou deploy na Vercel. As variáveis previstas estão documentadas em `.env.example`, sem valores ou credenciais.

## Coleta PNCP

O executor administrativo usa `SUPABASE_SECRET_KEY` exclusivamente no
servidor. Com a credencial configurada, uma execução manual pode ser validada
com `npm run pncp:collect`. Por padrão, o piloto consulta pregões eletrônicos,
pregões presenciais e dispensas do dia em horário de Brasília. O filtro inicial
é deliberadamente amplo; a decisão de aderência continua no motor explicável.

O agendamento recorrente ainda não está ativo. Não exponha o comando ou a chave
administrativa em uma rota autenticada de cliente.

## Limites de segurança

- toda consulta do Supabase deverá incluir isolamento por `organization_id` e RLS;
- não confiar em `organization_id` enviado pelo navegador;
- arquivos deverão ser limitados por tipo e tamanho antes de ir ao Supabase Storage;
- uploads seguem direto do navegador para o Storage por URL assinada; a Function recebe apenas metadados e revalida o arquivo armazenado, evitando o limite de payload da Vercel;
- `SUPABASE_SECRET_KEY` e `GEMINI_API_KEY` nunca poderão chegar ao navegador;
- segredos permanecem fora do código e seus nomes ficam em `.env.example`;
- resumos e scores apoiam triagem comercial, não habilitação ou análise jurídica;
- a fonte oficial do edital sempre prevalece.

## Referências de integração

A implementação futura do conector deve seguir a [documentação oficial da API do PNCP](https://pncp.gov.br/api/pncp/swagger-ui/index.html?configUrl=%2Fpncp-api%2Fv3%2Fapi-docs%2Fswagger-config) e o [Manual de Integração](https://pncp.gov.br/manual/pt-br/latest/singlehtml/index.html), validados em setembro de 2026.
