# Controlador do gate de imagens — 29/10/2026

Estado atualizado em30/10/2026 UTC: **v3 foi explicitamente autorizada e executada: baseline e teste de imagem passaram, mas o gate global falhou no encerramento. A limpeza das fixtures não foi confirmada, e a revogação S3 não foi comprovada apesar da remoção da chave no painel.** V1/v2 permanecem encerradas conforme histórico abaixo. Não repetir marcadores consumidos, uploads ou seed; reconciliar o estado preservado antes de qualquer nova escrita.

## Resultado efetivo da v3

O recibo `production-catalog-image-v3-2026-10-30T03-18-04.080Z.json`, SHA256 `b1f34b69b3bd3e8fa801936a33b60624227632b01832a2bdfff528a0bd6aa8d1`, registra `ok:false`. O usuário autorizou especificamente v3 após a rejeição anterior; a execução única48027 passou pelos preflights de controles/fontes, Neon/TLS e capacidade de leitura R2. A chave foi criada uma vez com escopo Object Read & Write somente no catálogo de produção e TTL24h; seus dois campos S3 foram entregues pelo usuário ao localhost, mantidos em memória.

No Brave, o widget apresentou300030 antes da resposta humana. Após recarregar a mesma página, a resposta chegou e houve um único seed/login/gate. O usuário relatou múltiplos reloads/cliques porque o botão continuava habilitado após recarregar um teste já iniciado. A ponte aceita `/start` somente em estado waiting e rejeita novos inícios com409; os journals exclusivos registram uma única sequência. Isso não reiniciou o controlador nem criou novos IDs. Há um defeito de feedback do operador: a página deve carregar com o botão desabilitado e habilitá-lo apenas quando o status confirmar waiting. Registrar/regredir essa correção localmente antes de nova validação, sem alterar os controladores consumidos.

Evidência funcional real:

- Baseline:4 requisições, um rebuild ready, versão6, operação `87b8f3aa-9fe3-4be4-9e95-beaa4083498a`, três objetos conferidos no readback anterior à imagem.
- Imagem:10 requisições,22 verificações, WebP fixo42B, upload confirmado, lease aposentada e duas tentativas de escrita obsoleta bloqueadas. `imageProbe.ok:true`, `uncertain:false`.
- Logout/sessão: revogação confirmada;4 requisições de autenticação no gate.
- Encerramento: parada em retirement; sem confirmação de aposentadoria do catálogo ou limpeza de identidades. `cleaned:false`, `uncertain:true`. Não inferir ausência física da imagem apenas do DELETE/lease; a prova requerida pelo retirement não foi confirmada.

Escopo preservado para reconciliação: restaurante `22e1fbca-d9ab-4292-ae2b-6613d195d593`, tag `catalog-writer-9fa13e7a-5e46-4cd9-a087-e46ab7a39760`, imagem `22e1fbca-d9ab-4292-ae2b-6613d195d593/branding/25a460ee-0e6c-43eb-beaf-12c491141d3d`, lease `be5196e4-1f86-4445-a56a-67890ded7b25`. IDs de usuário/organização permanecem no journal próprio de seed; não ampliar o alvo a outros dados. A falha genérica não informa até qual ponto a aposentadoria chegou; não pressupor rollback completo ou ausência de fences R2.

A chave temporária foi excluída uma vez no painel. Após atualizar e aguardar a listagem carregar, foram confirmadas zero linhas do token temporário e uma linha de cada chave permanente de imagens. Captura suplementar `catalog-image-v3-token-ui-revoked-2026-10-30.png`, SHA256 `d4c76cda5441dfc99c00552de569dd7627fe243b9d484ce096f27fba7cc229f9`. O controlador recebeu `confirm-revoked`, aguardou65s e efetuou a única verificação S3 prevista, que não confirmou revogação. Não foi registrado o status SDK original; não afirmar403, chave ainda autorizada ou causa de transporte. `credentialUiRevoked:true` e `credentialRevoked:false` são resultados distintos, mantidos no recibo imutável.

