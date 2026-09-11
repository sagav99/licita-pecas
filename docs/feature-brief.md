# Feature brief — radar Licita Peças

## Problema e público

Distribuidoras regionais abrem muitos editais irrelevantes e ainda perdem oportunidades que conseguiriam atender. O primeiro usuário é o responsável comercial/licitações de uma pequena ou média fornecedora de autopeças.

## Resultado observável

Em poucos minutos, a pessoa importa o catálogo, encontra oportunidades priorizadas e entende por que cada edital é compatível, requer revisão ou não atende, sempre com evidência e fonte.

## Escopo desta fatia

Radar, filtros, estados de decisão, detalhe explicável, conferência de CSV/XLSX, domínio de match e jornadas completas de catálogo/alertas. Persistência será integrada depois com Supabase.

## Não escopo

Coleta e OCR de produção, cobrança, WhatsApp, proposta/lance automáticos, parecer jurídico e lançamento dos verticais EPI/Água.

## Critérios verificáveis

1. a tela responde em desktop e mobile e o trabalho principal aparece no primeiro viewport;
2. busca e filtro alteram a lista, incluindo estado vazio;
3. selecionar uma oportunidade atualiza motivos e evidência;
4. CSV/XLSX mostra quantidade e mapeamento antes de confirmar;
5. match cobre quatro estados e hard blocks;
6. contratos documentam tenant, idempotência, documentos versionados e eventos para a futura migration Supabase;
7. `npm run verify` passa.
