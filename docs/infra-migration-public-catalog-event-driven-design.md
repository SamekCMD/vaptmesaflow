# Cardápio público por evento, sem polling de catálogo

Data:15/10/2026. Estado: **desenho aprovado pelo usuário; plano de implementação em revisão; implantação remota ainda não autorizada por este documento**.

## 1. Intenção e limites

O usuário quer reduzir a fatura, com Neon+Cloudflare na faixaUS$10–15/mês e capacidade financeira máximaUS$20. Rejeitou aumentar o intervalo do polling como solução principal e aprovou a direção conversacional: alteração confirmada→snapshot/cache atualizado→sinal→abas atualizadas. O `bora continuar` autoriza desenvolver este desenho, não demonstra aprovação de um documento ainda inexistente nem autoriza novo plano pago.

Esta etapa trata **somente catálogo público**, nos cardápios local e delivery e nas escritas que alteram seus dados. Pedidos, autenticação, leases do realtime privado, pagamentos, outbox de emails e Cron billing30min permanecem com o comportamento atual. Portanto não elimina, sozinha, todo consumo ocioso do Neon.

Objetivo verificável: sem alteração de catálogo, uma aba visível e conectada não faz GETs periódicos do catálogo; uma visita comum, uma reconexão ou a busca de versão publicada não acessam Postgres quando a projeção já existe. Postgres continua fonte transacional de verdade. A compra sempre valida valores/disponibilidade na origem, independentemente do que foi exibido.

Não há promessa de teto monetário global ou redução já medida. Nenhuma mudança remota é feita por este documento; Neon pago, ZeroTrust pago, StripeLive, DNS/main/Hetzner, secrets e abertura do bucket continuam fora do escopo.

## 2. Contexto inspecionado

Frontend: head4184e3c, `PublicMenu.tsx` faz GET a cada8s; delivery carrega o mesmo DTO inicialmente. API: headae8a7c3, `catalog/repository.ts` lê restaurante e itens/variações; `menu/repository.ts` já usa transações em mutações; update de restaurante pode mudar slug e campos públicos/privados. Onboarding cria restaurante+primeiro item juntos. O realtime atual só aceita grants owner/pedido e não é um canal público de catálogo. Publicação privada é best-effort; não será reaproveitada como garantia de entrega deste fluxo.

Referência: [pesquisa](D:/Projetos/vaptmesaflow/docs/infra-migration-query-reduction-research-2026-10-15.md). Skills de desenho orientaram separar este subsistema e explicitar falhas/custos antes de código. Nada na pesquisa substitui a revisão deste contrato. Este arquivo segue a localização canônica dos documentos de infra em `docs/`; `docs/superpowers/` é ignorado pelo repositório e não terá sua regra alterada/contornada.

## 3. Alternativas e decisão proposta

| Alternativa | Resultado | Decisão |
| --- | --- | --- |
| Cache comTTL e polling espaçado |Diminui chamadas; ainda pode acordar Neon periodicamente e atrasar atualizações|Não atende ao comportamento escolhido|
| Commit SQL e envio best-effort para WebSocket |Simples, mas crash entre commit e aviso pode perder publicação|Não usar como única garantia|
| Comando durável antes da mutação, projeçãoR2 e canal público separado |Trabalho só quando necessário, com recuperação sem varredura SQL vazia|Recomendada neste desenho|

A terceira opção reaproveita Workers Paid e buckets R2 existentes. Propõe **uma nova classe/namespace SQLite Durable Object, `PublicCatalogCoordinator`**, isolada do `RestaurantRealtime` privado, na mesma API. Há novas operações/armazenamento faturáveis, não assinatura nova nem custo zero. Não cria Redis, CDC, outro banco, outra Queue, domínio ou serviço externo. A namespace só será criada no gate remoto posterior.

## 4. Componentes e responsabilidades

### 4.1 Escrita autenticada

O gateway preserva os validadores e a autenticação atuais. Para onboarding, CRUD de itens/variações e patches de campos publicados do restaurante, encaminha um comando ao coordenador interno, com operationId, identidade/sessão verificada e payload validado. Não encaminha cookies, bearer, segredo ou chaveS3. RPC de comando não tem endpoint público anônimo.

Idempotência é obrigatória nesses comandos: mesmo operationId+mesmo ator+mesmo payload recupera o resultado; payload/ator divergente retorna conflito. A UI reutiliza a chave em retries da mesma ação, não em ações novas. No onboarding, o ID interno do restaurante é pré-alocado uma vez e guardado com a operação, sem aceitar um ID arbitrário do visitante. A unicidade de owner/slug e o rollback existentes continuam válidos.