Processo exit1, listeners/pool encerrados e chaves descartadas; a tela que exibia o segredo foi fechada. Sem nova tentativa, recuperação de clipboard, reuso de chave ou nova credencial. Os contadores zero de control plane/schema/email/pagamentos do controlador não incluem a criação/revogação UI da chave nem as escritas de domínio sintéticas descritas acima. Deploy, flags, DNS, main e planos pagos não mudaram.

Próximo trabalho: reconciliação **somente-leitura** dos IDs e objetos exatos para localizar o estado/falha de limpeza; depois decidir a recuperação delimitada. Não reexecutar o gate bem-sucedido de upload, não criar v4 e não remover fixtures às cegas. O plano continua7/10, com tarefas5/9/10 e Etapa13 abertas.

## Resultado da janela real e diagnóstico

Esclarecimento posterior do usuário: o primeiro desafio não estava vazio; ele não o concluiu porque esqueceu. Isso explica o abandono informado pelo usuário, sem alterar o fato técnico de que o controlador não recebeu o início naquela janela. O erro300030 reproduzido depois pertence ao diagnóstico separado, não deve ser apresentado como causa desse abandono.

O marcador exclusivo foi consumido em29/10 às17:41:42.006Z. Os preflights somente-leitura passaram e as chaves S3 foram recebidas em memória. O controlador aguardou o botão de início na página local; o registro terminou com `failedStage: awaiting_human_start`, sem entrar no gate. Há apenas os journals de início, emissão e tentativa de revogação, sem journal de seed/login/probe. Não é possível atribuir retrospectivamente a ausência desse POST ao Turnstile.

O recibo original `production-catalog-image-v1-2026-10-29T17-41-42.006Z.json` permanece imutável, SHA256 `5ab3d2db1c4e1478a743d64972b9d8511cd3f30f9fe98263487ee49da7e51561`: `ok:false`, `credentialReceived:true`, `credentialUiRevoked:false`, `credentialRevoked:false`. O processo já havia encerrado ao retomar a sessão; esses campos não foram reescritos para incorporar ações posteriores.

Na retomada, a chave `vapt-catalog-production-image-test-2026-10-29` foi excluída uma vez no painel da Cloudflare. Uma atualização da listagem confirmou zero linhas desse token e preservou as duas chaves de imagens preexistentes, de produção e preview. Evidência suplementar: `catalog-image-v1-token-ui-revoked-2026-10-30.png`, SHA256 `2a5a53a678bd57ac61cfe8be328c1090b0237c18bda9681aa56f03f1c85a8c73`, no workspace do plano. **Revogação UI confirmada; invalidação por GET S3 não comprovada**, pois a chave em memória já havia sido descartada. Não recuperar segredos ou criar outra credencial apenas para completar essa prova. A criação e a revogação UI são efeitos externos reais, separados dos contadores zero de writes do controlador.

Um diagnóstico localhost separado, sem credenciais, banco, login, seed ou upload, exercitou o mesmo bridge no Brave. A primeira janela descartável expirou antes da inspeção e foi encerrada. A segunda recebeu o clique em “Iniciar testes” (`start_received`), mas a área do desafio permaneceu vazia. O console registrou `Turnstile Widget seem to have hung` e `300030` em30/10 às02:39:18Z. Isso reproduz uma falha do desafio **no diagnóstico**, não prova a causa da janela v1. A [documentação oficial](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/) classifica a família300 como falha genérica de desafio; o código não identifica sozinho uma extensão ou configuração específica.

Captura sem segredos: `catalog-image-keyless-challenge-2026-10-30.png`, SHA256 `63de50111a25ac5609514f6291cf876b189bbb9e6321b38585433eca0f93fc5e`. Os dois processos descartáveis terminaram com exit0 e suas páginas não são URLs reutilizáveis. Nenhum CAPTCHA foi resolvido pela automação e nenhuma proteção foi alterada. Nenhuma nova credencial foi criada na retomada, e código/configuração de produção permaneceram inalterados.

