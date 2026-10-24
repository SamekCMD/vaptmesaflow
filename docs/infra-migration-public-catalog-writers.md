# Inventário de writers do catálogo público

Checkpoint24/10 posterior: [leitura privada real concluída](infra-migration-catalog-reader-canary-2026-10-24.md), quatroGET200/8MiB/maxCPU245,860ms e fechamento36/flagsfalse/limpezaindependente530bytes; não repetir. [Bootstrap sem carga confirmado](infra-migration-catalog-bootstrap-readiness-2026-10-24.md): preview0restaurantes/itens/journal/revisions; transporte emRAM preparado/testado para futuro alvo explícito, nenhumapply/seed. ProduçãoREADONLY0restaurantes/itens/users/sessions/outboxes selecionadas, seis tabelas-marcadoras canônicas ausentes. Não criarestaurantes para satisfazerbootstrap nem inferirwritersprod/DDL/deploy autorizados. Próximo é gatepareado deprodução/backup, mantendo cobertura dewriters separada.

Checkpoint24/10: [writer DO exercitado remotamente por um rebuild8MiB sintético](infra-migration-catalog-preview-canary-2026-10-24.md), receipt ready/committed, CPU atribuído e limpeza verificada. Janela33 fechada em34, reader/writerfalse/CPU1000. Isso prova esse caminho canônico no preview, não ausência de writers legados em produção ou cobertura runtime de toda entrada da tabela. Nenhuma alteração Coolify/DNS/produção. Não repetir o canário encerrado ou repinar seus guards.

Checkpoint posterior23/10: [browser privado concluído](infra-migration-frontend-preview-browser-2026-10-23.md), Preview32 e cleanup confirmado; [diagnóstico local de CPU capturado](infra-migration-catalog-cpu-local-2026-10-23.md), sem CPU remota certificada. Não repetir smoke/rotação/migrations/Bpreview. A tabela de entradas canônicas abaixo é inventário de fonte, não prova de ausência de writers remotos. Separar a futura janela sintética de preview da cobertura de produção; nenhuma mudança Coolify/DNS foi feita ou exigida para este diagnóstico local. Flags remotas permanecemfalse.

Atualização23/10,18:01UTC: [consumidor Bpreview canônico promovido](infra-migration-billing-preview-promotion-2026-10-23.md) com autorização própria, versão95e3a026; source exato/readback/configuração/filas/segredos/cron30min e controles aprovados. Não é writer do catálogo nem prova de envio runtime; não gera snapshot por email/billing privado. Bproduction/frontend continuam anteriores, sem mudança de flags/schema/main. Não repetir a publicação de Bpreview; o inventário17:31 abaixo conserva a situação anterior a essa promoção. Gates de clientes/writers/CPU/bootstrap continuam abertos.

## Conferência remota23/10 — ainda não liberar catálogo

[Versões de clientes/consumidor ativas](infra-migration-active-clients-consumer-2026-10-23.md): produçãoweb09/10, Bpreview/production29/09; B publicado ainda usa restaurante/owner em vez do contato canônico de organização. Os cron30min/filas/consumer IDs e nomes/tipos de secrets foram conferidos sem alterações. Domínios públicos atuais vinculam web/API aos Workersproduction, não certificam ausência de writers diretos Node/Coolify. Frontend/consumidor canônicos existem localmente, mas não foram publicados por este gate; testes focados e dry-run não são runtime remoto. Smoke da API Preview31 permanece aprovado. Próximo gate proposto: somente Bpreview, com preflight de pendências/identidade, sem purge nem rollback owner-only; requer autorização de publicação. Reader/writer continuamfalse; CPU/bootstrap/produção/main separados. As referências históricas seguintes não anulam esse resultado nem autorizam repetir etapas concluídas.

## Atualização22/10 — contrato canônico após a paridade tenant

Inventário do código candidato F`a4eb545`/A`7d5604f`, não dos processos atualmente implantados. A [restauração de paridade](infra-migration-tenant-parity-verification.md) e suas decisões superam as referências owner-only do snapshot histórico abaixo. Tarefas5/9/10 do catálogo continuam abertas para evidência remota; não reexecutar os testes históricos como substituto.