Atualizações exclusivamente privadas, comoCNPJ, não publicam catálogo nem criam revisão pública. Patch misto mantém atomicidade: dado privado pode existir apenas na intenção privada pendente/resultado autorizado, jamais no snapshotR2 público ou frame. O corpo da intenção é apagado ao encerrar a operação; retenção máxima de intenção pendente24h, sem retries indefinidos.

### 4.2 Coordenador durável por restaurante

Persistir a intenção e agendar sua recuperação em SQLite **antes de começar a mutação Postgres**. Se essa persistência falhar, não alterar o domínio. Não depender de `waitUntil` nem de memória de processo como fila durável.

O coordenador executa ou retoma a operação por fases:

| Fase persistida | Trabalho | Recuperação após falha |
| --- | --- | --- |
|accepted|Comando validado e registrado, ainda sem resultado SQL|Tentar aplicação idempotente|
|committed|Resultado SQL/revisão e snapshot público registrados na mesma transação|Consultar resultado pelooperationId, não repetir a alteração|
|projected|Objetos/manifestsR2 confirmados na revisão correta|Concluir ready e sinalização|
|ready|Versão publicada, dados já legíveis|Repetição apenas confirma a versão; duplicata de sinal é tolerada|
|blocked|Tentativas esgotadas ou erro permanente|Sem loop automático; mostrar pendência e permitir retry autenticado|

Não executar comandos concorrentes do mesmo restaurante fora dessa disciplina. Idempotência SQL e publicação condicional protegem também contra retry enquanto uma operação anterior tem resultado ambíguo. Uma alteração já confirmada nunca é desfeita silenciosamente porque a projeção falhou.

A transação Postgres verifica sessão/ownership vigente antes de aplicar uma mutação ainda não confirmada, grava alteração, revisão e registro idempotente com o DTO público consistente. Se a sessão for revogada antes de aplicar, recusar; se já houve commit, completar sua publicação não depende de conservar uma sessão revogada. O registro de resultado impede aplicar a mesma criação/exclusão duas vezes.

Revisão é um identificador monotônico persistido no Postgres, serializado como string decimal para evitar perda de precisão JSON. Não usar relógio do browser nem a sequência do socket como versão de domínio. Escritas que disputam o mesmo restaurante/slug devem adquirir os locks de domínio antes de atribuir a revisão, para não regredir publicação/reuso de slug.

Alarmes só existem enquanto houver operação pendente. Retry com backoff limitado, até10 tentativas automáticas por fase, espaçamento mínimo5s e máximo300s; ao esgotar, estacionar e apagar o alarme automático. Não criar varredura recorrente sobre todas as branches. Timeout ambíguo exige procurar o resultado idempotente antes de reenviar a mutação. Sem garantia de conclusão durante indisponibilidade permanente: UI e métricas devem distinguir `committed/publication pending` de `ready`.

Máximo100 intenções pendentes por restaurante, uma aplicação SQL por vez; saturação rejeita novos comandos antes de alterar o domínio. Preservar limite HTTP atual1MiB e limites existentes dos schemas, sem truncar payload. Metadata de deduplicação/resultados fica até7dias, corpo privado só enquanto necessário e no máximo24h; a janela de idempotência é7dias, não infinita. Expiração privada noDO usa alarme local deSQLite, inclusive emblocked, sem reiniciar retries nem abrir conexãoPostgres. Metadata SQL expirada é ignorada e limpa oportunisticamente durante trabalhoSQL real, não por Cron que acorde banco vazio; retenção lógica de7dias não promete apagar fisicamente linhasSQL sem atividade.

### 4.3 Snapshot e roteamento noR2 privado

Usar prefixo reservado de catálogo, separado das imagens, com isolamento por ambiente/restaurante/revisão. Não tornar bucket público nem usar URLr2.dev como publicação. Cada snapshot contém **somente `PublicCatalogDto`**, esquema explícito e revisão; excluir owner, sessão, CNPJ, assinatura, emails privados, tokens e payload de comando.

Snapshots são imutáveis por revisão. Um manifesto identifica a revisão pronta de cada restaurante e o mapeamento do slug. Atualizar manifests por escrita condicional/CAS e revisão; um retry antigo não pode substituir versão nova. Não assumir transação entre múltiplos objetosR2. Ordem: objeto íntegro→mapeamentos confirmados→estado `ready`→sinal. Respostas com falha ou revisão ainda não pronta não são cacheadas como sucesso.

Troca de slug publica o novo mapeamento e uma tombstone para o antigo, com fencing de revisão/identidade. Retry de remoção do slug antigo não pode apagar o mapeamento de outro restaurante que passou a usá-lo. Aba já conectada recebe sinal de mudança de endereço ou indisponibilidade e atualiza a navegação; não fica exibindo silenciosamente uma rota que passou a representar outro restaurante.

