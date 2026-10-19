# Restauração de paridade — organizações, restaurantes e equipe

Data: 19/10/2026. Estado: **especificação aprovada pelo usuário; plano de implementação preparado para revisão; implementação não iniciada**.

O usuário aprovou prosseguir com a abordagem de port seletivo em 19/10, após a [auditoria funcional](../../infra-migration-functional-parity-audit-2026-10-18.md), e confirmou continuar após receber esta especificação escrita. O [plano detalhado](../plans/2026-10-19-tenant-parity-restoration.md) foi então preparado; sua revisão continua pendente. Nenhuma dessas aprovações autoriza operações remotas.

## 1. Objetivo e fronteiras

Preservar as funcionalidades já decididas, recuperando os comportamentos úteis das branches históricas sobre a arquitetura atual: React, API Workers/Fastify, Better Auth, Neon, Hyperdrive e R2. Uma conta pode participar de várias organizações; uma organização pode possuir vários restaurantes conforme seu plano. Assinatura SaaS e membros pertencem à organização; catálogo, operação, imagens e pagamentos de pedidos pertencem ao restaurante.

Aceite global: nenhuma operação usa o dono como substituto implícito do restaurante selecionado; permissões são verificadas no servidor; trocar restaurante não mistura dados, cobrança, arquivos ou respostas pendentes. Starter e Pro permitem 1 restaurante por organização; Business até 25; trial permite 1. Os preços atuais e o trial atual de 3 dias não mudam nesta restauração.

Não incluir: Supabase/JWT antigos, RLS/PostgREST no navegador, Neon Auth gerenciado, novo provedor, novos serviços pagos, DNS, Stripe Live, importação de contas/UUIDs descartáveis, convites automáticos ou um painel novo de gestão de equipe. A base histórica comprova memberships e papéis, mas não comprova um fluxo completo antigo de convites por UI. Restaurar autorização por equipe não será apresentado como entrega desse fluxo inexistente.

## 2. Estratégia selecionada e decomposição

Port seletivo de comportamento e testes, não merge integral do baseline antigo. As duas alternativas descartadas são: restaurar as branches antigas integralmente, o que recuperaria dependências de infraestrutura abandonadas; ou remover apenas o índice/seletor, o que deixaria SQL capaz de atualizar vários restaurantes do mesmo dono.

O trabalho será dividido em entregas locais dependentes. Cada uma permanece sem publicação automática; a paridade só estará concluída depois do conjunto integrado.

| Entrega | Fronteira / responsabilidade | Aceites da auditoria |
| --- | --- | --- |
| A — fundação tenant | Schema aditivo, memberships, capabilities, seleção explícita e escopo dos repositórios/rotas | P01, P03, P10 |
| B — assinatura da organização | Stripe, associação de recursos, webhooks, outbox e consumidor de emails, sem cobrança duplicada | P04, P10 |
| C — conta e onboarding | Bootstrap, preferência, seletor, criação autorizada, draft/finalização e estado isolado | P02, P05, P09 |
| D — ativação e marca | Progresso no servidor, logo persistente, quota única e UX de slug | P06, P07, P08, P09 |
| E — reconciliação final | Testes de produto, revisão, compatibilidade, gates remotos e integração dos dois repositórios | P01–P10 |

A ordem do plano deverá manter compilação/testes coerentes entre entregas; não habilitar múltiplos restaurantes num ambiente enquanto billing, SQL e consumidores ainda assumirem um dono/um restaurante. A auditoria continua como matriz de rastreabilidade, incluindo as funcionalidades presentes/substituídas, não apenas as lacunas.

## 3. Modelo de dados canônico

Adicionar migrations posteriores às atuais 001–009; não reescrever 004 ou aplicar as migrations Supabase. Ensaiar tanto uma instalação vazia com todo o histórico quanto uma instalação com registros sintéticos no formato atual.