| Writer / efeito | Entrada canônica | Fronteira e publicação |
| --- | --- | --- |
| Criar unidade/draft | POST `/account/onboarding-draft` ou `/organizations/:organizationId/restaurants/drafts` | Sessão vigente, membership/capacidade da organização; draft não aparece no catálogo nem aceita pedido público |
| Salvar configuração do draft | PATCH `/restaurants/:restaurantId/onboarding` | Alvo explícito e permissão de gerenciamento; não significa publicação concluída |
| Concluir onboarding | POST `/restaurants/:restaurantId/onboarding/finalize` | Com writer ligado, comando `onboarding.finalize` no coordenador; replay não reinicia trial nem cria outra revisão já concluída |
| Dados, canais, mesas e marca do restaurante | PATCH `/restaurants/:restaurantId` | `restaurant.manage`; patch público/misto segue o journal inteiro, CNPJ isolado não publica revisão |
| Item, disponibilidade, variações, chef e referência de imagem | POST/PATCH/DELETE `/restaurants/:restaurantId/menu-items[/:itemId]` | Membership e filho no mesmo restaurante; aplicação e snapshot atômicos com writer ligado |
| Upload/retirada de imagem de item | POST `.../menu-items/:itemId/image/upload`; DELETE `.../menu-items/:itemId/image?objectKey=...` | Coordenador com writer ligado, lease e bytes preservados no retry; chave `restaurantId/itemId/objectId` |
| Upload/retirada de logo | POST `.../branding/image/upload`; DELETE `.../branding/image?objectKey=...` | Somente writer ligado; mesma quota/sala, chave `restaurantId/branding/objectId`; não cai no storage legado |
| Reconciliação de imagens | POST `/restaurants/:restaurantId/menu-images/reconcile` | Ação autenticada de gerenciamento, limitada a10 verificações; nunca devolve quota só pelo TTL |
| Republicação/bootstrap | POST `/restaurants/:restaurantId/catalog/rebuild` | `restaurant.manage`, writer obrigatoriamente ligado e chave de operação preservada; alvo arbitrário não concede acesso |
| Status/retry de publicação | GET `/restaurants/:restaurantId/catalog-operations/:operationId`; POST `.../:operationId/retry` | Alvo e ator reautorizados; resultado privado não é público por conhecer operationId; retry manual, sem polling automático |

São os mesmos campos públicos enumerados no snapshot abaixo, não uma nova allowlist. Alterações privadas de billing SaaS e progresso de ativação não publicam catálogo. Estado financeiro saiu do DTO operacional; staff usa features/operationActive do bootstrap sem `billing.read`. Pedidos, cozinha, caixa e realtime privado não são writers de catálogo.

Rotas `/me` são apenas adapters de compatibilidade: zero unidades acessíveis não seleciona nada, múltiplas retornam409 `restaurant_selection_required`; preferência de outra aba não resolve o alvo de uma mutação. O antigo POST `/onboarding` retorna410 e não deve ser usado por novos operadores. Autorização é membership ativa/capability, não `owner_id` como bypass.

Produto e logo compartilham100MiB, incluindo versões retidas e reservas pendentes; input5MiB, output1MiB/1200px. Lease SQLite é atualizada em lugar, sem reset de counters/fences. Limpeza continua protegida por locks comuns, revisões e referências de snapshots atual/anterior e comandos não resolvidos. A confirmação do upload não substitui confirmação da publicação.

Fastify/Node e clientes antigos ainda precisam de inventário **remoto**: código compatível com tenancy não comprova participação no coordenador DO. Não liberar reader enquanto qualquer writer ativo puder gravar domínio/objetos fora do protocolo. Nenhum processo Coolify foi alterado ou removido nesta inspeção.

Rastreamento: A`src/worker/catalog/writer.ts`, `src/worker/routes/{account,restaurant,misc}.ts`, `src/modules/catalog-publication/transaction.ts`; F`src/lib/{catalog-mutations,restaurant-assets,menu-image-storage}.ts`. [Readiness e ordem de promoção](infra-migration-promotion-readiness-2026-10-22.md). O restante preserva os checkpoints datados15–18/10, não instruções owner-only a executar no candidato atual.

