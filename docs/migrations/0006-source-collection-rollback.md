# Migration 0006 — coleta de fontes

## Objetivo

Adicionar identidade estável, saúde, última execução e lease às fontes. O lease
impede duas coletas simultâneas do PNCP. A função de aquisição é executável
somente com `service_role`.

## Mitigação e rollback

Para interromper a coleta sem alterar dados, remova o agendamento e revogue
`claim_source_collection(text, integer)` da `service_role`. Esse é o rollback
preferencial.

As colunas são expansivas e aceitam `null`. Não devem ser removidas depois que
houver histórico operacional. Se for necessário desfazer antes da primeira
execução, uma migration posterior pode remover a função, o registro PNCP e as
quatro colunas, nessa ordem. Nunca apagar o registro da fonte depois que houver
contratações coletadas.