| Relação | Identidade / invariantes |
| --- | --- |
| organizations | UUID, nome e criador; não depende de um único restaurante para existir |
| organization_members | Chave única organização+usuário Better Auth; role owner/admin/manager/staff; status active/invited/disabled; só active autoriza |
| restaurants.organization_id | FK obrigatória após backfill validado; associação imutável pelas rotas comuns; owner_id permanece apenas para compatibilidade/histórico |
| organization_subscriptions | Uma linha por organização; fonte canônica de plano, status, trial, Customer/Subscription/Checkout Stripe e metadados de reconciliação |
| account_preferences | Uma linha por usuário; organização/restaurante preferidos sempre revalidados contra membership e associação atuais |
| onboarding do restaurante | Status draft/complete, etapa e timestamps do servidor; rascunho conta no limite de restaurantes |
| restaurant_activation_progress | Chave única restaurante+módulo; estado compartilhado da ativação desse restaurante, não uma chave global do navegador |

Backfill: uma organização por dono existente e membership owner ativa; associar seus restaurantes e preservar os IDs já presentes no banco atual. Isso é adaptação relacional local, não restauração de UUIDs do Supabase. Proprietário sem identidade válida ou dados de cobrança incompatíveis interrompem a migration com diagnóstico sem secrets; não apagar, escolher silenciosamente um registro ou inventar identidade para prosseguir. Preferências podem começar vazias; conclusão atual pode ser mapeada para complete, sem inventar progresso de ativação a partir do localStorage.

Customer, Subscription e Checkout não podem pertencer a duas organizações. Conflitos impedem a promoção. Índices e constraints de unicidade deixam de usar restaurante como identidade SaaS quando o port estiver coerente. As colunas antigas ficam durante a compatibilidade como legado, não como uma segunda fonte de plano.

Não há credencial de banco no frontend. Grants novos serão mínimos e versionados para os papéis preview/production atuais; testes devem negar administração, autoelevação de membership e alterações de plano por caminhos não autorizados. Escritas de membership não serão expostas por um CRUD genérico. Provisionamento da primeira organização/owner ocorre apenas dentro do onboarding autenticado e atômico.

## 4. Autorização e isolamento operacional

Manter Better Auth para identidade/sessão. Papel da sessão não concede papel de organização. O servidor resolve restaurante→organização→membership ativa e a capability necessária; IDs e papéis enviados pelo cliente nunca concedem autoridade.

| Capability histórica | Papéis permitidos | Aplicação |
| --- | --- | --- |
| restaurant.read | owner/admin/manager/staff | Leitura operacional e admissão realtime privada |
| restaurant.operate | owner/admin/manager/staff | Cozinha, caixa, confirmação de pagamento manual e ingestão operacional autenticada |
| restaurant.manage | owner/admin/manager | Restaurante, cardápio, marca, imagens, publicação e reconstrução |
| billing.read | owner/admin/manager | Estado seguro da assinatura e status de conexão de provedor |
| billing.manage | owner/admin | Checkout/Portal SaaS e conectar/desconectar provedor de pagamento |

Criar restaurante exige owner/admin e entitlement válido. Membros de uma organização acessam os restaurantes dessa organização segundo essa matriz; não inventar uma ACL por restaurante nem novos papéis. Um usuário com memberships em duas organizações não compartilha os respectivos planos.

Cada repositório operacional recebe userId e restaurantId explícitos. Predicados incluem o restaurante e o vínculo; atualizar/delete exige também a identidade do recurso filho. Não basta trocar o checker central: revisar restaurants, menu/variations, kitchen, overview, table-sessions, storage, ingest, pagamentos manuais, OAuth, billing, realtime e executor/imagens do catálogo. Nenhum UPDATE permanece filtrado somente por owner_id.

Leituras não dependem de autorização cacheada indefinidamente. Mutações revalidam vínculo/capability no limite transacional; erro de banco nega a operação, sem preservar uma autorização anterior. Revogar membership durante uma operação tem ordenação definida: se a mutação foi autorizada e comprometida antes da revogação, seu efeito não é desfeito; nova mutação após revogação é negada.