Data:15/10/2026. Escopo: [plano aprovado](D:/Projetos/vaptmesaflow/docs/infra-migration-public-catalog-event-driven-plan.md), T5. Inspeção de código local; não é prova de tráfego ou configuração remota. Flags novas seguem ausentes/desligadas nos arquivos de implantação existentes.

## Escritas de domínio

| Dados publicados | Entrada Worker | Protocolo preparado |
| --- | --- | --- |
| id, nome, slug e primeiro prato | POST /onboarding | Comando durável; UUID interno estável por owner; mesma sala para diferentes chaves; unicidade SQL de owner/slug preservada |
| name, slug, whatsapp, address, phone, hours, description | PATCH /restaurants/me | Patch público passa inteiro ao coordenador, inclusive campos privados de patch misto; só DTO público vai à projeção |
| primaryColor, secondaryColor, fontFamily, logoUrl | PATCH /restaurants/me | Mesmo comando de restaurante; sem serializar DTO administrativo |
| totalTables, maxTables, paymentMode, maxPendingOrders, localEnabled, deliveryEnabled | PATCH /restaurants/me | Mesmo comando; compra e limites continuam validados na origem |
| id, restaurantId, name, price, description, category, available, imageUrl, availableFrom/Until, badge, isChefSuggestion, prepTimeMinutes, createdAt, updatedAt | POST/PATCH/DELETE /restaurants/me/menu-items[/:itemId] | CRUD/remoção transacionais, journal e snapshot juntos; exclusividade isChefSuggestion incluída na mesma transação |
| variations: id, name, options, required e ordem | Criar/editar item | Substituição de variações dentro da mesma transação; não há endpoint avulso fora do comando |
| updatedAt do restaurante | Capturado no snapshot | Não é versão de publicação; alteração privada/billing que apenas muda updated_at não publica |
| Republicação administrativa | POST /restaurants/me/catalog/rebuild | Autenticada, limitada ao owner e à chave de operação; não aceita restaurantId arbitrário no corpo |

Os arquivos de domínio ficam na API em `src/modules/restaurants`, `menu` e `catalog`; o gateway fica em `src/worker/catalog/writer.ts` e `src/worker/routes/restaurant.ts`. Helpers transacionais preservam o caminho legado quando a flag está desligada.

CNPJ isolado não passa pelo journal público nem cria versão/socket. O protocolo opt-in pode devolver resultado autenticado com recibo ready/version=null, mas isso não significa publicação de CNPJ ou nova versão de catálogo. Patches mistos não são divididos em duas gravações.

## Escritas que não publicam

- Stripe em `src/modules/billing/stripe/repository.ts` e `webhook-repository.ts` altera cliente/assinatura/checkout/plano/status e updated_at. Nas implementações inspecionadas não altera max_tables nem outro campo público além do timestamp; não gerar evento público para esse ruído.
- Pedidos, cozinha, pagamentos, table sessions, notificações e outbox não participam deste protocolo; nada autoriza alterar seus intervals/leases nesta tarefa.
- SQL manual e scripts de smoke de infra não são CDC. Se usados para editar dados reais fora da API, exigem rebuild administrativo explícito antes da liberação do reader.

## Imagens: gate ainda aberto

Inspeção mostrou um writer adicional de **conteúdo de objeto**, não apenas de imageUrl:

- `src/modules/storage/service.ts` assina PUT sempre para a chave `restaurantId/itemId`; um segundo upload sobrescreve a mesma URL pública antes do PATCH de catálogo.
- DELETE de imagem remove essa mesma chave sem verificar snapshots publicados.
- `src/pages/dashboard/MenuManagement.tsx` remove imagem antes de excluir item; na edição também precisa distinguir gravação/publicação/limpeza.

Assim, só encaminhar CRUD ao coordenador não cobre esse writer. **Ativação permanece bloqueada** até que upload não sobrescreva uma imagem publicada, exclusão não remova um objeto ainda referenciado e a UI espere a publicação correta antes de limpar. A integração de imagens exige testes de armazenamento e frontend; não declarar T5 completa apenas porque os novos testes do gateway passaram. Não habilitar lifecycle destrutivo nem tornar bucket público para contornar o problema.