Limite de snapshot8MiB serializados; validar tamanho antes de confirmar uma operação que o excederia, com erro explícito e rollback, sem truncamento. Manter somente revisão atual e uma anterior para recuperação; limpeza não remove um objeto ainda referenciado por manifesto. O custo/CPU desse limite precisa passar no gate local/workerd com o limite atual da API, ou a implantação permanece bloqueada — não aumentarCPU por inferência.

R2 tem consistência nas operações diretas, mas não atomicidade multiobjeto, e cacheHTTP pode servir versão anterior. [Consistência oficial](https://developers.cloudflare.com/r2/reference/consistency/). Versão imutável evita depender de purge global para a atualização correta após o sinal.

### 4.4 Leitura e canal público

Preservar o DTO do `GET /public/restaurants/:slug/catalog` para consumidores antigos; quando a funcionalidade estiver ativa, sua origem passa a ser a projeçãoR2. Novo `GET /public/restaurants/:slug/catalog-state` retorna `{version, catalog}` para o cliente versionado. Ambos têm `no-store` na resposta externa desta primeira entrega; cache interno pode armazenar apenas o snapshot imutável, por chave de revisão. Não ativar Workers Cache global em toda a API nem mexer no frontend estático.

Manifestos e registro de publicação são lidos por bindingR2, não por SQL. Slug desconhecido não dispara rebuild, não criaDO e não consulta Neon. Erro404 para slug inexistente/tombstone;503 para publicação conhecida ainda não pronta. Feature nova não serve snapshot inventado nem usa fallback silencioso paraPostgres em cada visita.

Novo upgrade público `GET /v1/catalog/restaurants/:restaurantId/socket`: validar Origin, caminho, Upgrade e limites antes do custo maior; verificar registroR2 existente antes de obter/criar sala. Não aceitar mensagens de escrita do visitante. O namespace não expõe métodos de comando pelo `fetch` anônimo. Frames públicos têm até512bytes e contêm apenas protocolo/tipo/versão e, quando necessário, slug canônico publicado; nunca detalhes de pedidos.

Usar `acceptWebSocket`, attachments e hibernação; construtor não conecta aoNeon. Primeira mensagem `ready` informa a versão publicada atual. Depois, `catalog_changed` informa versão nova. O cliente ignora versões iguais/anteriores e pede uma nova leitura se estiver atrás. Assim, mudança entre GET inicial e abertura do socket também é recuperada. Não precisa replay de todos os eventos intermediários para obter o catálogo atual.

Máximo200 sockets por restaurante; manter os rate limits públicos existentes antes da admissão e limite de frames. Conhecer oUUID não permite criar comandos ou canais de restaurante inexistente. Um socket público não exige renovação de sessãoBetterAuth a cada5min: é informação já pública, em protocolo separado. Isso **não muda** os leases dos sockets privados de pedidos/owner.

Heartbeat de transporte a cada60s, com resposta estática de plataforma e deadline10s, sem GET de catálogo ou SQL; ao falhar, reconectar com backoff1–60s, até5 tentativas consecutivas antes de aguardar retorno à aba/rede ou ação manual. Não usar um timerJS noDO para responder ping. [Hibernação](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [auto-response](https://developers.cloudflare.com/durable-objects/api/state/). Heartbeat não prova commit/publicação, apenas detecta transporte quebrado.

### 4.5 Comportamento do frontend

Um controlador compartilhado por slug/ambiente entrega estado versionado para cardápio local e delivery. Ele faz carga inicial, abre o canal, compara `ready`, e refaz GET **somente** por versão nova, retorno à aba/rede, reconexão ou ação manual. Não existe fallback4/8/30/60s de catálogo nesta funcionalidade. Falha persistente mostra estado de reconexão/última atualização, em vez de iniciar polling oculto.

Uma requisição de catálogo em voo por recurso; burst de sinais conserva apenas a maior revisão desejada e no máximo uma releitura adicional se o resultado ficar atrás. Cancelar/descartar resposta de slug anterior e desmontagem. Ao ocultar/offline, parar transporte/GET; ao voltar, obter o estado atual e reabrir. Compartilhar entre componentes da mesma página; não introduzir liderança cross-tab neste escopo.

Atualizar itens **e campos publicados do restaurante**: cores, nome, canais, mesas, regras e URLs. Remover/invalidar itens indisponíveis do fluxo de compra com o aviso atual; não apagar todo carrinho nem pedidos ao receber catálogo novo. Variação/preço alterado exige confirmação/validação do pedido, nunca cobrança pelo snapshot. Disponibilidade por horário usa os limites temporais já publicados e atualização visual local, sem consulta periódica ao banco. `version` é a autoridade de atualização pública; `updatedAt` é o valor capturado na projeção e não um heartbeat de alterações privadas/incidentes de billing na mesma linha SQL.

O dashboard apresenta separado: alteração aceita, gravação confirmada e versão publicada. Se a publicação ficar pendente, não mostrar falsa conclusão. Status/retry são autenticados por ator/restaurante; não expor comando ou resultado privado porID público.

## 5. Cobertura de escritas e compatibilidade

Antes de ativar, cobrir onboarding, criar/editar/excluir item, substituir variações, disponibilidade, aparência e todos os campos de restaurante presentes noDTO público, incluindo slug e regras de canal. Preservar atomicidade dos patches mistos. Catalog projection não deve serializar oDTO administrativo por conveniência.

O plano de implementação deve inventariar também efeitos de assinatura que alterem campos publicados, writes por Node/Coolify e atualizações administrativas. Ativação é recusada se um caminho de escrita ativo puder alterar o catálogo sem participar do protocolo. Enquanto estiver desligado, caminhos legados continuam iguais. Edição SQL manual fora daAPI exige republicação administrativa explícita e não é coberta por um CDC inexistente; não instalar replicação que mantenha Neon ativo.

Criar migrações versionadas de journal/revisão e grants mínimos; não executá-las no banco com cota esgotada. Só bootstrap autenticado/controlado dos restaurantes existentes, antes de ligar o reader novo; nenhuma criação preguiçosa por visita pública. Restaurantes novos entram no mesmo fluxo durável de onboarding. IDs/dados existentes não são apagados nem recriados.

## 6. Custos e implantação

Meta da etapa:0SQL de catálogo por visita/evento de versão/heartbeat com projeção pronta;0SQL de recuperação sem comandos pendentes;0GET periódico de catálogo em aba estável. Escritas passam a ter trabalho adicional e limitado de journal/DO/R2; não prometer menos SQL por edição isolada. [CustosR2](https://developers.cloudflare.com/r2/pricing/), [custosDO](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Adicionar flags separadas e desligadas por padrão para escrita/projeção e leitura pública nova. Publicar primeiro código compatível; bootstrap; provar recuperação; ligar reader+frontend apenas após writer completo. O rollback de leitura mantém o writer/journal capazes de finalizar intenções já aceitas; não desativar o único executor com trabalho pendente. Sem delete de namespace/bucket/schema no rollback. Não esconder retorno ao caminho legado: qualquer retorno aSQL/polling precisa ser explícito e medido.

Novo namespace, migração, grants, tráfego e artefatos remotos só após testes/CI/readback e confirmação do gate de implantação. Não contratarPaid para viabilizar o teste. Nenhum ganho desta etapa é prova de que a fatura inteira cabe emUS$20: billing e realtime privado mantêm seus custos atuais até trabalhos separados.

## 7. Provas exigidas antes de ativação

- Mutações rollbackam sem journal parcial; mesmooperationId não duplica criação/exclusão/primeiro item; chave conflitante/ator errado é rejeitado. Revogação antes da aplicação bloqueia; revogação após commit não perde publicação pública já legítima.
- Encerrar execução após cada fronteiraaccepted/commit/R2/manifest/ready/sinal e reiniciar: resultado converge sem repetir mutação nem regredir versão. Incluir timeout comR2/SQL ainda em voo, retry duplicado e término das tentativas.
- Escritas concorrentes, slug trocado/reutilizado por outro restaurante, tombstone, patches mistos, onboarding e todos os writers ativos. DTO público nunca inclui campo privado.
- Nenhum comando pendente: constructor, GET, admissão, ready e heartbeat não consultamPostgres e não deixam alarmeSQL recorrente. Slug/UUID inválido não criaDO.
- Dez abas estáveis por relógio fake: zeroGET de catálogo após bootstrap/conexão; uma edição provoca atéuma leitura nova por aba, salvo interrupção documentada. Componentes da mesma página não duplicamGET.
- Evento durante fetch, mensagem duplicada/fora de ordem, evento perdido por socket desconectado, fechamento/demora de handshake, retorno à aba, troca de slug, redeoffline, tamanho máximo e falha parcial de snapshot. Não reaproveitar credenciais nem repetir testes deStripe/Resend já concluídos.
- Testes de autorização/isolamento/limites e suites existentes verdes; workerd comR2/DO reais locais; deploypreview e canário remotos só quando capacidade estiver disponível, com SQL contado por agregados sem payloads/credenciais. Sem ampliar coleta de logs reprovada.

## 8. Estado e próximo passo

Desenho aprovado pelo usuário em15/10/2026. Nenhum código, schema, recurso, binding ou tráfego alterado nesta fase documental. Próximo gate: revisão do [plano de implementação](D:/Projetos/vaptmesaflow/docs/infra-migration-public-catalog-event-driven-plan.md), com tarefas/TDD e execução direta/inline já escolhida. Aprovar o desenho não ativa recursos remotos nem autoriza Neon pago.
