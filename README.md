# Licita Peças SaaS

Fatia vertical do MVP de radar comercial para distribuidoras de autopeças. A interface prioriza oportunidades por aderência ao catálogo e sempre mostra motivos, evidência e acesso à fonte oficial.

## Entregue nesta versão

- radar responsivo com busca, filtro, score explicável e estados comerciais;
- seleção, salvamento e triagem persistente de oportunidades por organização;
- importação de CSV/XLSX com conferência, revalidação no servidor, arquivo privado no Storage e upsert no Postgres;
- regra de match pura e testada, incluindo bloqueio operacional e ausência de dados;
- geração preliminar idempotente de matches por catálogo, região, valor e prazo;
- coleta PNCP paginada, limitada e deduplicada, com persistência em lotes, lease e saúde da fonte;
- descoberta complementar limitada pela API oficial do Compras.gov.br, com saúde própria e identidade PNCP compartilhada;
- coleta limitada de editais e termos de referência do PNCP, com PDF privado, hash, versões imutáveis e eventos de mudança;
- snapshots estruturados de itens do PNCP, com descrição, códigos, quantidade, unidade e histórico lógico;
- ingestão idempotente, versionamento de documentos e eventos de mudança;
- planejador de alertas com opt-out, prazo, retificação e link oficial;
- pipeline server-side de PDF com texto nativo, OCR Gemini somente como fallback e estruturação com evidência;
- migrations Supabase com núcleo operacional e RLS multiempresa;
- navegação entre radar, oportunidades salvas, catálogo e alertas;
- catálogo, métricas, preferências e atividade de alertas exibidos a partir dos dados isolados da organização;
- arquitetura definida para Vercel, Supabase Auth/Postgres/Storage e Gemini API;
- ferramenta WebMCP de filtro, quando o navegador oferecer suporte.

O radar autenticado usa somente dados permitidos para a organização pelo Supabase. O envio real de alertas e uma fonte fora do ecossistema PNCP/Compras.gov.br permanecem pendentes.

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

O GitHub Actions executa coleta e matching a cada hora, com lease no banco e
concorrência serializada. Os mesmos comandos permanecem disponíveis para
execução manual. Não exponha a chave administrativa em uma rota de cliente.

O mesmo workflow verifica um lote pequeno de documentos oficiais com
`npm run pncp:documents`. Somente URLs HTTPS do domínio do PNCP são aceitas; os
downloads têm limite de tamanho e são identificados por SHA-256 antes de serem
armazenados no bucket privado. Alterações criam uma nova linha e preservam a
versão anterior.

Os itens oficiais são coletados separadamente com `npm run pncp:items`, sem uso
de IA. O snapshot é identificado por hash; itens retirados da fonte ficam
inativos para auditoria e códigos/descrições alimentam diretamente o match.

`npm run documents:process` lê uma fila pequena de versões pendentes. O texto é
salvo antes da estruturação por Gemini; por isso, falha ou limite de cota não
obriga novo OCR. O workflow usa um documento por passagem e encerra novas
tentativas depois de três falhas, preservando o PDF, o texto e o erro seguro.
Para PDFs longos, o texto integral continua salvo, mas somente trechos
priorizados são enviados ao modelo. A versão registra `structuring_scope` e a
quantidade de caracteres analisados; matches apoiados nessa leitura parcial
ficam em `revisar`, mesmo com código técnico forte.

## Fonte complementar Compras.gov.br

`npm run compras-gov:collect` consulta o módulo de contratações da API oficial
de Dados Abertos do Compras.gov.br. O workflow executa essa coleta após o PNCP
e usa lease, backoff e contagem de falhas próprios. Por padrão, busca as
modalidades 5 e 6 publicadas no dia em Brasília, com no máximo dez páginas por
modalidade. O número de controle PNCP é a identidade canônica: uma descoberta
complementar não cria um segundo edital nem sobrescreve dados já coletados
diretamente do PNCP. Documentos e itens seguem a mesma fila do PNCP.

Este endpoint espelha contratações publicadas no PNCP. Ele aumenta a
resiliência da descoberta, mas **não amplia a cobertura para portais municipais
fora do PNCP**. A plataforma não promete cobertura completa.

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

Os conectores seguem a [documentação oficial da API do PNCP](https://pncp.gov.br/api/pncp/swagger-ui/index.html?configUrl=%2Fpncp-api%2Fv3%2Fapi-docs%2Fswagger-config), o [Manual de Integração](https://pncp.gov.br/manual/pt-br/latest/singlehtml/index.html) e o [Manual da API Compras.gov.br](https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-dados-abertos/manual-api-compras.pdf), consultados em setembro de 2026.