Integração local preparada: com `PUBLIC_CATALOG_WRITER_ENABLED=true`, as rotas de imagem em `src/worker/routes/misc.ts` usam o mesmo coordenador owner-scoped; nunca caem nos métodos mutáveis legados. `image-service.ts` revalida sessão/dono/item antes de preparar upload. A limpeza exige `objectKey` explícito de três UUIDs (restaurante/item/objeto), sem item ainda existente após remoção, e mantém o lockSQL de owner/sessão até terminar a alteraçãoR2. Só permite limpar se não houver comando não publicado, a revisãoSQL for igual à revisão prontaR2 e nenhum dos dois snapshots retidos referenciar a imagem (também logo; query/fragment não confundem a identidade do objeto).

O applier exige validaçãoR2 de qualquer nova referência de imagem **após adquirir o mesmo lockSQL de owner**, antes de alterar domínio. Assim, uma gravação atrasada não pode associar uma imagem já aposentada depois de esperar pelo lock. A fila interna compartilhada também impede intercalar limpeza e publicação dentro da mesma instância. Prova local acrescentada17/10: PostgreSQL18.6 real, SQLite real e adapters de armazenamento/projeção controlados, sem filaJS compartilhada para esconder a corrida. Testados exclusão→associação, associação→exclusão com revisão/snapshots retidos e logout concorrente. Dez testes PG totais aprovados. Isso não certifica a composição remota R2/Hyperdrive/DO, deadlines sob carga ou CPU; estes gates permanecem.

Referências legadas `restaurantId/itemId` seguem utilizáveis após comprovar drenagem de URLsPUT antigas no corte, mas não são apagadas automaticamente pelo protocolo novo. Permanecem contabilizadas no inventário/cota. LogosHTTPS externos continuam compatíveis; novas referências a objetos de outro restaurante na origemR2 são recusadas. Frontend convertido localmente naT8 trata replay `state=uploaded`, passa a chave antiga correta e espera publicação antes da limpeza. A cobertura dos clientes realmente ativos ainda precisa ser comprovada; não ativar flags com clientes legados ativos.

Decisão explícita revisada pelo usuário: **100 MiB (104.857.600 bytes) de imagens por restaurante**, substituindo os50MiB iniciais; soma objetos atuais, versões retidas e reservas pendentes. Seleção de JPG/PNG/WebP até5MiB; `src/lib/menu-image-optimization.ts` converte antes da assinatura/upload, preferindoWebP, maior lado até1200px, meta300KiB e teto1MiB enviado. Backend valida esse teto independentemente do navegador. FallbackJPEG apenas para fonteJPEG; PNG/WebP mantém fallbackPNG para não perder transparência. Não contratar Cloudflare Images nem instalar codec/dependência para esse fluxo. Reserva não expira financeiramente junto com a URL: um PUT com resposta perdida pode ainda estar em andamento. Só liberar bytes após descarte confirmado e protegido contra reuso da URL. A cota não é um teto da fatura de requisições Cloudflare.

Proteções locais em preparação: reserva durável antes do armazenamento, no máximo dez uploads pendentes e inventário limitado a mil objetos por restaurante, com falha fechada se o inventário não puder ser lido integralmente. Esses limites técnicos controlam trabalho/estado; não alteram o plano contratado. A compressão está integrada ao cliente local; o protocolo durável de cota/limpeza continua sem integração/ativação remota.

Medição local do encoder real Chromium em15/10, somente imagens sintéticas; tempos não representam celulares lentos nem garantia de qualidade para qualquer foto:

| Entrada | Original(bytes) | Fluxo anterior(bytes) | NovoWebP(bytes) | Tempo(ms) |
| --- | ---: | ---: | ---: | ---: |
| PNG detalhado2400×1600 | 3838014 | 160226 | 95140 | 149 |
| JPEG detalhado2400×1600 | 783798 | 159590 | 95994 | 169 |
| PNG transparente300×150 | 1592 | 1592 | 866 | 8 |
| PNG ruído1200×800 | 3303892 | 3303892 | 307120 | 614 |

