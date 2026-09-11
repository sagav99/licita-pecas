# Licita Peças SaaS

Fatia vertical do MVP de radar comercial para distribuidoras de autopeças. A interface prioriza oportunidades por aderência ao catálogo e sempre mostra motivos, evidência e acesso à fonte oficial.

## Entregue nesta versão

- radar responsivo com busca, filtro, score explicável e estados comerciais;
- seleção, salvamento e triagem de oportunidades em uma experiência navegável;
- importação local de CSV/XLSX com detecção de cabeçalhos e conferência antes da gravação;
- regra de match pura e testada, incluindo bloqueio operacional e ausência de dados;
- coleta PNCP paginada, limitada e deduplicada com fixture sanitizada;
- ingestão idempotente, versionamento de documentos e eventos de mudança;
- planejador de alertas com opt-out, prazo, retificação e link oficial;
- migrations Supabase com núcleo operacional e RLS multiempresa;
- navegação entre radar, oportunidades salvas, catálogo e alertas;
- arquitetura definida para Vercel, Supabase Auth/Postgres/Storage e Gemini API;
- ferramenta WebMCP de filtro, quando o navegador oferecer suporte.

Os editais e produtos exibidos são dados demonstrativos sanitizados. Os contratos de Supabase, Gemini, coleta PNCP, OCR e alertas estão implementados e testados localmente; execução recorrente, persistência e envio real serão conectados quando existirem credenciais e ambiente configurado.

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

## Limites de segurança

- toda consulta do Supabase deverá incluir isolamento por `organization_id` e RLS;
- não confiar em `organization_id` enviado pelo navegador;
- arquivos deverão ser limitados por tipo e tamanho antes de ir ao Supabase Storage;
- `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` nunca poderão chegar ao navegador;
- segredos permanecem fora do código e seus nomes ficam em `.env.example`;
- resumos e scores apoiam triagem comercial, não habilitação ou análise jurídica;
- a fonte oficial do edital sempre prevalece.

## Referências de integração

A implementação futura do conector deve seguir a [documentação oficial da API do PNCP](https://pncp.gov.br/api/pncp/swagger-ui/index.html?configUrl=%2Fpncp-api%2Fv3%2Fapi-docs%2Fswagger-config) e o [Manual de Integração](https://pncp.gov.br/manual/pt-br/latest/singlehtml/index.html), validados em setembro de 2026.
