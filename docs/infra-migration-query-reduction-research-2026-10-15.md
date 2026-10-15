# Vapt — pesquisa de redução de consultas e custo ocioso

Data: 15/10/2026. Escopo: pesquisa e recomendação, **não implementação aprovada nem comprovação de economia em produção**.

## Conclusão executiva

Há oportunidades grandes de redução sem trocar o Neon nem contratar uma plataforma de realtime. A recomendação é combinar **leitura pública cacheada/materializada**, **eventos duráveis**, **invalidação seletiva** e **compartilhamento de resultados no navegador**. WebSocket é o transporte, não substitui essas quatro peças.

A proposta anterior de passar a consulta de segurança de30s para2min economizaria75% dessas chamadas periódicas isoladamente, mas não resolve o principal: consultas, renovações ou conexões frequentes ainda podem impedir o Neon de suspender. Não recomendo tratar essa mudança de intervalo como solução definitiva nem remover recuperação de falhas apenas porque o socket está conectado.

Restrição vinculante: Neon+Cloudflare com metaUS$10–15/mês, capacidade financeira máximaUS$20. Nenhum dos modelos abaixo garante esse teto. Manter Neon Free; pesquisa não autoriza upgrade, novos recursos, deploy, mudança de segurança, DNS, main ou retirada da Hetzner.

## 1. Método e limites da evidência

- Inspeção estática do frontend no head `4184e3cabbf9cff3c06770daf7bce4a78f4c067a`, com documentos financeiros locais ainda não commitados; API no head `ae8a7c3a986428633b1297d206dfa7f571280c1b`, checkout limpo.
- Documentação primária de Neon, Cloudflare, Better Auth, TanStack, Resend e referência arquitetural AWS. AWS é apenas a fonte do padrão outbox, **não recomendação de contratar AWS**.
- Nenhuma consulta SQL, leitura de credencial, teste de carga remoto ou chamada a Stripe/Resend nesta pesquisa. Banco permanece com cota esgotada conforme preflight anterior; não fingir profiling de um banco acessível.
- Contagens abaixo são modelos derivados do código. Não foram medidas SQL/s, cache hit ratio, latência ou fatura em produção. Hyperdrive pode alterar o número de acessos efetivos à origem; seu caching está registrado historicamente como desabilitado, sem novo readback nesta pesquisa.
- O objetivo é reduzir consultas **e janelas de atividade**; reduzir99% de SQL não implica reduzir99% da conta.

## 2. O que realmente está acontecendo no código

| Área | Evidência atual | Consequência / oportunidade |
| --- | --- | --- |
| Cardápio local público | `PublicMenu.tsx:190–236`: GET do catálogo a cada8s; efeito depende também do carrinho | Atualização periódica mesmo sem alteração; este efeito não verifica visibilidade/offline, ao contrário do hook de realtime |
| Origem do catálogo | API `modules/catalog/repository.ts:114`: SELECT restaurante e SELECT itens/variações | Duas consultas do repository por catálogo válido, antes de possíveis efeitos de infraestrutura/cache |
| Realtime nas telas | `use-realtime-refresh.ts:35`:30s quando saudável; fallback configurável4–8s nos consumidores | Socket ativo ainda acompanha polling; intervalos são por hook, não um cache de dados compartilhado |
| Pedidos no cardápio | `PublicMenu.tsx:269`: evento aciona refresh que percorre os acessos atuais, até24 | Evento de um pedido pode reler vários pedidos |
| Gaveta Meus pedidos | `MyOrdersDrawer.tsx:64`: outro refresh de até24 acessos | Compartilhar transporte não deduplica automaticamente as leituras dos componentes |
| Consulta de pedido | API `modules/orders/repository.ts:178`: SELECT pedido e SELECT itens | Custo de reler pedidos inteiros pode ser multiplicado por eventos/componentes |
| Autorização realtime | lease até300s; nova admissão, validação ao emitir ticket e no upgrade; publicação revalida grants | Reabrir socket periodicamente também envolve SQL; eventos não são universalmente SQL-free |
| Publicação realtime | `worker/realtime/publisher.ts:16` captura falha e registra código; sequência é atribuída no DO ao publicar | Não existe nessa fronteira uma entrega durável que permita confiar apenas na ausência de mensagens |
| Billing | dispatcher sempre chama `reapExpired` e `reserveDispatch`; Cron atual30min por ambiente | Mesmo sem emails, faz trabalho no banco; o intervalo maior só mitiga |
| Retorno de pagamento | `PaymentReturn.tsx:67`: até30 verificações, separadas por2s após cada conclusão | Já é limitado, não polling infinito; pode usar evento do pedido e backoff sem confiar no redirect como prova de pagamento |
| Sessão do navegador | Better Auth1.7.6 instalado: intervalo padrão0, refetch por foco/online/sinais | Não há evidência de um timer contínuo de sessão configurado pelo app; não atribuir consumo a um polling inexistente |