Teste de transparência confirmou alfa0 no canto e pixelcentralRGBA[255,1,0,255]; arquivo corrompido foi rejeitado. O caso de ruído precisou reduzir para960×640; demais fotos ficaram1200×800 sem ampliar fontes pequenas. Não guardar originais, transformar a cada visualização, nem prometer que toda imagem terá poucosKB. Até9 encodes com qualidade0.82/0.72/0.62 em3 escalas (mais1 caso de fallback); se a meta não for atingida, aceitar apenas resultado≤1MiB ou mostrar erro, sem reduzir qualidade indefinidamente.

## Node/Coolify e outros consumidores

Fastify/Node ainda possui rotas legadas usando os mesmos repositórios com transações próprias, mas sem intenção DO anterior. Isso é compatibilidade de código, **não prova de que pode escrever no banco de produção durante o novo reader**. O gate remoto deve comprovar que nenhum writer Node/Coolify ativo contorna o protocolo, ou integrá-lo antes de ativar. Não alterar DNS, investigar Easypanel/Vercel legado, remover servidor ou presumir aposentadoria a partir deste inventário.

Clientes sem opt-in mantêm DTO/201/204 quando a operação está ready; pendência deve retornar202 explícito. Todos os clientes ativos precisam tratar esse protocolo antes do corte. Na resolução de operações, restaurantId opcional em query só pode ser o restaurante pertencente à sessão ou seu endereço de onboarding derivado pelo servidor; metadados/resultados nunca são públicos por operationId.

## Critérios de liberação

1. Testes do gateway, repositórios, imagens e frontend verdes, com prova local workerd e integração PostgreSQL real. A prova PostgreSQL local chegou a dez testes em17/10, incluindo os três cenários concorrentes imagem/SQL acima; isso não certifica composição remota, permissões ou todos os deadlines/falhas de armazenamento.
2. Nenhum caminho ativo de domínio ou imagem sem cobertura; evidência de Node/Coolify e consumidores reais antes do corte.
3. Bootstrap e recursos remotos confirmados no gate próprio, inclusive privacidade real do R2 e CPU1000ms; sem novo plano pago para executar testes.
4. Nenhuma flag ligada por este documento. Rollback do reader não desliga o executor de operações aceitas.

## Checkpoint local — 16/10/2026

Etapas6/7 implementadas localmente, commits API`24f40c1` e frontend`bfdec54`: GET público versionado/legado pelo R2 com no-store, canal público isolado com hibernação e controlador compartilhado sem polling de catálogo. O teste workerd provou upgrade101, ping/pong automático, reconstrução após eviction e sinal com versão acima de2**53, sem Hyperdrive nem criação de serviços SQL/auth. Teste de10 abas com relógio simulado por1h manteve somente a leitura inicial por aba. Isso não mede redução real da fatura nem estabelece teto monetário.

Etapa8 integrada localmente: cliente autenticado opt-in e feedback nas páginas de cardápio, aparência, configurações e onboarding distinguem aceitação, gravação pendente, bloqueio e publicação. Status/retry são manuais, preservam operationId; resultado ausente recarrega o recurso autenticado e não é inventado. Avisos reutilizam Alert/Button. Cardápios local/delivery usam estado publicado completo quando a flag está ligada, sem intervalo8s nem GET de catálogo por edição do carrinho; horários avançam com timer local no próximo limite. Slug preserva query/estado do mesmo restaurante, canal pausado preserva carrinho/acompanhamento e bloqueia novas compras, e respostas de pedidos atrasadas não atravessam tenants. O legado permanece explícito quando a flag está desligada. **Não ativar flags nem declarar polling eliminado no site atual**.

Imagens no novo protocolo: descritor exige chave do tenant/item, ETag condicional e Content-Type correspondente; replay já enviado não repete PUT. A limpeza só é solicitada após publicação ready, para a chave antiga exata, e o servidor ainda impede apagar referências retidas. PATCH da imagem tem operationId próprio. No protocolo legado, a exclusão precisa ocorrer enquanto o item existe e substituição não pode apagar a chave mutável recém-enviada; essa ordem continua preservada somente com a flag desligada. Criação pendente não inicia automaticamente outro upload ao verificar status: o operador reabre a edição para selecionar a imagem. Bloqueio de ações na interface é por página, não um lock global entre abas.