Antes de outra credencial, validar manualmente a apresentação do desafio em Edge ou Chrome normal, com uma nova janela **sem chave** e usuário disponível. Somente após essa checagem, preparar outra tentativa com identidade/journal próprios e obter autorização específica para a credencial. Não ampliar o relógio da credencial para contornar a falha do navegador.

### Checagem humana posterior, sem credenciais

A pedido do usuário, foi aberta uma nova ponte localhost apenas para ele concluir o desafio. O processo82972 terminou com exit0 e registrou, em ordem, `start_received`, `challenge_response_received_and_discarded` e `keyless_human_check_closed` com `responseReceived:true`. O usuário informou “validação encerrada”. A resposta foi descartada em memória, sem Siteverify ou tentativa de autenticação (`authenticationAttempted:false`), zero credenciais R2, SQL e uploads. O servidor foi encerrado e o endereço54396 não deve ser reutilizado.

Isso confirma o recebimento da resposta humana nessa interação; não certifica token válido perante a API, login ou o gate de imagens. Não há necessidade de repetir essa checagem sem motivo novo. O próximo trabalho é preparar a nova janela de imagens com identidade/journal próprios e autorização específica da credencial, sem repetir o marcador v1 consumido.

## Percurso fixo — preparação histórica antes da janela v1

O controlador operacional `production-catalog-image-v1-controller.mjs` está no workspace próprio do plano, separado dos markers consumidos do CRUD anterior. Aceita apenas `check` e `run`, sem publicação, recuperação/replay ou alvos arbitrários. O modo `check` confere localmente os SHA256 de11 arquivos de operador, mas não declara readiness remota.

Antes da coleta de qualquer chave: journal exclusivo próprio; fontes da API/frontend e11 arquivos congelados; deployments esperados de API/web/billing; verificação independente somente-leitura da configuração/código; preflight existente de banco/capacidade; conexão Neon direta/TLS verificado; e confirmação de que o OAuth existente consegue consultar uma chave inexistente no bucket de imagens. Sem essas provas, para antes de criar identidades ou reservar upload.

A futura chave será somente Object Read & Write em `vapt-catalog-production`, por24h no provedor, revogada ao encerrar. Ainda requer aprovação específica. Só os dois campos S3 serão recebidos uma vez por formulário localhost write-only, mantidos em memória. O formulário usa o perfil fixo `vapt-catalog-production-image-test-2026-10-29`, preservando o perfil legado separado. **O listener só abre após `mark-issued`, journal de emissão persistido e responsabilidade de revogação registrada**; antes disso não existe formulário para receber antecipadamente uma chave. O coletor registra `receivedAt` no instante da entrega e o controlador usa esse instante para os30min locais/20min de trabalho/10min de reserva. Isso não muda a expiração do provedor nem garante revogação se houver falha externa.

Depois de início humano e Turnstile: seed único da fixture single-owner existente; login; rebuild único; conferência concreta de ownership/sessão/revisão/journal SQL e três objetos exatos no R2; teste de lease de logo sem associação pública; logout401; readback autenticado da ausência física da imagem; fences CAS do catálogo, aposentadoria SQL/readback zero e limpeza estrita das identidades.

O preflight novo abre transação `READ ONLY` e apenas lê, exigindo exatamente uma sessão vigente, catálogo vazio, owner/membership exatos, um journal/revisão e snapshot pronto correspondente, com versão decimal sem arredondamento. Manifesto inicial precisa ter `previousVersion:null`; snapshot sem logo/itens. Se rollback falhar, a conexão é descartada e o diagnóstico privado do banco não é exposto. A configuração fixa do pool já limita conexão a10s, statement a8s e lock a2s; R2 tem prazo15s/corpo64KiB e o preflight tem prazo90s.

Journal registra as tentativas antes dos efeitos, incluindo fases novas de imagem. Resposta perdida ou divergência preserva estado para reconciliação, sem retry ou cleanup cego. O controlador não acessa API de Resend/Stripe nem altera schema/planos/serviços pagos. Os contadores de ações do controlador não são uma promessa sobre atividade concorrente de toda a conta.

## Revogação e propagação

