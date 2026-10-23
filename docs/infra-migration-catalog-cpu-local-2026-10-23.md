# Catálogo — diagnóstico local de CPU por amostragem

## Resultado e limite da conclusão

Em23/10/2026, o profiler V8 do **isolate de usuário do workerd**, não o processo Node/Wrangler, capturou três operações sintéticas. Publicação e leitura de8MiB retornaram200;8MiB+1 retornou503 e a versão11 permaneceu legível. O processo terminou com exit0 e executou `mf.dispose()` no `finally`.

**O gate remoto de CPU1000ms permanece aberto.** Nenhum desses tempos é CPU faturada por invocação. Não alterar `activationReady:false`, flags ou orçamento com base neste diagnóstico. [A Cloudflare documenta profiling local](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/), mas [limites de CPU não são aplicados no desenvolvimento local](https://developers.cloudflare.com/workers/wrangler/configuration/#limits).

| Operação, uma execução após warmup pequeno | Resultado | Amostras V8 | Duração da captura, não CPU |
| --- | --- | --- | --- |
| Publicar JSON exatamente8388608bytes |200, revisão11 |29 |372,195ms |
| Ler `catalog-state` |200,8388608bytes/revisão11 |23 |158,116ms |
| Publicar8388609bytes |503; revisão11 preservada |18 |67,733ms |

As capturas contêm intervalos idle/program/native, além de frames JS; a localização mais amostrada da publicação foi o frame nativo `get`. Não atribuímos essa duração a uma função de negócio nem somamos amostras como CPU. A amostragem é pequena e não representa benchmark de carga, percentil, custo por usuário ou margem certificada abaixo de1000ms.

## Reprodutibilidade e isolamento

- Fonte API limpa no checkpoint `6fa961b6bf86ef12d5d3be7e932dfc8e708cf2dd`; nenhum código de produto alterado nesta passagem.
- Node24.13.0, Wrangler4.138.0, Miniflare5.20260921.1-alpha e workerd1.20260921.1 já instalados, sem atualização de dependências.
- Bundle exclusivamente local: `wrangler deploy --dry-run --config wrangler.worker-catalog-test.jsonc --outdir <scratch>/catalog-cpu-bundle-2026-10-23`; exit0. Não é implantação do Preview nomeado.
- Miniflare configurado explicitamente com dois buckets e SQLite locais, sem loader de dotenv, autenticação, Hyperdrive ou credenciais. Fetch externo recusado; HTTP/inspector somente127.0.0.1 e portas efêmeras.
- API pública `convertV4MiniflareOptions` da versão instalada e `getInspectorURL`; protocolo CDP `Profiler.enable/start/stop` no target `core:user:vapt-catalog-profile-local`. Perfis de processos Node ou de isolates internos de R2 não foram usados.
- A fixture `/_test/publish` exercita parse/validação, projeção real R2 local e sinal da sala. **Não exercita o applier/transação PostgreSQL, Hyperdrive, autenticação ou o writer remoto completo.** O campo description sinteticamente grande testa a fronteira interna de armazenamento, não um cadastro HTTP típico.
- Duas caracterizações iniciais falharam localmente antes da captura: opções antigas sem conversor e tentativa HTTP sobre URL de inspector `ws:`. Ambas executaram cleanup; a execução final usou o conversor público e o WebSocket correto. Não houve retry de operação remota nem mudança de fonte para contornar um guard.

Artefatos gerados sob o scratch ignorado deste plano, `.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/`: `catalog-cpu-local-probe-2026-10-23.mjs`, bundle/log, `catalog-cpu-local-result-2026-10-23.json` e os três perfis abaixo. São dados sintéticos; nenhum cookie, token, segredo, dump de cliente ou conexão Neon foi utilizado.

| Perfil `.cpuprofile` | Bytes | SHA256 |
| --- | --- | --- |
| `catalog-cpu-publish-8mib-2026-10-23` |3778 |`0495eb280967bf4ce23062c55c2c77160d4b4de2fcaed906489c19722ff07d51` |
| `catalog-cpu-read-8mib-2026-10-23` |5825 |`396c5de29e13ee8d5fc94e9f554b3f21455cb321ae9eda427aa0cbe0dc86212d` |
| `catalog-cpu-reject-8mib-plus-one-2026-10-23` |2153 |`6933cac7557c1af5e146e1ad9e00c688c30abdd85ae7fa803cb3f970d10887f3` |

Não reexecutar os gates encerrados de migrations, publicação compatível, smoke68 ou browser. Não houve publicação, rotação, SQL, alteração de flags, main/push, plano pago ou recurso remoto nesta passagem. As suítes completas anteriores não foram repetidas: somente o dry-run e este diagnóstico executável mudaram evidência; nenhum produto foi editado.

## Próxima fronteira, ainda não autorizada por este relatório

O canário remoto precisa de desenho/autoridade próprios: ambiente preview e identidades sintéticas fixas, reader desligado, writer admitido somente durante janela controlada, CPU1000 preservado, número de operações limitado, medição remota atribuída à versão/DO corretos e cleanup com readback independente. Não publicar a fixture `/_test/*` nem recuperar secrets write-only para isso. O teste de fronteira interna8MiB e a medição do caminho real com PostgreSQL são escopos diferentes e devem ser identificados no resultado.

O profiling de produção possui [API oficial por versão e por Durable Object](https://developers.cloudflare.com/workers/observability/profiling-in-production/); não foi chamada aqui. Antes de escolhê-la, confirmar suporte ao Preview nomeado e pin exato da versão, em vez de usar `latest`, instalar CLI novo ou habilitar logs pagos por inferência. Um perfil amostral, sozinho, continua não sendo o valor de CPU por invocação.

Cobertura do **preview sintético** e inventário dos writers de **produção** são gates distintos. A ausência de escrita direta legada Node/Coolify continua necessária antes de liberar o reader de produção, mas não implica investigar Easypanel/Vercel nem alterar DNS. Uma janela privada de preview não deve ser declarada dependente da aposentadoria da produção sem uma dependência concreta. Nenhuma ausência de writer remoto foi provada nesta passagem.

Formalmente catálogo7/10 e Etapa13 continuam abertos; T5/writers, T9/CPU remoto e T10/bootstrap/ativação não foram encerrados por estes perfis locais.
