# Rollback/mitigação — itens do PNCP

Para interromper a atualização, retire o passo de itens do workflow ou revogue
a função `replace_procurement_items` do `service_role`. Itens removidos da fonte
ficam apenas inativos e podem ser reativados por uma coleta posterior.

Depois de receber dados reais, preserve `items_hash`, os itens e os eventos para
auditoria. Faça correções aditivas. Somente em ambiente vazio é seguro remover a
função, os índices e as colunas adicionadas pela migration 0009.
