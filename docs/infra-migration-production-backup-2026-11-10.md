# Backup atualizado de produção do Neon

O banco `vapt` da branch de produção foi exportado entre 22:36:47 e 22:37:26 de Brasília em 10/11/2026. O dump e a verificação da origem compartilharam um snapshot em transação somente leitura. A conexão direta foi autenticada com TLS e o `pg_dump` usou `sslmode=verify-full`. [Snapshot no pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)

| Evidência | Resultado |
| --- | --- |
| Arquivo | `production-2026-11-10.dump`, formato custom PostgreSQL |
| Tamanho | 191.691 bytes |
| SHA-256 | `1a8ae9aa019b245027a3fb5a4749bafd1f8969fb706501c5e0d31dc695a8fbd1` |
| Tabelas comparadas | 30, das quais 13 tinham dados |
| Comparação após restauração | Estrutura, proprietários, grants, contagens e hashes do conteúdo coincidiram |
| Verificação local independente | Hash e tamanho conferidos, 3.117 entradas com ACL restrita e dois clusters locais encerrados |

O ensaio anterior à exportação restaurou dados sintéticos de duas tabelas. A restauração da cópia de produção rodou em uma transação em PostgreSQL local, com roles auxiliares `NOLOGIN` para preservar proprietários e permissões dos objetos. O operador comparou hashes do conteúdo por tabela, sem imprimir registros do banco. [Restauração em uma transação](https://www.postgresql.org/docs/18/app-pgrestore.html)

A cópia está no diretório local ignorado pelo Git `.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-backup-2026-11-10/`. O dump, o recibo `result.json` e os dados dos clusters encerrados ficam acessíveis ao usuário local e ao SYSTEM. As credenciais da conexão passaram por memória e named pipes durante a execução.

Este registro cobre o banco Neon. O inventário dos objetos R2 e a conferência dos jobs, DNS e webhooks restantes pertencem à validação de desligamento da infraestrutura antiga. [Estabilidade e dependências de produção](infra-migration-production-stability-2026-11-10.md)