Evidência nesta continuação: frontend280/280 em57arquivos e build local aprovados; depois, regressão adicional de exclusão legada RED→GREEN e18/18 testes de management/imagem aprovados. ESLint dos arquivos alterados sem erros; avisos de dependência em PublicMenu corrigidos usando identidade estável, sem causar leitura por evento. Checagem direta do app ainda apresenta21 diagnósticos anteriores (um conflito de displayId foi alinhado à compatibilidade de valores já salvos); nenhum diagnóstico novo nos módulos de catálogo. O comando legado `npm run typecheck` não verifica sozinho o projeto referenciado. Esse gate completo continua vermelho; não confundir bundle gerado com tipos integralmente corretos. API não alterada nesta continuação; último checkpoint660/660 unitários e6/6 workerd locais.

Integração PostgreSQL real, CPU8MiB, privacidade R2, cobertura de writers ativos e revisão final continuam pendentes. Nenhum deploy, migração SQL remota, push/main, recurso ou assinatura foi criado neste checkpoint.

Próxima tarefa local9: runtime/config/rollback, incluindo separar o controle do reader do tratamento de recibos do writer antes de qualquer ativação. [Consolidação das branches e etapas restantes](infra-migration-branch-integration.md) registra os dois repositórios e a ordem de integração; não fazer merge cego de código legado nem supor que push na main incorpora outras branches.

Atualização da tarefa9: flags do reader/writer frontend separadas e rollback readerfalse/writertrue validado no hook e na tela/imagens; builds normais fixam ambasfalse. Suítes finais293/293 frontend,660/660 API,29/29 workerd e25/25 guards de configuração, com builds locais aprovados. Lint dos arquivos alterados passou; lint frontend geral, excluindo o checkout API e artefatos gerados, ainda tem6 erros `any` em fixtures de caixa/cozinha não alteradas, além de4 avisos. TypeScript real continua com21 diagnósticos anteriores. Não declarar gates globais verdes.

Consulta remota somente leitura16/10: `vapt-assets-preview` temr2.dev público; production está comr2.dev desligado; nenhum custom domain em ambos. O snapshot não pode ser gravado no bucket público preview. Em17/10 o usuário aprovou separar snapshots privados por ambiente, somente código/configuração nesta etapa. Candidatas `vapt-catalog-preview`/`vapt-catalog-production` usam `PUBLIC_CATALOG_BUCKET`; imagens permanecem em `R2_BUCKET`. GET/legado/socket e executor não fazem fallback para imagens/SQL. Cleanup físico de imagens continua no bucket antigo, mas suas referências retidas vêm da projeção privada. Os novos recursos não foram criados, portanto privacidade real/readback ainda não estão provados. Nenhum recurso, ACL, DNS ou objeto remoto foi modificado. [Rollout e rollback](infra-migration-public-catalog-rollout.md) detalha os gates. PostgreSQL real sem banco isolado local, CPU8MiB sem mediçãoCPU e caminho de deploy definitivo continuam pendentes, assim como bootstrap/revisão final. A tarefa8 está concluída localmente; a9 permanece parcial.

Continuação local17/10 — tarefa10: CLI de bootstrap preparado com dry-run sem rede, um alvo UUID explícito, ambiente/origens fixos, confirmação de projeto/branch e reconhecimento de readiness/cobertura de writers. Apply usa sessão do dono em memória/entrada protegida, valida restaurante autenticado antes de rebuild, preserva operationId e nunca faz retry/polling automático. Não ativa reader/writer nem cria recurso; confirmações do operador não substituem prova remota. Testes do cliente não certificam idempotência SQL. A tarefa10 está implementada localmente, com execução real pendente; tarefas2/5/9 e revisão/gates remotos continuam abertas.

