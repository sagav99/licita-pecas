# Rollback/mitigação — fonte Compras.gov.br

O rollback operacional preferencial é definir `active = false` para a fonte
`compras-gov` ou retirar o passo do workflow. Isso preserva saúde, auditoria e
oportunidades que só tenham sido descobertas pelo complemento.

O endpoint complementar atual expõe `numeroControlePNCP`; por isso, registros
descobertos por ele são armazenados com `source_id = 'pncp'` para manter uma
única identidade e permitir que os jobs de documentos/itens os processem.
Não apague esses editais ao desativar a fonte. O registro operacional em
`sources` pode ser removido por migration posterior somente se não for mais
necessário para auditoria.
