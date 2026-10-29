# Gate de imagens — preparação local em 29/10/2026

Avançou a prova do ciclo de upload, sem repetir o [CRUD real de27/10](infra-migration-catalog-writer-functional-2026-10-27.md). Nenhuma chamada Cloudflare/Neon, chave, login, fixture remota, upload real, deploy, flag, schema ou main foi criado/alterado nesta preparação.

## Novo probe delimitado

API `scripts/catalog-image-lease-probe.mjs` e `.test.mjs`: módulo somente de operador, sem CLI, fetch padrão, login, seed, SQL, descoberta de credenciais ou limpeza global. Exige sessão em memória, alvo production fixo, marca sintética `catalog-writer-<UUID>`, duas chaves distintas de operação e preflight externo. Aceita logo ou um item explicitamente marcado, sempre sem imagem inicialmente associada.

Percurso nominal: verificar escopo; recusar reserva acima de1MiB; reservar lease; enviar WebP sintético de42bytes com PUT condicional; consultar a mesma lease e confirmar `uploaded`; tentar deliberadamente a URL antiga e exigir412; verificar a mesma lease; aposentar o objeto conhecido; exigir410 para a lease aposentada e412 contra ressurreição pela URL antiga. Essas negativas são testes explícitos, não retry automático de respostas perdidas.

São10 requests para logo ou11 para item, máximo12, prazo5min, deadline15s por resposta e64KiB de corpo. Default espaça requests em3,3s. Preflight, pacing, transporte e leituras de stream observam cancelamento; uma resposta de transporte tardia é descartada/cancelada. O transporte real deve respeitar o AbortSignal; abortar HTTP não prova rollback de uma mutação já recebida. Resposta perdida ou divergência interrompe com incerteza e **não** provoca nova tentativa ou DELETE de recuperação.

O descritor precisa apontar ao host S3 virtual do bucket `vapt-assets-production` na conta existente e à chave exata deste restaurante/alvo/UUID. Rejeita preview, outro host/chave, alias de URL pública, headers extras, ETag fraco, CAS ausente, assinatura antiga e assinatura sem Content-Length/Content-Type/If-Match. Cookie/Origin da aplicação nunca são encaminhados ao S3. URL assinada e credenciais não entram no relatório; só IDs, contagens, estágio e confirmações seguras.

## Evidência local

- 21 casos iniciais RED por export ausente → GREEN: dois alvos, entradas inválidas, descritores indevidos e respostas perdidas/inconsistentes.
- Um caso de stream acima64KiB passou inicialmente: caracterização, não falso RED.
- Cancelamento durante leitura de corpo RED → GREEN, incluindo cancelamento do reader.
- Revisão única independente identificou espera de preflight não limitada. Três regressões de preflight/pacing/transporte travados RED → GREEN. A mesma correção cobre o deadline; sinal também é entregue ao preflight.
- O teste de corpo foi sincronizado com `highWaterMark:0`: `pull` agora indica leitura efetiva, não buffering antecipado durante criação da resposta. Falha transitória dessa sincronização foi registrada e corrigida antes do resultado final.
- Final:26/26 do novo probe, **532/532 operadores API**, **704/704 testes da API**, todos sem falhas/skips. Mais22/22 testes frontend existentes de compressão/armazenamento, sem mudar esses componentes.

As assinaturas dos descritores de teste são geradas pelo AWS SDK instalado, com credenciais sintéticas; somente a fronteira HTTP é simulada. Isso verifica o consumidor do protocolo e seus guards, não o comportamento remoto do S3. Os22 testes frontend não constituem prova de conversão usando o codec de um navegador real. Não houve alteração SQL que justificasse repetir PostgreSQL, migrations, backups ou canários já encerrados.

Revisão read-only `/root/catalog_image_lease_operator_review`, Astra medium, contexto isolado: nenhum crítico, um importante corrigido na passagem única, sem nova revisão. Limitação menor documentada: o mock HTTP não prova o Content-Length gerado pelo transporte real; isso pertence ao gate remoto, não será declarado validado por uma asserção artificial.

## Integração local do ciclo e da limpeza

Continuação de29/10, ainda sem execução remota:

