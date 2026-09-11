# Rollback/mitigação — ingestão de documentos

Para interromper imediatamente novas versões, remova a etapa de documentos do
workflow ou revogue a execução de `register_procurement_document_version` do
`service_role`. Os campos e índices são expansivos e não alteram documentos já
salvos.

Depois que houver arquivos ou versões reais, não apague o bucket nem faça
rollback destrutivo. Corrija por migration aditiva. `storage_path`, hashes,
texto extraído e eventos precisam ser preservados para auditoria. Somente em um
ambiente vazio a função, o índice e as colunas podem ser removidos em ordem
inversa.
