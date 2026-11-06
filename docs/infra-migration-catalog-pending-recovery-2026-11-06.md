# Catálogo — recuperação pendente com PostgreSQL/SQLite/R2 locais, 06/11/2026

**Integração local aprovada:6/6 cenários. Nenhuma alteração remota.** O teste anterior de crash/restart em workerd simulava o journal SQL em R2. Esta composição conserva aqueles testes e acrescenta PostgreSQL18.6 descartável real, applier/journal/autorização reais e o mesmo runner/SqliteCommandStore/projection usados pela API.

## Composição e isolamento

Na API, `scripts/catalog-recovery-harness.mjs` conecta o workerd local ao PostgreSQL descartável por uma bridge HTTP exclusivamente loopback. A bridge substitui o transporte, não os dados/transações: chama `applyCatalogCommand`, `findCommittedCommand` e `withRestaurantWrite` reais. Não é Hyperdrive nem Neon. Aceita somente o alvo local do runner de testes, comando/operação/restaurante fixados, nonce efêmero em memória,32 requests e corpos64KiB. O URL/senha PostgreSQL não chega ao Worker nem é gravado em arquivo ou argv.

O entry/config em `scripts/catalog-recovery-runtime/` são exclusivos de teste, não importados ou exportados pelo entry implantável. SQLite, transações/alarmes armazenados, eviction/reconstrução e R2 são reais locais. O relógio lógico é controlado e `alarm()` é acionado explicitamente; isso não comprova entrega automática de alarme remoto, indisponibilidade de provider, CPU faturada ou recuperação Hyperdrive. Wrangler usa as dependências instaladas, sem telemetria/log de credenciais, env pull ou instalação. Config aninhada recusa arquivos de env locais inesperados.

Selector novo e fechado no runner existente:

```powershell
node scripts/local-tenant-pg.mjs --only=catalog-recovery
```

Exige schema012 e inicia/encerra somente PostgreSQL descartável loopback; nenhum serviço Windows é instalado. Os selectors antigos continuam com seus arquivos/escopo anteriores.

## Evidência observada

- **Antes de aplicar:** interrupção gera202 com intenção e agenda duráveis, sem domínio/journal SQL. Após eviction, a mesma operação é aplicada uma vez e publicada.
- **Após COMMIT, antes da resposta:** a bridge encerra a resposta HTTP depois do commit real. O executor continua `accepted`/202 enquanto o journal SQL já existe. Após eviction/alarme, localiza esse resultado antes de uma nova chamada ao applier e publica a mesma revisão.
- **R2 parcial:** interrupção após dois PUTs reais locais deixa `committed`. A recuperação completa a mesma publicação, sem reaplicar SQL.
- **Antes do sinal:** a revisão já está `ready`/legível, mas há trabalho de sinal persistido. Após reinício, conclui esse trabalho, sem nova revisão.
- **Sessão revogada antes do commit:** recuperação bloqueia sem mutação, journal ou publicação; status/retry continuam401.
- **Sessão revogada depois do commit ambíguo:** o alarme conclui a projeção legítima sem conservar uma sessão ativa; status/retry continuam401 e o catálogo público não expõe resultado privado.

Um trigger independente no PostgreSQL conta efeitos committed: exatamente uma atualização e um journal nas quatro convergências; zero no bloqueio pré-commit. Todas as revisões são a string exata `9007199254740993`, acima de2^53. Status não aplica/repara operação; retries concorrentes de ready não acrescentam efeito/revisão. Três alarmes sem trabalho mantêm todas as contagens SQL da bridge inalteradas, inclusive autorização. Chunks privados são removidos ao terminar; DTO R2 não contém CNPJ, marcador privado ou identidade/sessão.

## TDD, diagnóstico e regressão

Os seis casos PG e três guards falharam por export ausente antes da implementação. A primeira composição passou4/6: os dois casos de revogação expuseram uma falha da fixture, que lançava `AppError` diretamente através de RPC e perdia o401, retornando503. Corrigida somente a fixture para usar os helpers existentes `catalogRpcReply/unwrapCatalogRpc`; autorização de produção e expectativas401 não foram alteradas.

Verificação final, todos exit0/sem falhas, skips ou cancelamentos:

- PostgreSQL + workerd/SQLite/R2 composto: **6/6**.
- Suíte completa de operadores: **760/760**.
- Suíte completa da API: **704/704**; seis avisos experimentais preexistentes do SQLite do Node permanecem.
- Suíte completa workerd: **32/32**.
- Typecheck estrito da nova fixture: aprovado. O primeiro comando isolado omitiu a declaração ambiente já existente `src/worker/cloudflare-runtime.d.ts`; incluí-la resolveu os erros de `cloudflare:workers`, sem mudança de fonte ou relaxamento de tipos.

Logs `catalog-recovery-{pg-red,guard-red,pg-green,pg-final,final-operators,final-api,final-worker,types,types-final}-2026-11-06.log` no workspace deste plano. Três clusters desta passagem encerrados, `postmaster.pid` ausente. As suítes PG anteriores de116 casos e os canários anteriores permanecem evidência histórica, não foram declarados como novos testes desta composição.

## Limites e próximo gate

Nenhuma fonte `src` da API foi modificada: árvore `b5914e9323b74215442c2afc5e0f356f2f904c8c`. Sem mudança de produto, dependência, schema versionado, configuração implantável, flag, billing, DNS, main, push, chave ou recurso remoto. Controladores/recibos consumidos, inclusive a limitação de revogação assinada do onboarding, permanecem intactos. Documentos preexistentes sujos e referências do usuário foram preservados.

A lacuna de composição local da recuperação avançou. Não há certificado de recuperação remota, ativação de reader/eventos, cobertura de todos os consumidores ativos, economia medida ou teto financeiro. Os gates de canário/ativação, integração das branches e Etapa13 continuam separados; formal7/10 e tarefas5/9/10 não são encerrados somente por estes testes. Não provocar falha em produção nem criar outra credencial para fabricar uma prova pendente.