- `runProductionCatalogImageBaseline` verifica o restaurante sintético completo, descrição/logo nulos e catálogo vazio; faz **um POST rebuild** e uma consulta de status. Se a primeira resposta estiver pendente, espera5s antes dessa única consulta; não faz polling nem retry. Recibo final precisa ser `ready`, do mesmo restaurante/operação/versão, sem arredondar versões bigint. São4requests, prazo5min,15s por resposta e64KiB de corpo.
- `runProductionCatalogImageGate` integra a fixture single-owner já existente ao baseline e ao probe de logo, depois logout401, aposentadoria, limpeza e revogação. Não reutiliza o CRUD anterior. O preflight `before_image` recebe o baseline e deve comprovar externamente a projeção pronta e sem referências antes de liberar upload. A execução nominal inclui14requests desses dois probes e4de autenticação; preflights e aposentadoria têm suas próprias operações delimitadas. Isso é um módulo de ciclo, **não** o controlador remoto com pins/journal já pronto.
- `retireProductionCatalogImageFixture` exige exatamente um journal/recibo público, snapshot vazio sem logo e manifesto com `previousVersion:null`. Confirma ownership e ausência de sessões/efeitos inesperados sob locks, exige readback físico da imagem, aposenta por CAS apenas slug e snapshot e conserva o manifesto pequeno válido. Só depois remove os registros SQL exatos, confirma zero independentemente e permite a limpeza estrita das identidades. O perfil antigo continua exigindo cinco versões/seis recibos.
- `createProductionCatalogImageS3Store` aceita uma versão explícita e apenas três chaves do bucket privado de **catálogo**. Não tem acesso ao bucket de imagens, listagem, DELETE, escrita de manifesto ou payload arbitrário. Reaproveita os prazos/restrições de credenciais do transporte anterior.
- `verifyProductionCatalogImageAbsent` faz um GET autenticado de uma única chave `restaurante/branding/UUID`, pela API Cloudflare da conta/bucket existentes, usando OAuth explícito em memória. Não cria chave de imagens nem usa CDN pública. Só aceita404 JSON com um único erro10007;200 confirma presença, enquanto401/403, bucket ausente10006,404 genérico, timeout e resposta inesperada interrompem. Corpo de erro limitado4KiB, prazo total15s, sem retry; cancela corpos rejeitados e respostas tardias. A rota GET está na [referência oficial](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/get/); a tabela [NoSuchKey10007](https://developers.cloudflare.com/r2/api/error-codes/) documenta Workers/S3, portanto o envelope REST exato ainda deve ser confirmado no gate real, sem convertê-lo em uma certeza por testes simulados.

TDD observado: exports ausentes → GREEN para baseline9casos, integração de gate5novos, perfil S3 um novo, aposentadoria12novos em PostgreSQL real e readback13casos, incluindo uma regressão RED→GREEN de cancelamento de corpo rejeitado. Dois problemas foram dos próprios cenários: snapshot extra com versão incompatível foi recusado pela constraint real e corrigido no teste; stream404 sem Content-Type foi corrigido para representar JSON antes de testar cancelamento. Nenhum guard de produto/schema foi afrouxado.

Regressão desta continuação: **560/560 operadores,704/704 API e30/30 PostgreSQL descartável**, sem falhas/skips nas execuções finais. O PostgreSQL foi encerrado; não houve migrations/grants no Neon, credencial, fixture ou upload remoto. Revisão independente única `/root/catalog_image_lifecycle_review`, Astra medium, read-only/contexto isolado: nenhum achado crítico, importante ou menor; apto apenas como batch local, sem segunda revisão ou ativação remota.

Decisões sobre os limites explicitados pela revisão:

- Envelope REST, permissões OAuth e remoção física continuam a exigir o readback real; divergência interrompe sem apagar SQL/identidades.
- Emissão, propagação e revogação S3 dependem da futura janela aprovada; a prova de revogação anterior não foi reclassificada como sucesso.
- Pins/readiness, journal exclusivo e orquestração remota ainda precisam do controlador concreto; callbacks não substituem essas evidências.
- TLS e identidade Neon reais não são provados pelo adaptador local; devem ser conferidos antes de seed remoto.
- Content-Length em trânsito, decodificação da imagem, compressão no browser e quota100MiB reais não são provados pelo arquivo42B; nenhum preenchimento caro de quota será feito por inferência.
- A fixture completa não exercita onboarding nem sua recuperação após resposta perdida; esse gate permanece separado nas rotas canônicas.
- Revogação enquanto um comando da aplicação espera e publicação pós-commit não mudaram; logout401 foi testado aqui, sem reabrir indevidamente as provas de runtime anteriores.
- Troca de canal/slug durante fetch e isolamento de carrinho não mudaram; este batch não contém alterações frontend.
- Proteção geral de imagens referenciadas por revisões retidas permanece no runtime existente; este ciclo só aceita baseline vazio sem referências. Associação pública continua pendente.
- Reader, migração completa, deploy e merge/main continuam gates separados. Parecer local não é autorização de publicação.

Se alguma dessas premissas externas não se confirmar, o custo aceito é interromper e reconciliar o estado sintético, não improvisar credenciais, executar cleanup cego ou ligar o reader. Não há novo teto financeiro garantido.

## O que falta antes da janela real

Falta o controlador fixo que una estes módulos com pins/readiness atuais, journal exclusivo antes dos efeitos, preflight concreto de ownership/projeção sem referências, login humano e transporte/revogação da credencial temporária de catálogo. O callback de preflight não é essa prova por si só. A fixture completa existente é suficiente para o teste de lease de logo sem associação, mas não prova onboarding. Não executar módulos diretamente, improvisar um cookie, reaproveitar markers consumidos ou afrouxar os perfis de aposentadoria. Uma nova credencial persistente só deve ser criada após aprovação específica e controlador pronto.

Esta primeira parte cobre lease/upload sem associação pública. Ainda faltam as provas remotas de associação da imagem ao catálogo, preservação quando referenciada pelo snapshot atual/anterior, leitura física após aposentadoria e reconciliação de quota. A quota100MiB permanece coberta localmente; não será preenchida remotamente para obter um teste caro. A conversão automática já existente continua no navegador, sem novo serviço de processamento pago.

O onboarding deve usar as rotas canônicas de rascunho/finalização (`/account/onboarding-draft`, `/restaurants/:restaurantId/onboarding/finalize`), não `/onboarding` legado. A fixture antiga começa completa para isolar CRUD e **não** prova esse fluxo. A recuperação de finalização/resposta perdida precisa preservar a unidade e sua primeira publicação, conforme o plano e as regras de múltiplos restaurantes já existentes.

O bloqueio S3 imediato da credencial usada em27/10 continua não comprovado, embora a revogação UI esteja registrada; nenhuma credencial foi recriada para maquiar esse resultado. Reader/eventos permanecem desligados, Etapa13 e tarefas5/9/10 abertas, total formal7/10. Integração das branches/PRs permanece posterior aos gates, sem push/merge/main nesta preparação.