Os timers locais da cozinha para relógio/arquivamento e do caixa para relógio **não são todos consultas**: o relógio apenas atualiza estado visual; arquivamento escreve quando há pedido pronto elegível. Não remover timers por busca textual indiscriminada.

Referências locais: [poll do catálogo](D:/Projetos/vaptmesaflow/src/pages/menu/PublicMenu.tsx:190), [refresh saudável](D:/Projetos/vaptmesaflow/src/hooks/use-realtime-refresh.ts:35), [leitura de vários pedidos](D:/Projetos/vaptmesaflow/src/pages/menu/PublicMenu.tsx:269), [gaveta](D:/Projetos/vaptmesaflow/src/components/menu/MyOrdersDrawer.tsx:64), [publisher](D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation/src/worker/realtime/publisher.ts:16), [autorização](D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation/src/modules/realtime/authorization.ts:51), [dispatcher](D:/Projetos/vaptmesaflow/infra/cloudflare/billing-email-worker/src/dispatcher.ts:12).

## 3. Cardápio: a maior redução imediata de leituras repetidas

### 3.1 Cache HTTP público compartilhado

O catálogo é comum aos visitantes do mesmo restaurante. O primeiro passo de alto retorno é cachear **somente esse DTO público**, separar de pedidos/mesas/sessões e reduzir a consulta periódica no browser. Aplicar TTL explícito, ETag e invalidação após alterações de cardápio/aparência/configuração publicada. ETag calculado **depois de consultar o banco** reduz bytes, não SQL; a versão deve estar disponível no cache/projeção para dispensar a leitura.