O encerramento exige confirmar a exclusão UI do token exato e depois esperar65s antes de **um único GET S3**, exigindo403. O intervalo dá margem à propagação; não garante que todo erro seja revogação.404, autorização ainda válida ou falha técnica mantêm o resultado não confirmado. Não há polling/retry nem recuperação da chave antiga.

O budget independente dessa limpeza passou de90s para300s para comportar confirmação humana, espera e request. Um teste com relógio controlado reproduziu a falha aos125s com o prazo antigo e passou com o novo. A reserva de10min local comporta esse fluxo; o limite local continua diferente do TTL do provedor.

## Evidência obtida nesta continuação

- Conferência real somente-leitura: um GET Cloudflare REST de chave aleatória `UUID/branding/UUID` em `vapt-assets-production`, usando o OAuth Wrangler existente somente em memória. HTTP404/JSON, aceito pelo helper estrito com único erro10007, processo exit0, uma requisição, zero writes e zero credenciais criadas. Não consultou imagem existente nem registrou payload/segredo. Isso confirma permissão e envelope de ausência atuais, **não** a remoção após upload real.
- Controlador:12/12 testes locais de modos/argumentos, onze hashes congelados, confirmação UI, espera, uma verificação S3, journal antes do listener e cancelamentos. Um caso usa o formulário localhost real pelo mesmo helper do controlador e confirma o token/timestamp corretos, sem executar `run` real.
- Operadores:562/562; API704/704; PostgreSQL descartável38/38, sem falhas/skips nas execuções finais. Oito casos novos de PostgreSQL cobrem o baseline/readbacks/recusas e rollback perdido, sem Neon remoto.
- TDD registrado: exports ausentes e prazo insuficiente RED→GREEN; identidade do teste alinhada ao boundary de pool já usado pelo fixture; erro de rollback privado reproduzido antes da proteção de descarte. Nenhuma constraint de schema ou guard de runtime foi afrouxado.

Logs/recibo do GET/controlador/journal permanecem no workspace próprio `.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/`, sem credenciais. Nada justifica refazer o CRUD real concluído em27/10 ou reclassificar sua revogação S3 não comprovada como sucesso.

## Revisão e limites

Revisão única `/root/catalog_image_controller_review`, Astra medium, read-only/contexto isolado: nenhum crítico, dois importantes e nenhum menor. Achados: HTML ainda orientava o token antigo; entrada podia aceitar chave antes de registrar emissão e iniciar seu relógio. Ambos tiveram regressões RED→GREEN na passagem única: perfil de formulário próprio e helper que aguarda/journala emissão antes de criar o listener. Cancelamento antes do registro não abre entrada, confirmação tardia não a reabre e cancelamento durante criação drena/fecha o listener mantendo responsabilidade de revogação. Sem segunda revisão.

Comportamentos externos explicitamente mantidos nos gates apropriados:

- Escopo/TTL/criação/revogação UI exigem interação futura especificamente aprovada, não são comprovados por mocks.
- Propagação IAM e403 S3 reais ainda precisam da janela nova; a espera65s não transforma falhas em sucesso.
- O GET de chave inexistente confirma permissão/envelope, não remoção após upload; a chave real será conferida após a aposentadoria.
- TLS/identidade Neon e deployments precisam ser conferidos pelo controlador no momento de `run`; a simulação local não os certifica antecipadamente.
- Trânsito HTTP/Content-Length, codec/browser e quota100MiB reais não são provados pelo arquivo42B.
- Onboarding após resposta perdida permanece separado, pois esta fixture começa completa.
- Revogação de sessão enquanto comando aguarda e publicação pós-commit são runtime inalterado, não revalidados por esta revisão.
- Imagem associada/referenciada por revisões retidas permanece gate separado; aqui o baseline é vazio e sem referências.
- Canal/slug/carrinho não mudaram; nenhum novo resultado frontend foi alegado.
- Reader/deploy/main e conclusão da migração não são autorizados pelo parecer local.

Se uma premissa externa falhar, a decisão é interromper e reconciliar, não apagar estado incerto ou ampliar permissões/recursos. O custo é manter o gate pendente. A condição antiga de revogação S3 não comprovada permanece preservada.