O contrato de locks deverá ser único para applier e imagens: lock da operação quando houver, organização para entitlement/revogação, restaurante, locks de slug ordenados, linhas e sessão. Operações de usuários diferentes no mesmo restaurante não podem se proteger apenas por lock do usuário. Criação/contagem serializa por organização; mutações de restaurantes distintos não precisam de exclusão mútua de toda a organização. A implementação deve especificar locks compartilhados/exclusivos e testar as corridas antes de substituí-los; não transportar o atual `catalog:owner:userId` sem revisar os demais consumidores.

Downgrade não apaga restaurantes/memberships nem escolhe arbitrariamente um restaurante vencedor. Novas criações que ultrapassem o limite são negadas. A política comercial de acesso de assinatura atual permanece distinta de autorização por papel; esta restauração não introduz remoção automática de membros, novo trial ou uma política de bloqueio seletivo de restaurantes existentes.

## 5. Contratos de conta e de restaurante

Novos contratos canônicos usam UUIDs explícitos e DTOs seguros. Nomes abaixo definem as fronteiras; detalhes de DTO e schemas entram no plano pareado API/frontend, sem expor billing privado no bootstrap da conta.

- `GET /account/bootstrap`: memberships/organizações acessíveis, restaurantes acessíveis com status de onboarding, seleção válida, destino e capabilities para a UI. Parâmetro opcional restaurantId é validado; ID inacessível não vira uma seleção implícita de outro tenant.
- `PATCH /account/preference`: persiste a seleção autenticada; o servidor confirma membership e associação. A leitura de bootstrap nunca escreve preferência.
- `GET /organizations/:organizationId/restaurant-entitlement`: pode criar, razão segura, contagem e limite. Não-members não recebem contagens/plano privados.
- `POST /account/onboarding-draft`: inicia a primeira organização/owner e seu draft com Idempotency-Key, sem exigir organizationId ainda inexistente. Serializa por conta; retry devolve o mesmo draft. Se a conta já tiver organização acessível, exige usar a criação nessa organização, sem gerar um novo trial/organização como fallback.
- `POST /organizations/:organizationId/restaurants/drafts`: inicia um draft numa organização existente com Idempotency-Key, role e entitlement verificados. Não adicionar uma tela de criação ilimitada de organizações para contornar limites.
- Operações de restaurante passam a usar `/restaurants/:restaurantId/...`, inclusive os recursos filhos operacionais. Um ID na preferência/localStorage não substitui o ID do request.

As rotas `/restaurants/me` e equivalentes antigas são apenas adaptadores de compatibilidade quando há **exatamente um** restaurante acessível. Ambiguidade retorna 409 `restaurant_selection_required`, sem `limit1` e sem usar preferência global para direcionar uma requisição antiga a outro restaurante. O antigo `/onboarding` pode permanecer como adaptador para o primeiro cadastro compatível, mas não como caminho alternativo de criar fora do entitlement ou publicar draft incompleto.

O bootstrap inclui um resumo seguro de funcionalidades disponíveis à operação, por organização, para que staff possa usar cozinha/caixa sem consultar uma rota `billing.read` proibida. Esse resumo não contém Customer/Subscription/Checkout IDs, contato de cobrança, histórico de faturas ou status de conexão de provedor. Não liberar o endpoint privado de billing para contornar uma dependência da UI.

400 para entrada inválida; 401 para sessão ausente/expirada; 403 genérico para vínculo/capability negados; 409 para conflito/limite/seleção ambígua. Recursos filhos são sempre procurados dentro do escopo autorizado e não revelam dados de outro restaurante por mensagens de erro.

## 6. Frontend, bootstrap e concorrência

Usar TanStack Query como estado de servidor, substituindo o singleton de assinatura. Chaves incluem identidade e escopo: bootstrap por usuário; assinatura por usuário+organização; restaurante/ativação por usuário+restaurante. Nunca persistir senha, sessão ou resultado de autorização em localStorage próprio.

Roteamento: sem sessão→login; conta verificada sem restaurante→onboarding; draft selecionado→retomada; um completo→dashboard; vários→preferência válida ou seletor. O fluxo de recuperação continua independente e não inicia sessão automática após reset. Não reintroduzir OTP Supabase ou alterar os emails atuais para restaurar o roteamento.

