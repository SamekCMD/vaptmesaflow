# Neon — capacidade conferida sem SQL

18/10/2026, após a preparação inerte do Preview Cloudflare. Consulta ao control plane do projeto **existente** `dawn-morning-27332079` (`vapt`), sem conectar aos hosts PostgreSQL, iniciar/reiniciar computes ou executar SQL.

## Retorno observado

| Campo | Resultado |
| --- | --- |
| Plano | `owner.subscription_type=free_v3` |
| Compute ponderado | `compute_time_seconds=413311`, equivalente a114,8086 CU-h |
| Tempo ativo agregado | `active_time_seconds=1623528` segundos; não confundir com CU-h |
| Ciclo informado | `2026-10-01T00:00:00Z` → `2026-11-01T00:00:00Z` |
| `settings.quota` | Não presente; não significa quota zero, ilimitada ou configurável com sucesso |
| Production | `br-odd-term-b6j2n9ms`, endpoint `ep-holy-wildflower-b6vtv1dd` |
| Preview | `br-rough-dew-b6ydeygb`, endpoint `ep-hidden-bird-b673zocn` |
| Ambos endpoints | `idle`, `disabled=false`, mínimo0,25/máximo2CU, `suspend_timeout_seconds=0` |

O limite público Free conferido na [página oficial de preços](https://neon.com/pricing) é100CU-h mensais por projeto. O consumo e o ciclo retornados são os mesmos do diagnóstico anterior que identificou o bloqueio; não há evidência de capacidade restaurada. Estadoidle/disabledfalse não certifica SQL disponível. O contador é consumo do ciclo, **não** valor de fatura ou cobrança retroativa do Free. A data final do ciclo não é promessa de um teste SQL futuro aprovado.

## Método e segurança

CLI Neon7.0.1 já existente no cache, autenticação previamente configurada. `profile list` foi capturado e reduzido a presença de conta, sem imprimir identidade/credenciais. Executados apenas dois GETs: `/projects/dawn-morning-27332079` e `/projects/dawn-morning-27332079/endpoints`, com analytics desativadas e saída filtrada em memória. Sem inspeçãoSQL, connection-string, `env pull`, checkout/link, nova branch/projeto/role/chave, patch de tamanho/timeout/quota, upgrade ou login de navegador.

A primeira tentativa de resolução offline do pacote tentou selecionar8.0.11, ausente do cache (`ETARGET`); não houve download ou instalação bem-sucedida. Em seguida a versão7.0.1 já instalada foi usada diretamente, sem atualização global, dependência do projeto ou substituição dos skills. A sintaxe foi conferida na ajuda dessa versão, não presumida pela documentação mais nova.

## Resultado do gate

Manter SQL/schema/grants remotos, bootstrap, workload e ativação bloqueados; não fazer consultas de teste para reencontrar um erro já conhecido nem criar recursos substitutos ou contratar Paid para contornar o orçamento. A preparação inerte da Cloudflare permanece válida, mas não devolve a capacidade já consumida no Neon. Não foram alterados recursos, planos, banco, frontend, flags ou produção nesta consulta.

O trabalho local independente pode continuar, especialmente a reconciliação funcional das branches. [Situação e integração](infra-migration-branch-integration.md). Os dois documentos financeiros já modificados no checkout foram preservados sem edição/staging nesta conferência. Nenhuma suíte foi rerodada: este checkpoint é metadado/documentação, não mudança de código ou certificado de testes novos.