Atualização posterior17/10 — tarefa2 concluída localmente: PostgreSQL18.6 em cluster descartável loopback, sete testes aprovados, incluindo rollback, repetição concorrente, disputa/reuso de slug, limite UTF8, revogação durante lock e retenção limitada. Ambos os grants009 executados sem edição em outra base do mesmo cluster local, com privilégios extras/DDL negados. Servidor encerrado; nenhum Neon, serviço Windows, schema remoto ou assinatura alterado. API663/663 e build aprovados. Substitui a pendência de falta de banco local dos checkpoints anteriores, não suas demais ressalvas. Restam tarefas5/9/10, incluindo writers ativos, CPU, privacidade/readback, deploy, bootstrap e revisão final. Evidência em A `docs/public-catalog-postgresql-verification.md`; a migração principal permanece na Etapa13 e não está concluída.

Continuação17/10 — proteção de deploy preparada: aliases antigos public/realtime/observability da API bloqueados com exit1 antes de Wrangler, pois omitem bindings/migração do catálogo. Operador oferece checks offline preview/production e bundle production com dry-run fixo, sem repassar overrides;51 testes de configuração/operação aprovados. CI preparado para repetir guards/bootstrap/checks/bundle sem publicar, ainda não executado remotamente. Preview nomeado não tem dry-run equivalente neste Wrangler: check estrutural não certifica seus bindings/readback. Nenhuma mudança na API em execução; publicação/rollback remoto, CPU e demais gates de5/9/10 continuam pendentes.

Mesma proteção aplicada aos aliases frontend `deploy:preview`, `deploy:production` e `deploy:production-realtime`, para não publicar artefato legado incompatível durante a migração;18 guards frontend aprovados. Builds/verificação de artefatos continuam disponíveis e os serviços publicados não são alterados. API663/663, workerd29/29 e regressão de scripts113/113 nesta continuação. A task9 permanece parcial e o total formal é7/10; nenhuma permissão de execução remota é inferida do bloqueio local.

Checkpoint remoto17/10 autorizado separadamente: criados somente os buckets privados `vapt-catalog-preview` e `vapt-catalog-production`, Standard/ENAM; GETs confirmaram r2.dev desativado, nenhum custom domain e zero objetos/bytes reportados. Imagens preservadas (preview r2.dev público, production desligado, sem custom domains). Nenhum token/secret/objeto de teste, ACL de imagens, namespace, deploy, flag, schema ou plano alterado. Binding candidato ainda não foi implantado. Evidência em A `docs/public-catalog-r2-privacy-verification.md`. Criação/readback dos recursos concluídos; cobertura de writers, CPU, implantação/readback do runtime, bootstrap e revisão seguem pendentes, total7/10.

Checkpoint local de qualidade17/10: substitui a pendência de21 diagnósticos de tipos e6 erros de lint dos registros anteriores. Typecheck agora verifica os dois projetos frontend (app e node/Vite), exit0 sem editar AuthContext ou mascarar inferência com casts;293/293 testes, build local e18/18 guards aprovados. Lint geral exit0, zero erros/quatro avisos de hooks anteriores preservados para revisão. [Evidência e limites](infra-migration-public-catalog-frontend-verification.md). Não altera writers ativos, versão publicada ou flags e não substitui CPU/runtime/rollout/revisão/bootstrap; tarefa9 segue parcial,7/10 formalmente concluídas.

Atualização18/10 — revisão local: painel conserva a lease de upload por arquivo/owner/item nos retries de descritor/PUT. Novo writer-only POST `/restaurants/:restaurantId/menu-images/reconcile` redescobre até10 leases expiradas por ação manual do dono, inclusive após exclusão202/fechar a página. Não precisa de alvo guardado no browser nem novo Cron: usa SQLite durável existente, revalidação/locks owner+sessão e revisão SQL igual à projeção privada; atual/anterior continuam protegidos e quota só diminui após retirada física/fence. Imagens legadas sem lease ficam fora da remoção automática. Frontend313/313, API670/670, PostgreSQL11/11 e workerd29/29; seis achados da revisão corrigidos localmente, sem segunda revisão. [Alcance e decisões](infra-migration-public-catalog-review.md). Inventário dos writers efetivamente em execução ainda não certificado, nenhum endpoint ativado remotamente.