O Workers Cache documentado atualmente verifica cache antes de executar o Worker e combina misses simultâneos da mesma chave/localidade. É diferente de `caches.default`, que exige executar o Worker e não oferece esse agrupamento. A página de configuração exige Wrangler>=4.69.0; o repositório tem4.138.0 e campo `cache` no schema local, mas disponibilidade/comportamento remoto ainda precisam de prova isolada. [Configuração](https://developers.cloudflare.com/workers/cache/configuration/), [diferenças entre os caches](https://developers.cloudflare.com/workers/cache/limitations/).

Cuidados obrigatórios:

- Allowlist do endpoint público e `private, no-store` como padrão nas respostas privadas/autenticadas. Não ativar caching global numa API cookie-auth sem política explícita: não presumir que Cookie sempre causa bypass.
- Chaves separadas por ambiente/restaurante/representação; `Vary: Origin` coerente com CORS. Não deixar parâmetros arbitrários fragmentarem o cache ou tornarem cada visita um miss.
- Invalidar depois do commit e verificar o resultado; purge pode sofrer rate limit. Browser cache e edge cache têm vidas distintas. TTL limita staleness quando a invalidação falha; não prometer propagação instantânea.
- Pedido final continua validando preço, disponibilidade e canal na origem transacional. Cache público não autoriza compra nem substitui autorização.
- Alterações por horário devem respeitar os próximos limites de disponibilidade; não cachear uma decisão temporal por tempo indefinido.

Workers Cache possui purge/invalidate por código e tags; há limites de purge. [Invalidação](https://developers.cloudflare.com/workers/cache/purge/). Hits não executam CPU do Worker, mas ainda contam como requisições. Ativá-lo no frontend estático pode tornar cobradas requisições que hoje são gratuitas; candidato é a API/caminho público, não o `vapt-web` inteiro. [Semântica e preço](https://developers.cloudflare.com/workers/cache/).

### 3.2 Para ir além: snapshot público fora do Postgres

Cache comTTL60s ainda pode causar uma consulta ao Postgres por minuto sob tráfego contínuo. Assim, pode reduzir muito SQL **sem permitir suspensão**. Para remover leituras do catálogo da origem, manter um snapshot público versionado em R2, acessado via binding pelo Worker e cacheado na borda. O bucket pode continuar privado; publicar apenas o DTO aprovado, não liberar bucket/imagens/secrets por inferência.

O snapshot é reconstruído quando dados publicados mudam; visitas comuns leem snapshot/cache, não Neon. Precisa de versão monotônica ou serialização por restaurante para um job antigo não sobrescrever estado novo. SQL continua fonte de verdade; commit e atualização de snapshot não são atômicos. Usar evento durável, reprocessamento idempotente e recuperação verificável. Em snapshot ausente, recuperação controlada e agrupada, não centenas de rebuilds por visitantes simultâneos. Exclusão/despublicação precisa tombstone/invalidação, inclusive para cache negativo de slug inexistente.

R2 fornece consistência nas operações diretas, mas caches HTTP podem continuar servindo objetos anteriores. Snapshot não elimina a necessidade de invalidação. [Consistência](https://developers.cloudflare.com/r2/reference/consistency/). Há franquia mensal de operações e cobranças excedentes: é deslocar leituras para armazenamento apropriado, não torná-las magicamente gratuitas. [Preço R2](https://developers.cloudflare.com/r2/pricing/).

Realtime de catálogo seria **um sinal público de versão alterada**, sem dados de pedidos/owner, que manda buscar o snapshot. Hoje os contratos suportam owner/pedido e tópicos orders/kitchen/table_sessions/payments, não canal público de catálogo. É uma extensão de protocolo com limites contra abuso; não basta reutilizar um socket privado ou conectar cada visitante ao Neon.

## 4. Realtime: deixar de invalidar tudo, sem perder confiabilidade

### 4.1 Reaproveitar o que já existe

O Vapt já usa `ctx.acceptWebSocket`, attachments persistíveis e SQLite no Durable Object. Não é preciso comprar serviço externo. A hibernação mantém sockets enquanto o objeto pode dormir; memória de processo não é armazenamento durável. [Cloudflare WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

O estado `connected` atual só comprova admissão/transporte. A sequência é gerada no DO, **não na transação que alterou o pedido**. Se o commit ocorrer e a publicação falhar antes de chegar ao DO, não existe número faltando que um ping ou comparação da sequência do DO descubra. Remover toda reconciliação agora criaria risco de cozinha/caixa desatualizados.

### 4.2 Desenho recomendado

1. Persistir evento/outbox junto da mutação SQL; depois do commit, enviar ID/versionamento para a fila/DO, com retry e deduplicação.
2. Associar cursor/versionamento aos dados confirmados, não apenas às mensagens emitidas. Reconexão com versão desconhecida ou histórico expirado faz snapshot completo.
3. No browser, tratar eventos por entidade/tópico: reler um pedido alterado ou invalidar um resumo pertinente, não todos os pedidos de todas as gavetas.
4. Reutilizar resultados e requisições em voo por recurso/identidade. TanStack Query5 já está instalado e tem provider; não é necessário instalar outra biblioteca. Configurar staleTime, retries e invalidação seletiva deliberadamente, não adotar defaults cegamente. [Invalidação direcionada](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations), [operações do QueryClient](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient).
5. Manter snapshot inicial, refetch ao reconectar/retornar à aba e fallback limitado quando transporte estiver indisponível. Só reduzir/remover watchdog agressivo após provar recuperação da falha pós-commit. A periodicidade final deve nascer da garantia de entrega e tolerância de atualização, não de um número escolhido para caber no orçamento.

Não colocar public tokens/cookies em query keys expostas a devtools/logs, nem compartilhar dados privados entre identidades. Limpar caches no logout/troca de conta e limitar retenção. Batch de pedidos, se escolhido, deve validar cada autorização: um único token não concede acesso à lista inteira. Um DTO resumido de status pode evitar reler itens, mas exige preservar autorização e semântica de estados finais.

No servidor, grants já são deduplicados e validados em lote por categoria owner/pedido. Não atribuir uma query a cada socket sem evidência. Há oportunidade de eliminar validações repetidas na mesma fronteira confiável, mas não transferir validação para um ticket copiável/reutilizável ou prolongar autoridade revogada. O lease atual força renovação em até5min; mesmo sem polling da UI, isso pode manter Neon ativo.

Ping/pong estático pode usar `setWebSocketAutoResponse`, que não acorda o DO para responder. Não consulta versão dos dados nem comprova autorização vigente; o cliente atual precisaria reconhecer esse frame sem considerá-lo inválido. [Auto-response](https://developers.cloudflare.com/durable-objects/api/state/).

## 5. Billing: parar de perguntar ao banco se existe trabalho

O webhook já grava intenção na outbox dentro da transação. A melhoria é **avisar a fila imediatamente após o commit**, aproveitando a outbox existente, em vez de depender da varredura30min como caminho normal. Consumidores push não são chamados com lote vazio. [Queues: batching e filas vazias](https://developers.cloudflare.com/queues/configuration/batching-retries/).

Não basta apagar o Cron: existe a janela commit→enqueue. Se o processo morrer nesse intervalo, uma mensagem nunca entra na fila. Preservar uma recuperação da outbox, com frequência/SLA explícitos, ou projetar um coordenador durável com marcador pendente antes da operação e alarme após ela. Essa alternativa acrescenta estado/operações e precisa provar falhas em todas as fronteiras. Não afirmar atomicidade entre Postgres e Queue/DO. [Padrão transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

Queues entrega pelo menos uma vez, então retries/duplicatas exigem idempotência, leases, snapshots de email e DLQ existentes. [Garantias de entrega](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). Alarmes de DO também podem repetir e têm retries limitados; só agendar havendo trabalho, não substituir um Cron SQL por outro loop vazio em cada DO. [Alarmes](https://developers.cloudflare.com/durable-objects/api/alarms/), [boas práticas](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/).

Manter o contrato de recuperação: a deduplicação do Resend tem janela24h; não trocar a varredura por um resgate diário/indefinido e concluir que retries ambíguos continuam seguros. Os estados unknown/dead-letter e limites atuais devem ser preservados. [Resend idempotency](https://resend.com/changelog/idempotency-keys).

Preview também deve deixar de executar trabalho ocioso permanente, mas desabilitar seu Cron ou consumer muda operação e não foi feito nesta pesquisa. Não apagar a branch ou reconstruir infraestrutura.

## 6. Autenticação e Hyperdrive: onde NÃO economizar às cegas

Better Auth permite cookie cache, porém sessões revogadas podem continuar aceitas até expirar esse cache; operações sensíveis podem exigir consulta fresca. Não ligar isso globalmente para perseguir economia. Além disso, o realtime atual valida sessão/ownership diretamente no Postgres; cookie cache sozinho não elimina esse caminho. [Trade-off de sessão](https://better-auth.com/docs/concepts/session-management).

Primeiro remover chamadas de negócio duplicadas: isso também elimina as autenticações que acompanhariam essas chamadas. A factory de serviços já é lazy e memoizada por request, e a inicialização auth já foi otimizada em etapa anterior. Não refazer essas correções nem chamar todo processamento de sessão de desperdício.

Cache de resultado SQL do Hyperdrive não invalida automaticamente após escrita. Portanto, mantê-lo desabilitado para sessão, permissão, billing, pedido e read-after-write. Um caminho separado cacheável pode ajudar catálogo, mas HTTP cache/snapshot evita mais trabalho e tem invalidação explícita. Não usar comentários SQL para tentar forçar bypass. [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

KV tem propagação eventual, podendo levar60s ou mais entre localidades. Não recomendá-lo como autoridade de revogação ou de pagamento. [Consistência KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

## 7. Quanto pode cair — modelos, não resultados medidos

### Catálogo:10 abas visíveis e estáveis no mesmo restaurante

| Modelo | GETs do navegador/h | Leituras do catálogo na origem/h | SELECTs do repository/h |
| --- | ---: | ---: | ---: |
| Atual, intervalo8s |4.500|4.500 sem cache|9.000 sem cache|
| CacheTTL60s, uma localidade, misses agrupados e sem alterações/evicções |4.500|aprox.60|aprox.120|
| Snapshot público em R2/cache, já publicado |depende da estratégia do browser|0 no Neon por visita|0 no Neon por visita|

O segundo cenário representa98,67% menos SELECTs do catálogo sob essas hipóteses. Várias localidades, invalidações e evicções mudam a conta. No terceiro, publicação/rebuilds ainda acessam SQL e leituras deR2/cache/Worker continuam existindo. Reduzir polling também derruba os próprios GETs; não confundir isso com cache server-side.

Em8h/dia×30dias, o modelo atual das10abas soma1,08milhão de GETs e2,16milhões de SELECTs do catálogo. Não é medição de tráfego atual nem atribuição histórica da cota.

### Watchdog e fan-out

- Snapshot periódico30s:120/h por hook saudável, fora eventos/admissões.
- Mudar para120s:30/h,75% menos esse timer, mas ainda impede5min de silêncio enquanto a tela fica ativa.
- Reler um pedido em vez de24: até95,83% menos chamadas daquele refresh, **somente quando houver24 pedidos e apenas um mudar**. Não é redução global do app.
- Componentes compartilhando requisição: a economia depende de quantos realmente pediam o mesmo recurso simultaneamente; deve ser contada por teste, não prometida.

### Custo ocioso dos timers

Com dois computes fixos0,25CU, consultas curtas, suspensão após5min e nenhum outro acesso, o Cron30min pode representar aproximadamente60CU-h em30dias; o antigo1min impediria suspensão e representaria360CU-h. É modelo idealizado, não medição; duração das consultas e outros clientes acrescentam atividade. Frequência maior que5min não significa custo zero.

Neon suspende após inatividade; conexão frequente e replicação também precisam entrar no diagnóstico. CDC/replicação lógica contínua não é minha recomendação para economizar: assinantes conectados mantêm compute ativo. [Scale to zero](https://neon.com/docs/introduction/scale-to-zero), [conexões e diagnóstico](https://neon.com/docs/manage/endpoints/).

## 8. Viabilidade da faixaUS$10–15

Hipótese: **um** compute production fixo0,25CU,30dias, preço LaunchUS$0,106/CU-h. Não presume que0,25CU aguente a carga real e não é proposta de contratar Launch.

| Horas ativas/dia | CU-h/mês | Só compute Neon | +base WorkersUS$5 |
| --- | ---: | ---: | ---: |
|8|60|US$6,36|US$11,36|
|12|90|US$9,54|US$14,54|
|24|180|US$19,08|US$24,08|

Fora desses totais: preview, armazenamento/histórico, excedentes Cloudflare/R2/Queues/DO, outros serviços, tributos/câmbio se aplicáveis. Meses31dias aumentam os valores. Horários de restaurantes podem se sobrepor ou ampliar a janela diária;10 usuários não equivalem automaticamente a10 computes nem a10 vezes esse valor. Tráfego pode aumentar CU/tempo.

O Free inclui100CU-h/projeto/mês compartilhados; no exemplo8h/dia,60CU-h deixariam40 para outras atividades **se todas as hipóteses se confirmassem**. Ainda não foi demonstrado esse regime. [Preços Neon](https://neon.com/pricing). A base e os excedentes Workers são separados. [Preços Cloudflare](https://developers.cloudflare.com/workers/platform/pricing/).

Logo, reduzir polling pode tornar o Free viável no desenvolvimento. Mas se o banco realmente precisar trabalhar24h/dia, otimizar consultas não apaga o piso de processamento do Launch. Nesse caso, orçamento/arquitetura precisa de outra decisão, não de garantia fictícia.

## 9. Alternativas comparadas

| Abordagem | Vantagem | Limite / decisão |
| --- | --- | --- |
| Só aumentar intervalos |Pouca alteração e redução rápida de GETs|Não resolve auth, timers vazios ou perda de evento; mitigação apenas|
| Neon transacional + snapshot/cache público + realtime/outbox confiáveis |Preserva migração e concentra SQL em trabalho real; recomendada|Exige invalidação, recuperação e testes; não há teto financeiro global automático|
| Migrar domínio paraD1/SQLite |Modelo sem hora de compute reservada|Nova migração: app depende dePostgres, funçõesSQL e authPostgres; não recomendada agora sem evidência de incompatibilidade financeira após otimização|

D1 cobra operações/linhas e armazenamento, não CU-h; isso é relevante numa avaliação futura, mas não equivale a promessa de custo fixo nem compatibilidade automática. [Preço D1](https://developers.cloudflare.com/d1/platform/pricing/).

Não adicionar Redis, serviço externo de realtime, cluster deCDC ou outro banco apenas para reduzir GETs. Não usar banco como barramento público de assinaturas. Não aumentar limites/capacidade para mascarar polling vazio.

## 10. Sequência recomendada e critérios de aceitação

Esta é uma **recomendação de pesquisa**, não um plano de implementação aprovado. O ajuste30s→2min anteriormente proposto continua não aplicado.

1. **Estabelecer baseline reproduzível local:** contadores de requests e SQL por operação lógica, sem SQL textual, dados pessoais ou tokens. Separar frontendGET, SQL na origem, admissões,CU-h, duraçãoDO e operaçõesQueue/R2. Quando houver capacidade, profiling agregado mínimo; não instalar extensões nem acordar banco esgotado agora.
2. **Cardápio público:** cache allowlisted, invalidação testada, pausa oculta/offline e deduplicação de requests. Medir foreground, carrinho, dez abas, cache frio/quente, múltiplas origens e slug inexistente. ETag deve evitar consulta, não somente corpo. Avaliar snapshot emR2 para eliminar a origem em visitas comuns.
3. **Compartilhar dados e mirar eventos:** pedido alterado não deve reler automaticamente24; duas views do mesmo recurso não duplicam a requisição em voo. Cobrir logout/troca de conta/atualização durante fetch/evento duplicado/fora de ordem; estado final não deve encerrar acompanhamento antes de estornos/feedback que ainda possam ocorrer.
4. **Entrega durável antes de retirar watchdog:** testar commit seguido de crash antes de publicar, falha deQueue/DO, hibernação, cursor antigo, reconexão e fallback. Garantir que nenhum pedido fica invisível por confiar em socket aberto. Manter caminhos de segurança até a prova.
5. **Billing orientado a trabalho:** fast path pós-commit e recuperação explícita da outbox, preservando lease/retry/DLQ/idempotência24h e latência acordada. Provar que fila vazia não consultaNeon, salvo recuperação deliberada e contabilizada. Não remover oCron atual sem provar substituição.
6. **Canário e orçamento:** depois da cota/capacidade voltar, validar janela ociosa e carga representativa, ambas branches; medirCU-h separadamente. Zero visitantes/zero trabalho não deve manter atividade recorrente inexplicada. Só então comparar projeção completa com meta15 e margem até20. Isso não autoriza contratarPaid.

Rejeitar a mudança se houver regressão de autorização, isolamento por restaurante, preço/pagamento, perda de evento/email, tempestade de reconexões, cache privado compartilhado ou custos transferidos não contabilizados. Manter rate limits eCPU existentes; eles ajudam contra abuso, mas não são teto monetário global. Evitar criar umDO/chave persistente para cada slug ou token arbitrário de atacante.

## Recomendação final

Começar pelo **cardápio público e deduplicação de leituras**, medir, depois fortalecer publicação realtime e o despacho da outbox. É o caminho com melhor relação impacto/risco para o Vapt atual. O objetivo é Postgres fazer trabalho transacional real, enquanto navegação e espera usam dados já publicados. Não há justificativa para pagar mais apenas para sustentar consultas repetidas sem mudança.