Artefato operacional local, não runtime: SHA256 do controlador `50a54b12adc93106385b3b1b0d726d3622cc35c9f9047ba2213fba52e604aa51`; testes `ccbb7d2cedec01877c0c23015198cc35b12f682fb6edbdc8ffa07f95592b7912`. Arquivos e registros ficam no workspace do plano; não removê-lo enquanto os gates estiverem abertos.

## Próximo gate — atualizado após a janela v1

### Histórico: v2 encerrada antes da emissão; preparação da v3

Após autorização específica do usuário, v2 iniciou uma vez em30/10 às03:08:49.872Z. O preflight independente falhou na fase `private_catalog`, depois de conferir os deployments esperados. O diagnóstico original é genérico: não permite distinguir erro HTTP, transporte ou resposta divergente. O recibo v2 registra `credentialReceived:false`, zero writes/schema/emails/pagamentos e não possui resultado de gate. Existe somente o marcador de início, **sem journal de emissão ou seed**. O processo79456 encerrou com exit1; v2 não será repetida.

Duas consultas diagnósticas limitadas aos endpoints de domínios R2 retornaram depois HTTP200/success: managed `enabled:false` e custom `domainCount:0`. Portanto a configuração observada continua privada; a causa exata da falha anterior não foi capturada e não é atribuída a mudança de configuração. Essas consultas não retomaram o gate nem alteraram o bucket.

Foi preparado o sucessor fixo `production-catalog-image-v3`, mantendo v1/v2 intactos. Além das provas anteriores, ele exige os hashes exatos do controlador/recibo v2 e somente seu marcador inicial; qualquer journal de emissão na v2 impede a nova execução. Quatro testes novos RED→GREEN, suíte local combinada23/23, exit0, sem skips/falhas. O modo `check` é local; não certifica readiness remota. Recibo v2 SHA256: `ed047fcad9538157f4301aa0906fdacd15ced59e0b27059a6ab34cd0341fb00a`.

A tentativa de iniciar v3 foi **rejeitada antes de criar processo** pela revisão automática, que considerou a autorização anterior específica da janela v2. Não houve contorno ou execução indireta. Falta autorização explícita da janela v3, que poderá emitir a única nova chave restrita e executar escritas sintéticas em produção conforme o protocolo já descrito. O marcador v3 não foi criado; nenhum coletor/controlador ou chave temporária está ativo. O formulário Cloudflare continua preparado, sem clicar Create. Não mudar planos, deploy, schema ou flags para contornar esse bloqueio.

O restante desta seção registra a preparação anterior da v2; seu estado “não executada” foi substituído pelo resultado acima.

A checagem humana sem credenciais já recebeu a resposta e encerrou normalmente, conforme registro acima; não precisa ser repetida. Foi preparada a tentativa fixa `production-catalog-image-v2`, ainda **não executada**, separada da v1 consumida. O controlador anterior, recibo e journals continuam intactos. O sucessor mantém o procedimento e os onze hashes de operadores; acrescenta somente a identidade da nova tentativa e a verificação local da reconciliação anterior antes de criar o novo marcador ou acessar provedores. Exige hashes exatos do controlador v1, recibo e screenshot suplementar de revogação, além de exatamente os três journals anteriores, recusando seed ou qualquer fase adicional. Isso não converte revogação UI em prova S3.

Sete testes novos falharam primeiro pela ausência do sucessor e passaram após sua implementação. A execução combinada dos controladores foi19/19, exit0, zero falhas/skips. O bloqueio inicial `spawn EPERM` do sandbox não foi contado como RED de comportamento; os testes foram reexecutados com a permissão necessária para subprocessos locais. O modo `check` real passou com zero chamadas remotas/listeners; o marcador v2 não existe. Os testes históricos de operadores/API/PostgreSQL não foram repetidos nesta preparação, que não altera código runtime. O delta do controlador foi conferido contra a v1 preservada, sem nova funcionalidade de recuperação ou alvos configuráveis.

