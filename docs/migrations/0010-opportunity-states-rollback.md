# Rollback/mitigação — estado comercial das oportunidades

A migration 0010 é expansiva e não altera `matches`. Em caso de falha da
interface, faça rollback da aplicação para ignorar `opportunity_states`; os
dados podem permanecer sem afetar coleta ou matching.

Depois que usuários salvarem ou classificarem oportunidades, não remova a
tabela sem exportar `organization_id`, `procurement_id`, `saved`,
`workflow_status` e timestamps. Prefira uma migration corretiva. A remoção da
tabela e das policies só é segura em ambiente vazio ou após migração verificada
dos estados humanos.
