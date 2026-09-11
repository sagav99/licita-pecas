# Mitigação da migration 0004

A função cria organização, vínculo do proprietário, perfil e preferências na mesma transação. Antes de liberar o cadastro, validar com usuário novo, usuário já vinculado e chamada anônima.

Se houver falha, revogar `execute` de `authenticated` imediatamente e publicar uma correção aditiva. A remoção da função é segura somente se o cadastro for temporariamente desabilitado; organizações já criadas não devem ser apagadas automaticamente.