SHA256 v2: `b39c81e0f259ba53968d7c465c32a937252d0b4b22f1dd385c5ddd18f90718f3`; testes: `9159f254f5752e9cb5c6b7a7f6fa6a6df081ab2b240d717b6c92578f1d6eaa2b`. Artefatos ficam no workspace próprio do plano.

Na Cloudflare, a listagem atual mostrou apenas as duas chaves permanentes de imagens. Foi preparado, sem enviar, o formulário de uma nova instância do perfil `vapt-catalog-production-image-test-2026-10-29`, Object Read & Write somente em `vapt-catalog-production`, TTL24h, sem administração ou outros buckets. O nome/data do perfil é mantido para usar o coletor existente sem mudanças; não representa a data de emissão da futura instância. Captura: `catalog-image-v2-token-form-2026-10-30.png`. **Create não foi clicado; nenhuma chave nova existe nesta preparação.**

Falta autorização específica da nova credencial e disponibilidade humana para os campos S3 e Turnstile. Após autorização: iniciar v2 uma vez, executar seus preflights somente-leitura, registrar emissão antes de abrir o formulário local e só então criar a chave. Revogar ao encerrar e realizar a verificação S3 única prevista. O marcador v1 está consumido e não pode ser repetido; sua falha e a revogação UI posterior não serão reclassificadas como aprovação do gate. Esta preparação não amplia prazos de credenciais, permissões ou serviços pagos.

Depois desse ciclo sem associação ainda faltam as provas de imagem publicada/referências retidas/quota, onboarding canônico e recuperação, reader/bootstrap/eventos públicos e integração das branches/PRs. O plano permanece formalmente7/10, tarefas5/9/10 e Etapa13 abertas. Nenhum teto global de fatura foi criado.

## Resultado v3 e recuperação restrita — 30/10

A v3 foi especificamente autorizada e executou uma única vez em `2026-10-30T03:18:04.080Z`. A preparação anterior acima é histórica, não uma instrução para repeti-la. Houve rebuild vazio pronto versão6, upload WebP de42B e aposentadoria do lease, com22 verificações do fluxo de imagem; duas escritas obsoletas foram bloqueadas. Logout confirmado. O gate falhou depois, na aposentadoria do catálogo: **não houve confirmação de retirement ou cleanup**. A causa original não foi capturada com detalhe suficiente para atribuí-la a transporte ou permissão.

A chave temporária foi excluída na UI e a listagem voltou às duas chaves permanentes de imagens. A verificação S3 assinada não confirmou403; esse resultado continua **não comprovado**, sem recuperar a chave antiga nem reclassificar o recibo como sucesso. O processo encerrou, descartou credenciais e fechou os serviços locais. Recibo imutável: `production-catalog-image-v3-2026-10-30T03-18-04.080Z.json`, SHA256 `b1f34b69b3bd3e8fa801936a33b60624227632b01832a2bdfff528a0bd6aa8d1`.

### Reconciliação somente-leitura

Em `2026-10-30T03:43:20.805Z`, quatro GETs exatos observaram slug e manifest não aposentados, snapshot versão6 íntegro e **imagem física ausente** (404 JSON/erro10007). SQL em transação READ ONLY, TLS verificado e rollback confirmou os quatro marcadores de identidade, zero sessões/itens/pedidos/mesas/onboarding/efeitos financeiros e exatamente um journal/revisão esperados. A fixture de teste permanece: restaurante `22e1fbca-d9ab-4292-ae2b-6613d195d593`; usuário `50717d26-f7b5-4954-a834-77ff88dfa013`; organização `6f8cdd4e-8e4e-4193-93f1-740ba6e02589`.

Foi identificado um defeito independente no helper REST: codificar separadores como `%2F` podia consultar outra chave e aceitar uma ausência incorreta. Agora preserva `/` nos segmentos UUID/branding/UUID previamente validados, conforme [GetObject da Cloudflare](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/get/). Regressão reproduziu o falso positivo e passou após a correção;14/14 testes focados. Isso **não prova a causa da falha v3**. Uma chamada posterior com o helper corrigido expirou; timeout não é evidência de ausência.

