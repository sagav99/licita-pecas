# Mitigação da migration 0002

Aplicar primeiro em staging e validar as policies com dois usuários de organizações diferentes. Em produção, preferir correção aditiva (`forward-fix`) porque documentos, feedbacks e importações podem conter histórico comercial.

Se a aplicação falhar antes de receber dados, as tabelas novas podem ser removidas na ordem inversa das dependências: `catalog_imports`, `match_feedback`, `alert_preferences`, `source_events`, `procurement_items`, `lots`, `procurement_documents`, `sources` e `supplier_profiles`. Depois, remover `can_access_procurement` e as três colunas adicionadas a `matches`.

Se já houver dados, não executar rollback destrutivo. Desabilitar os recursos consumidores, preservar as tabelas e publicar uma migration corretiva. Antes de liberar o cliente, confirmar que:

- um membro da organização A não lê catálogo, match, documento, lote, alerta, perfil, importação ou feedback da organização B;
- usuários autenticados não consultam `sources` diretamente;
- service role fica restrita ao backend;
- versões antigas de documentos continuam acessíveis para auditoria.