Trocar restaurante é uma ação explícita. Salva preferência validada, cancela/invalida consultas tenant-bound, fecha sockets antigos, descarta arquivos/formulários e remove o override antigo restaurantId da URL. Uma resposta iniciada no tenant anterior não pode preencher o formulário atual nem navegar sobre a nova seleção. Durante carga ausente/falha/troca, não mostrar o formulário antigo como editável nem habilitar salvar.

Capturar userId+organizationId+restaurantId e geração da tela em cada operação assíncrona. Requisições já enviadas mantêm o restaurante original e podem concluir nele legitimamente; sua resposta não atualiza o novo tenant. Logout troca a geração, limpa seleções/queries privadas e preserva a revogação de realtime já implementada. Links de cardápio refletem a seleção atual e são invalidados após mudar slug/nome.

## 7. Onboarding e ativação

Recuperar as três etapas: dados básicos (nome, slug, contato), operação (salão, delivery ou ambos e mesas quando houver salão), revisão/finalização. Marca e primeiro prato são tarefas opcionais posteriores, não bloqueios. Salvar antes de avançar; falha mantém o formulário para retry, sem declarar etapa persistida. Reload/outro navegador retoma o mesmo draft e etapa do servidor.

Finalização transacional idempotente: revalidar sessão, membership e dados; criar registros operacionais obrigatórios; iniciar o trial de 3 dias da organização somente na primeira finalização pertinente; completar o restaurante por último. Segundo restaurante de Business não inicia novo trial. Retry de restaurante completo devolve seu resultado, sem duplicar menu, preferência, trial ou efeitos. A publicação pública, quando habilitada futuramente, usa o protocolo de catálogo e só entrega snapshot do restaurante completo; draft não fica disponível por slug.

Ativação é por restaurante+módulo, idempotente no servidor. Criar restaurante não conclui todos os módulos. As páginas e o overview leem o mesmo estado; trocar de conta/restaurante não reaproveita a chave global antiga. Não importar flags locais para marcar automaticamente etapas concluídas.

## 8. Stripe e fila de emails

Organização é a identidade canônica SaaS. Chamadas antigas que já enviam restaurantId podem ser adaptadas resolvendo sua organização e capability; chamadas novas enviam organizationId. Se ambos forem aceitos numa janela de compatibilidade, precisam concordar ou o servidor rejeita. Nunca atribuir acesso de admin ao criador antigo para satisfazer código owner-only.

Um Customer/Subscription e um estado de checkout pendente por organização; troca de restaurante não cria outra assinatura. Preços e plano vêm do catálogo confiável da API. Preservar validação de ambiente, metadados, URLs hospedadas, idempotência, locks, eventos duplicados/fora de ordem e reconciliação no provedor. O usuário que executa uma ação é auditável, mas não vira a identidade permanente de todos os webhooks.

Criar associação imutável de recursos Stripe legados restaurante/dono→organização durante o backfill; IDs externos e metadados legados precisam concordar com ela. Webhooks antigos continuam reconciliáveis sem escolher restaurante pelo usuário logado ou por metadado não associado. Novos recursos usam organizationId. IDs associados a organizações diferentes são conflito, não oportunidade de reparenting automático.

Outbox/eventos recebem escopo de organização; conservar IDs, claims, payloads imutáveis de envio já iniciado e chave por evento/tipo. A unicidade de intenção por recurso/tipo passa a ser organização+recurso+tipo, evitando um email por restaurante. Restaurante antigo pode continuar como referência de origem, nunca como fonte de autoridade SaaS. O consumidor de billing no frontend e o Worker da fila devem usar o novo contrato juntos; não basta atualizar a API.

Emails vão ao contato de cobrança verificado da organização, derivado inicialmente do owner existente, não ao admin/staff que abriu uma tela. Troca do contato não faz parte desta restauração. Não enviar mensagens reais para validar o port: testes locais usam portas/fakes e dados sintéticos; qualquer validação remota permanece no gate próprio.

