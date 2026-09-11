# Mitigação da migration 0003

Os buckets são privados. Antes de liberar uploads, testar leitura, inserção e exclusão usando dois usuários pertencentes a organizações diferentes.

Se não houver objetos, as policies podem ser removidas e os buckets excluídos pela API do Storage. Se já existirem objetos, não apagar linhas de `storage.objects` por SQL: desabilitar uploads, exportar os arquivos pela API e publicar uma migration corretiva. A documentação oficial do Supabase recomenda tratar o schema `storage` como somente leitura para operações sobre objetos.