### Recuperação preparada, ainda não executada

O novo controlador `production-catalog-image-cleanup-v1-controller.mjs` é exclusivo da fixture acima e da versão6. Não oferece seed, login, desafio, upload, deploy ou modo arbitrário/retry. Importa a evidência v3 congelada, exige os hashes do código operacional/SQL de preflight e confere deployments, TLS/quotas/grants, sessões/journal e ausência física antes da janela de credenciais. A fábrica de restauração preserva os IDs registrados e recusa qualquer novo seed; o cleanup continua condicionado à aposentadoria CAS dos objetos e aos guards de propriedade/efeitos sob lock.

O controlador distingue a prova histórica de logout da checagem atual: cookie antigo não é retido/reutilizado; exige zero sessões SQL e401 anônimo, além da validação sob lock na aposentadoria. Apenas status/método/tipo de objeto ou código de transporte permitido são registrados da chamada S3, nunca headers assinados ou corpo privado. O objetivo é reconciliar e remover **somente esta fixture**, não repetir o teste de imagem.

Não foi criada credencial nem executada escrita remota nesta recuperação. A execução exige nova autorização específica para uma credencial temporária Object Read & Write apenas em `vapt-catalog-production` (TTL24h; uso local30min, trabalho20min; revogação ao encerrar) e a limpeza dos IDs existentes. Não há necessidade de instalar navegador, fazer login de teste ou Turnstile. Aprovação local e testes não substituem a prova real de CAS, revogação e ausência de resíduos.

### Revisão única e checkpoint local da recuperação

O revisor read-only `/root/image_cleanup_recovery_review` não encontrou críticos; apontou três importantes e um menor. Todos foram tratados numa única passagem, sem segunda revisão:

- Responsabilidade de revogação passa a existir antes de expor a emissão. Falha no journal, confirmação de emissão ou listener não pode dispensar a UI; falha ao preparar o cliente S3 também não a antecede. Sem chaves recebidas, não há alegação de prova S3. Regressões RED→GREEN.
- `account_preferences` e `restaurant_activation_progress` agora precisam estar vazias para os IDs envolvidos, sob os locks existentes, tanto antes de aposentadoria quanto antes de cleanup. Quatro testes reais reproduziram a aceitação indevida e passaram após a correção, preservando os dados inesperados e o restaurante. A primeira montagem de activation_progress falhou por omitir campos obrigatórios; foi corrigida antes do RED comportamental e não foi contabilizada como tal.
- O predecessor congelado não é mais importado estaticamente: a checagem de hashes acontece antes da importação dinâmica. Os quatro arquivos de transport/preflight/SQL importados também estão fixados, com regressões que recusam alterações.
- Falha na persistência do recibo ainda emite o estado final redigido com `receiptPersistenceFailed:true`, `ok:false` e exit1; não expõe o erro privado. Fechamento falho não impede descarte de chaves e fechamento dos demais recursos, nem produz sucesso.

Verificações finais locais, todas exit0/zero falhas/zero skips: operadores569/569; API704/704; PostgreSQL descartável44/44; controlador17/17. O cluster descartável encerrou ao final. Bloqueios iniciais `spawn EPERM` do runner foram resolvidos com permissão para subprocessos locais; não eram falhas de comportamento. Código de aplicação `src`, deploys e recursos remotos não foram alterados neste checkpoint.

Rulings sobre o que a revisão não julgou: estado vivo/ausência/deployments/sessões será reconferido no gate, não inferido de mocks; causa original permanece desconhecida; revogação assinada da chave antiga permanece não comprovada; escopo/TTL/revogação e o fluxo completo de limpeza exigem a execução especificamente aprovada, não são garantidos pelos17 testes de helpers/falhas. Os números das suítes foram verificados pelo executor, não atribuídos ao revisor. Schema/bootstrap/login/Turnstile/uploads/billing/DNS/main/merge e a migração inteira ficam fora deste gate; nenhum foi considerado concluído ou autorizado por seu parecer.