Conexões Mercado Pago, transações e pagamentos de pedidos continuam por restaurante. Alterar a assinatura da organização não pode mover uma conta de recebimento ou permitir que outro restaurante confirme o pagamento de seu pedido.

## 9. Catálogo, imagens e realtime

Manter snapshots privados R2, versões, sinais event-driven, publicação canônica de slug e revisão de carrinho. Não reintroduzir polling de cardápio nem query SQL por visitante público. Publicação recebe restaurante explícito e revalida membership no applier antes de nova mutação; operação persistida não carrega um papel autoafirmado como prova permanente.

Journal conserva identidade da operação, ator, restaurante e fingerprint. Retries de outro restaurante/ator/payload são conflito. Membership/sessão revogadas impedem novo apply e leitura HTTP de resultado privado. A recuperação interna de um commit já aceito pode finalizar a **projeção pública** sem conceder acesso privado nem repetir a mutação. Não apagar journal, namespace, leases ou objetos para simular rollback; projeção pendente continua recuperável.

Realtime privado usa `restaurant.read` na admissão e na revalidação em lote existente, com sessão válida e vínculo atual, não owner_id. O nome de transporte `owner` pode ser mantido por compatibilidade, sem significar permissão exclusiva de proprietário. Preservar limites de conexões/frames/lease e falha fechada. Não prometer revogação instantânea entre verificações nem adicionar uma consulta por ping/mensagem; testes devem cobrir remoção de membership na próxima revalidação. Salas/tokens públicos de pedidos e catálogo permanecem isolados de memberships e não expõem dados de equipe/billing.

Logo: prévia `blob:` é apenas memória de UI, nunca URL persistida. Reusar o otimizador de imagem atual: JPEG/PNG/WebP de entrada até 5 MiB, redimensionamento até 1200px, WebP preferido com fallback atual que preserva transparência, saída até 1 MiB. Não contratar processamento de imagens ou transformar a cada visualização.

Generalizar a lease de asset para produto ou marca. Preservar as chaves de produto atuais `restaurantId/itemId/objectId`; novos logos usam `restaurantId/branding/objectId`. O discriminador branding é reservado, não interpretado como menu item. Budget, prepare/verify/attach/retire e validação de referências reconhecem ambos; quota total segue **100 MiB por restaurante**, não mais 100 MiB para logos. Repetir uma lease não reserva de novo; concorrência de membros usa o mesmo orçamento do restaurante.

A troca de logo só aposenta o anterior após associação/publicação segura. Limpeza manual limitada continua protegendo referências de snapshots retidos e comandos pendentes; TTL sozinho não reembolsa quota. Atualização do formato de armazenamento SQLite de leases deve preservar registros antigos e ser ensaiada sem apagar o namespace. URLs antigas legítimas continuam legíveis; não baixar imagens externas ou apagar assets legados automaticamente.

Slug: validação pontual ao sair do campo e novamente no save, mensagem de duplicidade inline, unicidade final no banco. Cancelar/ignorar verificação de valor ou tenant antigos. Não adicionar polling nem publicar alias incorreto após uma renomeação.

## 10. Compatibilidade, promoção e custo

Nesta fase: arquivos, testes e commits locais nos dois repositórios. Não aplicar SQL remoto, ligar flags, bootstrap, publicar ou fazer merge/push. O desvio de catálogo permanece com os gates5/9/10 abertos e reader/writerfalse; a aprovação deste desenho não encerra nenhum deles. O bloqueio de capacidade Neon documentado em18/10 não impede testes locais e não será contornado criando projeto/plano pago.

O plano de implementação precisa incluir testes PostgreSQL locais reais de migration/grants, Worker/workerd e frontend, sem depender de Neon ativo. Configuração de CPU, limites de chamadas, dados públicos, rate limits e logs seguros atuais permanecem. Não prometer teto financeiro absoluto nem gastar SQL para um contador visual de cada render; bootstrap/queries compartilhadas e invalidações explícitas substituem caches globais sem polling novo.

