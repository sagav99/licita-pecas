# Rollback/mitigação — escopo de estruturação documental

A migration 0012 adiciona apenas duas colunas opcionais. Para interromper o
comportamento, reverta o código do processador; os documentos, o texto e as
extrações anteriores permanecem legíveis. Após processamento real, preserve as
colunas para auditoria do escopo analisado e use migration corretiva em vez de
removê-las. Nenhuma policy de RLS muda: a tabela continua acessível ao cliente
somente por match da própria organização.