Artefatos locais fixos: controlador cleanup-v1 SHA256 `7fee9bfa676627551054c3a4ed9d2e878d2bb076274d32b55ac3c047754db416`; testes `22b1c68177438492ccc1d2a4d25415938ba3ead92664e13b296a4e52dad9ea48`. O marcador cleanup-v1 ainda não existe; não existe controlador ou coletor aberto. Manter os artefatos e recibos anteriores intactos.

## Execução cleanup-v1 — fixture removida, revogação UI reconciliada

O usuário respondeu “continuar” à autorização específica desta janela. O controlador congelado iniciou uma vez em `2026-10-30T04:30:37.083Z`; marcador consumido, sem replay. Preflights reais passaram com deployments esperados, TLS1.3 nas duas conexões Neon, quota216000/min=max0.25, grants e fixture exatos; sessões0 e ausência da imagem física confirmadas. O journal de emissão foi persistido às04:32:07.503Z antes do clique Create. A UI mostrou Object Read & Write somente em `vapt-catalog-production`, TTL24h. Nenhum valor foi lido no chat/log/screenshot: o usuário entregou os dois campos S3 ao coletor local.

A revisão automática inicialmente recusou `mark-issued` por interpretá-lo como confirmação de chaves já recebidas. A sequência foi comprovada por inspeção somente-leitura das linhas44–49/133–139 e do helper, mais17/17 testes locais: o comando registra tentativa e abre o listener; `await input` antecede qualquer S3/retirement. A mesma ação foi permitida após essa evidência, sem trocar código, alvo ou contornar guard.

Resultado real:

- Às04:34:45.270Z, aposentadoria confirmada: exatamente dois PUTs CAS (slug tombstone e snapshot aposentado), ambos200; oito GETs200 de validação/readback no conjunto fixo de três chaves. Manifesto preservado. Journal/revisão removidos somente após os fences conferidos.
- Às04:34:46.197Z, cleanup confirmado com readback independente zero: removidos somente restaurante, organização e usuário da fixture, com seus dependentes esperados. Os guards recusam dados inesperados; nenhuma tabela foi truncada, schema alterado ou recurso removido. Não foram criados novos usuários, uploads, login, Turnstile, emails ou pagamentos.
- A confirmação de revogação tinha prazo180s a partir de04:34:46.198Z; o processo encerrou às04:37:46Z, exit1, descartando chaves e fechando pool/listener. A confirmação enviada depois não foi recebida dentro dessa janela. **Não houve GET assinado de revogação registrado**: não existe status403 a alegar.
- Posteriormente a chave foi efetivamente excluída na Cloudflare. A primeira listagem permaneceu antiga; uma recarga somente-leitura confirmou ausência do token temporário e presença das duas chaves permanentes de imagens, sem segundo clique Delete. Evidência suplementar registrada em30/10 às16:03:55Z, separada do recibo imutável. A página de valores foi substituída pela listagem segura e a aba do coletor fechada.

O recibo `production-catalog-image-cleanup-v1-2026-10-30T04-30-37.083Z.json`, SHA256 `e000e4041c103a06ca6299a0dfc57aa01e40bdd22b6a9e092e0bbbf208828a75`, permanece `ok:false`, `retired:true`, `cleaned:true`, `credentialUiRevoked:false`, `credentialRevoked:false`: esses dois últimos campos representam o encerramento do controlador, não uma afirmação de que a chave continuou ativa após a reconciliação UI. Suplemento `production-catalog-image-cleanup-v1-ui-reconciliation-2026-10-30.json` registra a exclusão UI sem forjar prova assinada. Screenshot seguro SHA256 `581665bb58b162b44c2048182237436070b488c3ebfa7a2ddc8fc43ba4dfc1ba`.

Não há fixture presa a limpar nem credencial temporária ativa observada; não criar outra chave para alterar o resultado histórico. A falta de prova S3 permanece explícita. Não houve deploy, schema, flag, billing, DNS, plano pago, push ou merge. As tarefas5/9/10, imagens associadas/referências retidas/quota, onboarding, bootstrap/reader/eventos e integração final continuam nos seus gates; esta limpeza não conclui a migração.