Promoção futura exige janela controlada e artefatos pareados: bloquear temporariamente novas mutações de billing/catálogo incompatíveis, resolver/drain claims e operações aceitas, impedir consumidores antigos de escreverem a fonte legada, aplicar o schema ensaiado e publicar API/consumidor compatíveis antes do frontend. Webhooks não aceitos devem permanecer retentáveis, nunca respondidos como processados para ocultar a janela. Readback por ambiente e smoke negativos precedem liberar multi-restaurante e qualquer flag de catálogo.

Não propor rollback para runtime owner-only depois que houver organizações/equipe ou vários restaurantes. O artefato de rollback precisa entender o schema canônico; para incidente, suspender novas mutações e reverter UI/reader de forma compatível, preservando operações aceitas. Backup/restauração são gate separado. Não oferecer zero downtime como propriedade ainda não demonstrada.

## 11. Verificação e definição de pronto

Cada comportamento começa com teste que falha pela lacuna real, seguido de implementação e suíte verde. Não contar testes legados em Supabase como execução em Neon/Workers.

| Família | Evidência exigida |
| --- | --- |
| Schema/backfill | Vazio e baseline atual com dados; sem identidade órfã, duplicidade ou billing conflitante; grants mínimos; falha reverte integralmente; arquivos001–009 intactos |
| Limite/capabilities | Starter/Pro/trial segundo restaurante negado; Business até25; duas criações concorrentes na última vaga; owner/admin/manager/staff por capability; invited/disabled/desconhecido/não-member negados |
| Escopo | Mesmo dono com A/B e usuário em duas organizações; leitura/update/delete de A não afeta B; recurso filho de B no path A negado; não há mutação só por owner_id |
| Bootstrap/troca | Vazio/draft/um/vários, preferência/URL inválidas, URL antiga não desfaz troca; respostas lentas/falhas e save pendente; logout A→login B sem dados antigos |
| Onboarding/ativação | Reload/outro cliente retoma draft; erro no finalize reverte; retry não duplica trial/dados; prato opcional; módulos separados por restaurante, sem marcar todos ao criar |
| Billing | Uma assinatura nos25 restaurantes; admin age sem virar dono; manager pode ler e não alterar, staff não acessa billing privado; webhook novo/legado/fora de ordem/replay; evento/recurso cruzados; uma intenção de email e request imutável; consumidor pareado |
| Catálogo/realtime | Dois admins no mesmo restaurante; mudança de role/sessão entre admission e apply; commit seguido de revogação/projeção; retry sem vazamento privado; revalidação de sockets em lote; público não recebe billing/roles |
| Marca/imagens | Logo persiste após reload, nunca blob; produto+logo concorrem na mesma quota; retry de lease; referências retidas protegidas; upgrade SQLite preserva leases; falha de upload não substitui logo válido |
| Slug/UX | Duplicado inline, correção bem-sucedida, save concorrente, resposta antiga ignorada, link público atualizado sem polling |
| Produto integrado | Catálogo público, pedidos local/delivery, cozinha/caixa, pagamentos/retorno/OAuth, auth/reset, billing Test, tipos, lint e builds; revisão final e reconciliação de todas as refs/WIPs úteis |

Pronto local exige as entregas A–E com matriz P01–P10 ligada a testes e commits nos dois repositórios. Publicado exige ainda gates remotos e integração explicitamente autorizados. Testes verdes isolados, branches ancestrais ou um commit na main não demonstram por si sós paridade de produto.

## 12. Revisão deste artefato

- [x] Intenção, limites históricos e infraestrutura a conservar registrados.
- [x] Lacunas P01–P10 rastreadas por entrega e critério de aceite.
- [x] Distinção entre autorização, assinatura SaaS, pagamento de pedidos e publicação preservada.
- [x] Auto-revisão de escopo, ambiguidade e contradições realizada antes do commit.
- [x] Usuário aprovou continuar após receber esta especificação escrita em19/10.
- [ ] Plano detalhado escrito/revisado e método de execução selecionado.

Próximo gate: revisão do plano de implementação escrito. Nenhum checkbox acima declara funcionalidade corrigida.
