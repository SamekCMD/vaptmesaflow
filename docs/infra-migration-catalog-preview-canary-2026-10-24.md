# Catálogo — canário privado de publicação24/10/2026

## Resultado

**Canário funcional e limpeza aprovados**, controlador exit0, execução única `818e361c-9c49-4b88-ad9e-b969047e213c`. Um rebuild autenticado publicou snapshot interno de exatamente8388608bytes e chegou a `ready`, committed e não-retryable. Writer fechado ao fim; reader permaneceu desligado durante toda a janela. Produção, DNS, main e planos contratados não foram alterados.

O usuário havia autorizado explicitamente essa janela limitada e concluiu o Access temporário. Não houve nova rodada de aprovação, Service Token persistente, publicação de código, migration/grant, envio de email ou pagamento. O produto implantado continua o bundle API compatível anterior; as novas fontes locais são operadores/testes.

## Janela e identidades públicas da prova

Horário do workload:24/10,02:16:53–02:17:42 em São Paulo (05:16:53–05:17:42UTC).

| Fronteira | Evidência |
| --- | --- |
| Baseline | Preview32 `35fd7ac3-2601-46bb-adec-39ef46813131`, reader/writerfalse, CPU1000 |
| Abertura única |33 `94e5ffe9-75a3-418d-87bc-82eb267614c2`, somente writertrue e bearer de teste write-only |
| Fechamento único |34 `55463f0b-4582-46ea-b2c5-475864e3d001`, reader/writerfalse, CPU1000 e executor preservado |
| Restaurante sintético |`8572dc6c-84b2-4b12-8099-934204cc21eb` |
| Operação única / revisão |`1ee89e9a-5f57-4486-8bdb-5de780d4c3ee` / `1` |
| DO do catálogo |namespace `eeda94fea90349be8b62b82067c79b27`; objeto `bd452a8868486ef71a14fb70bc060916f6951b92ce79eddc95e157c858bea8e3` |

Código/configuração de compatibilidade, migrações, nove secrets/tipos, seis rates, bindings de imagens, namespaces, bucket privado e Hyperdrive restrito/cache desligado foram preservados pelos guards do operador. Deployments APIproduction/web/paralleltop-level foram controles antes/depois e permaneceram iguais. Inspeção independente posterior confirmou34. As funções antigas de publicação/rotação e a nova abertura pinada em32 **não devem ser repinadas ou repetidas** para refazer este gate.

## CPU remota observada

GraphQL oficial, filtrado por preview, versão33, namespace, nome exato `preview:<restaurantId>` e mesmo objectId, retornou:

| Grupo da janela | Invocações reportadas | CPU reportada |
| --- | --- | --- |
| Worker HTTP |2, zero erros, sampleInterval1 |máximo171,613ms |
| DO `jsrpc` |1, zero erros, sampleInterval1 |21,436ms |
| DO `alarm` |1, zero erros, sampleInterval1 |517,895ms |

Para os dois grupos DO há uma invocação em cada; P99/P999 reportados coincidem no mesmo valor. **Não são percentis de uma população/carga**, nem um campo de máximo DO que o schema não oferece. São os eventos observados desse caso, ambos abaixo de1000ms. A atribuição usa nome/objeto/namespace/versão e contagens exatos, não tempo de parede ou o CPU do Worker como substituto do DO.

A coleta inicial parou na enumeração administrativa de objetos, que retornou lista vazia. A consulta GraphQL posterior, somente leitura, encontrou os eventos do objeto correto. **Lista administrativa vazia não comprova ausência de armazenamento/objetos.** Não houve nova chamada de rebuild, nova flag ou nova credencial para obter CPU. [Métricas de previews](https://developers.cloudflare.com/workers/previews/test-and-debug/) e [métricas de DO](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/) são referências oficiais; unidades em microssegundos foram conferidas na introspecção autenticada.

## Limpeza e custos residuais

- Logout confirmado e cookie antigo recusado401. Quatro chamadas HTTP ao preview no total: login, rebuild, logout e conferência da sessão; não houve resubmissão nem polling de status nesta execução.
- Após fechar admissão e conferir receipt/journal/versão, os três objetos exatos foram substituídos por fences e lidos novamente. Total retido: **270bytes** privados, não o snapshot8MiB. A preparação/retirada do operador contabilizou12 GETs/3 PUTs R2; isso não inclui operações nativas R2 da própria publicação. Nenhum objeto de imagem foi alterado.
- Journal exato removido por operation/actor/unit/version/fingerprint; limpeza tenant anterior permaneceu intacta e removeu somente as cinco contas, duas organizações e três unidades deste run. FK retirou a revisão. Não houve DELETE especulativo de comandos pendentes.
- Nova conexão TLS com transação READ ONLY confirmou zero nas11 contagens: organizações, restaurantes, memberships, assinaturas, preferências, usuários, contas de autenticação, sessões, itens, journal e revisões. Pools/controlador encerrados; credenciais de provider/perímetro/bearer não foram gravadas em Git, logs ou relatórios. Cache temporário nativo do Access segue seu fluxo habitual; não foi criado Service Token.
- O namespace e metadados terminais do DO não foram apagados. Retenção segue o protocolo existente; não declarar bucket/DO globalmente vazios, armazenamento físico zerado ou fatura global limitada aUS$20.

## Fontes locais e limites do gate

Preparação no commit API `9d812a4`:9 testes novos de retirement,8 testes novos PostgreSQL18.6 real,272 testes de operadores e701 API aprovados, zero skips/falhas; compilação e checks exit0. Não foram repetidos os gates antigos de migrations, publicação compatível, tenant68/browser, Bpreview ou os93 testes históricos.

Artefatos ignorados deste plano no scratch `.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/`:

- `catalog-canary-approved-2026-10-24-start.json`: marcador exclusivo, conservar; impede replay cego.
- `catalog-canary-{manifest,prepared,open,result}-818e361c-9c49-4b88-ad9e-b969047e213c.json`.
- `catalog-canary-cpu-readback-818e361c-9c49-4b88-ad9e-b969047e213c.json` e `catalog-canary-cpu-analysis-818e361c-9c49-4b88-ad9e-b969047e213c.json`; análise local com assertions exit0.
- SHA256 do resultado original: `66401f7c4ce6c0e1309179386123285323c06d14f59e3e7819a4cffb96d5b3a2`; da telemetria posterior: `61024ae0cf877f5d69702f0e0d4934c00ebc25c7a5428900aa60117e8ce714af`.

O resultado original não foi reescrito para esconder a falha inicial de atribuição. A análise posterior registra `publicationCasePassed:true`, mas mantém `fullCpuGatePassed:false` e `activationReady:false`.

O payload usou uma descrição sintética grande para a fronteira interna, não dados aceitos normalmente pelo formulário. Não representa todas as distribuições de itens/variações ou comportamento sob carga. O reader R2/frontend permaneceufalse e não foi certificado por este canário. Restam gates de reader/formatos representativos, cobertura de writers ativos, bootstrap/recuperação e promoção/integracão de produção. Catálogo formal7/10 e Etapa13 continuam abertos; este ensaio específico está encerrado e não deve ser refeito.
