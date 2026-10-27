# Prova funcional do writer — preparação em 27/10/2026

O [writer-only publicado](infra-migration-catalog-writer-published-2026-10-27.md) permanece o estado operacional de referência. A preparação inicial foi inteiramente local; a continuação abaixo acrescentou apenas um diagnóstico delimitado sobre um marcador sintético já aposentado no preview e GETs de capacidade da autenticação. Não houve seed remoto, publicação, mudança de flags ou escrita em produção.

## Probe HTTP delimitado

API `scripts/catalog-writer-probe.mjs`, sem CLI, fetch padrão, login, banco, seed ou limpeza. Exige sessão em memória e callback de preflight do controlador. Antes de escrever, confere alvo explícito, nome/slug `catalog-writer-<UUID>` e cardápio vazio; não opera em restaurante comum por fallback `/me`.

Percurso nominal de15 requests: criar item com variações, repetir a mesma chave e conferir item/versão, alterar disponibilidade/variações, patch privado sem revisão pública, patch misto, excluir item, rebuild e uma consulta/retry manual de operação já concluída. Usa seis IDs de operação distintos, header de protocolo e versões decimais sem conversão para Number. O replay é deliberado para verificar idempotência, não retry automático de uma resposta perdida.

No máximo24 requests/5min,15s por request e64KiB por resposta, redirect proibido e espaçamento padrão3,3s. Uma operação pendente permite **uma** consulta de status após5s; se continuar pendente, interrompe sem polling, próxima mutação ou limpeza cega. Relatórios só têm contagens/estágio/recibos seguros; corpo de erro e cookie não são impressos. Estes testes usam HTTP sintético, não provam execução no Worker ativo ou uma aplicação SQL única.

## Fixture de um owner

`createProductionCatalogWriterFixtureDriver` em API `scripts/tenant-preview-fixtures.mjs` reaproveita a conexão direta restrita e o ciclo transacional já existente, mas com **um owner verificado, uma organização Business e um restaurante** de UUIDs aleatórios e marcador próprio. As factories preview/produção de cinco contas conservam seu comportamento e rejeições de ambiente.

O seed é único; resposta COMMIT incerta não admite limpeza automática. A limpeza usa locks, verifica identidades/membership/ownership e mantém as recusas anteriores de efeitos de billing/onboarding/catalog/payment. A nova fixture também recusa sessões abertas, itens, pedidos, mesas e revisões restantes **antes de qualquer DELETE**. Não fornece bypass para apagar journal ou artefatosR2: a aposentadoria/quiescência correspondente precisa de gate próprio antes da limpeza final.

O restaurante começa finalizado apenas para isolar este primeiro probe de CRUD. Isso não é prova de onboarding, múltiplas unidades ou imagens. A restauração de paridade tenant e o smoke de cinco contas já encerrados não foram repetidos como substitutos.

## Verificação local

- 14 testes novos do probe: implementação ausente RED → GREEN, incluindo alvo/versão/replay inválidos, resposta perdida, sessão ausente, cancelamento, status pendente e limite de stream.
- 3 testes novos da factory: export ausente RED → GREEN; regressões anteriores preservadas. Focados25/25.
- Novo modo local `--only=catalog-writer --through=012`: inicialmente recusado antes de abrir servidor; depois implementado no harness existente. Não aceita schema anterior nem URL remota/ambiente implícito.
- PostgreSQL real descartável loopback:4/4, com hash BetterAuth real, constraints/membership e preservação de identidade alheia; limpeza recusada com sessão, item ou revisão remanescente. Só a fronteira de identidade/TLS externa foi substituída para usar o banco local; não é prova de TLS/Neon remoto.
- Toda a suíte de operadores API462/462 e testes da aplicação API704/704, sem falhas/skips. Fontes de runtime e configurações de deployment não mudaram; sem rebuild ou repetição dos canários.

Logs no workspace próprio `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`: `catalog-writer-probe-red.log`, `catalog-writer-probe-green.log`, `catalog-single-owner-fixture-red.log`, `catalog-writer-preparation-focused-green.log`, `catalog-writer-local-pg-mode-red.log`, `catalog-writer-local-pg.log`, `catalog-writer-api-all-scripts.log`, `catalog-writer-api-unit-tests.log`.

## Continuação: login único e aposentadoria delimitada

`createProductionCatalogChallenge` reutiliza o bridge loopback, com factory fixa de um proprietário e texto de um login. O fluxo anterior continua fixo em cinco contas. Mantidos Host/Origin/nonce, início humano explícito, limites de corpo, rejeição de desafio dummy, cancelamento e encerramento do listener. Três testes RED → GREEN; sete no conjunto. Nenhum bridge humano está ativo.

`scripts/catalog-writer-retirement.mjs` exige probe concluído sem incerteza, seis recibos terminais (cinco versões públicas crescentes e patch privado sem versão), logout401 e zero sessões SQL. Sob locks, confere exatamente uma identidade, organização, membership owner e restaurante sintético, sem efeitos inesperados; confere os cinco journals e a revisão final. Valida todos os objetos conhecidos antes da primeira escrita. Não lista buckets nem apaga objetos ou identidades.

Slug vira tombstone e snapshots viram pequenos fences por gravação condicional com ETag. O manifesto válido e pequeno é preservado: trabalhos tardios de prune ainda conseguem lê-lo e concluir, sem transformar limpeza em alarmes falhando. Depois de readback de todos os fences e manifesto inalterado, remove apenas os journals/revisão conhecidos, com predicados completos e readback SQL independente. Só então a limpeza estrita da fixture poderá remover as identidades. PUT, conflito, readback ou COMMIT incertos interrompem sem retry ou limpeza de identidades. Pequenos fences e metadados DO podem permanecer; isso não é promessa de apagar todos os recursos de teste.

Doze testes novos de aposentadoria falharam por módulo ausente e depois passaram em PostgreSQL descartável real. Com os quatro anteriores,16/16: preservação de dados alheios, sessões/membership/journal inesperados, versões acima de Number.MAX_SAFE_INTEGER, objetos divergentes, CAS e COMMIT perdido. Somente logout HTTP e R2 são fronteiras simuladas; não é prova de execução no Worker/Neon/R2 de produção.

## Transporte R2: diagnóstico real e alternativa S3

A [documentação S3](https://developers.cloudflare.com/r2/api/s3/extensions/) garante avaliação atômica de `If-Match`; o [upload REST](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/) usado pelo Wrangler não documenta esse header. Não se presumiu equivalência.

O controlador fixo `production-catalog-conditional-put-capability-v1.mjs` foi executado uma vez: dois GETs do perímetro privado e GET do snapshot sintético preview já aposentado `8572dc6c-84b2-4b12-8099-934204cc21eb/snapshots/1.json`; um PUT dos **mesmos bytes** com ETag impossível; GET final. Resultado: HTTP200, corpo e ETag preservados, portanto **proteção condicional não comprovada nessa API**. Nenhum objeto novo ou produção foi escrito, mas houve um PUT aceito no marcador preview; não afirmar zero operações remotas ou ausência de atualização de metadados. Não repetir o marcador consumido.

Recibo `production-catalog-conditional-put-capability-v1-result.json`, início22:12:22.065Z, SHA256 `61031938676d492858d5e67ad49f985b267717b3dad9fcc7350d97253822f707`. `supported:false` é o resultado esperado da descoberta, não permissão para enfraquecer CAS. O helper tem quatro testes RED → GREEN, incluindo PUT aceito explicitamente tratado como não suportado e resposta perdida sem retry.

`scripts/catalog-writer-s3-store.mjs` usa o SDK S3 já instalado, endpoint/bucket production fixos, credenciais explícitas com expiração de no máximo30min e sete chaves derivadas do único alvo/cinco versões. Sem fallback de ambiente, list/delete, escrita de manifesto ou payload arbitrário. Só grava pequenos fences, com `If-Match`, no máximo32 requests, timeout15s, corpo limitado e `maxAttempts:1`. Dez testes RED → GREEN com assinatura/deserialização reais e fronteira HTTP simulada: ETag,412,500 sem retry, limite de stream, expiração, chaves/corpos rejeitados e close. A revisão detectou que rejeitar Content-Length/ETag antes da leitura deixava o body aberto; dois testes reproduziram a falha e a correção destrói o stream recebido. Não é prova do S3 remoto.

Verificação final desta continuação:479/479 testes dos operadores,704/704 da API,16/16 no PostgreSQL local real; zero falhas/skips. Logs `catalog-retirement-all-scripts-final.log`, `catalog-retirement-api-unit-final.log`, `catalog-writer-retirement-pg.log` e ciclos RED no workspace próprio. Runtime/configs não alterados; servidor local encerrado.

O usuário aprovou a credencial temporária restrita a objetos de `vapt-catalog-production`,30min e revogação ao encerrar. **Ainda não criada**: só será emitida quando a janela estiver pronta. Dois GETs de metadados/permissões retornaram403 para a autenticação Wrangler atual; isso não autoriza ampliar seus privilégios ou reutilizar secrets dos Workers. A criação/transferência segura ainda precisa ser integrada, sem imprimir ou persistir o valor.

## Continuação: orquestração de ciclo único

API `scripts/catalog-writer-gate.mjs` agora liga o probe HTTP real ao ciclo de um owner: preflight, storage pronto, desafio humano antes do seed, journal antes das mutações, seed/login únicos, probe, logout401, nova checagem, aposentadoria restrita, limpeza estrita e revogação da credencial. Exige pelo menos10min restantes da credencial antes do seed. Não tem CLI, fetch padrão, descoberta de secrets ou provisão própria; os adapters concretos do controlador fixo ainda são obrigatórios.

Uma resposta perdida, seed/limpeza incertos ou trabalho pendente não causam retry ou descarte automático da fixture. Cancelamento durante seed é tratado como incerto, inclusive quando o resultado chega depois do cancelamento; senhas tardias são descartadas. Cookie conhecido recebe uma tentativa de logout, com orçamento de limpeza separado do cancelamento do teste. Falha no journal ou credenciais malformadas não impedem a tentativa única de revogação. Revogação não confirmada impede declarar sucesso mesmo que os dados já tenham sido limpos.

15 testes locais: os12 iniciais falharam por export ausente; o primeiro GREEN expôs revogação indevidamente dependente do journal, corrigida sem enfraquecer a parada das mutações. Testes adicionais reproduziram cancelamento durante seed e credenciais malformadas. O caso nominal usa o probe HTTP real (15 requests) e quatro requests de autenticação, com fronteiras de banco/storage/HTTP simuladas. Portanto **não prova login, CRUD, revogação ou limpeza remotos**. Suíte final dos operadores494/494 e da API704/704, zero falhas/skips; PostgreSQL16/16 é a evidência anterior, não repetida nesta rodada sem mudança SQL. Logs `catalog-writer-gate-{red,abort-red,malformed-red,green,all-scripts,api-unit}.log` no workspace próprio.

O Brave foi localizado, mas o vínculo CDP com a aba Cloudflare falhou em `Emulation.setFocusEmulationEnabled`, inclusive após reiniciar a sessão e selecionar o ID atualizado. Nenhum input no painel, token criado, bridge aberto ou preflight remoto foi executado nesta rodada. Foi solicitado ao usuário deixar a aba Cloudflare em primeiro plano, sem alterar proteções. Não continuar repetindo a mesma tentativa de conexão sem nova evidência.

## Continuação: credencial restrita e controlador concreto

O acesso ao Brave foi recuperado. A tela de criação foi preparada, sem envio, com o nome `vapt-catalog-production-writer-test-2026-10-27`, Object Read & Write **somente** em `vapt-catalog-production`. O painel não oferece validade de30min; o usuário aprovou expressamente **24horas e revogação após o teste**. O corte local continua em30min: não equivale à expiração da chave no provedor. Se a revogação falhar, a chave pode permanecer válida até24horas.

O novo coletor `scripts/catalog-r2-credential-input.mjs` recebe os dois campos S3 uma única vez em loopback, com Host/Origin/nonce, limite4KiB e prazo20min. A entrega é write-only ao controlador, sem arquivos, eco, endpoint de leitura ou logs de valores; não reutiliza a ponte Turnstile para receber credenciais. Quatro testes RED por export ausente → GREEN. `catalog-writer-s3-store.mjs` agora confirma revogação por GET assinado no slug sintético:403 confirma bloqueio;404, sucesso ou erro de rede não confirmam. Três novos testes RED por método ausente → GREEN.

O controlador fixo `production-catalog-writer-functional-v1-controller.mjs`, no workspace próprio do plano, integra os módulos anteriores. Exige journal exclusivo antes de criar a credencial, chaves entregues em memória, início/Turnstile humano, fontes e deployments fixos, readiness SQL somente-leitura, um seed/probe, logout, aposentadoria CAS, limpeza estrita e revogação confirmada. Sua stdin recebe somente os comandos não secretos `mark-issued` e `confirm-revoked`. Não publica código nem altera schema/flags/billing. A revisão completa do novo fluxo é obrigatória antes de iniciar a janela.

A revisão única do fluxo identificou dois riscos importantes, corrigidos em uma passagem com regressões RED→GREEN: cancelamento agora propaga sinal e aguarda rollback/encerramento dos mutadores antes de revogar/fechar conexões; o controlador limita todo o trabalho a20min desde a entrega das chaves, reservando10min dentro do corte local de30min para encerramento e revogação. O teste com relógio controlado confirma que nenhuma requisição assinada é permitida após esse corte. PostgreSQL real18/18 confirmou, inclusive, rollback do journal e preservação das identidades quando há cancelamento antes dos DELETEs ou COMMIT da aposentadoria.

Verificação final após correções: operadores506/506, API704/704, PostgreSQL local18/18 e controlador local2/2, zero falhas/skips. Fontes/configurações de runtime intactas. Detalhe menor adiado: dois POSTs válidos simultâneos no coletor podem ambos receber204, mas somente o primeiro par é entregue ao único consumidor; o formulário impede envio duplo. A revisão não verificou credencial, login, CRUD ou limpeza remotos; continuam gates da execução real.

Nesta preparação passaram501/501 testes dos operadores API e704/704 da aplicação, sem falhas/skips. Dois testes do controlador fixo falharam por arquivo ausente e depois passaram: apenas modo local `check` e rejeição de argumento inválido. Não constituem prova do fluxo remoto. A restrição inicial de subprocessos no sandbox causou `spawn EPERM`; a execução local autorizada passou. Nenhuma chave ou fixture real foi criada para obter esses resultados.

## Ainda não executar o CRUD remotamente

Faltam o controlador one-shot atual, emissão/revogação segura da credencial aprovada, integração do login humano/Turnstile e a execução dessas provas no alvo sintético. As peças de sessão/aposentadoria estão testadas localmente, não executadas em produção. Não reaproveitar journals consumidos nem a limpeza preview do canário8MiB, que pressupõe fechamento global do writer.

Depois desta preparação ainda serão necessárias provas de imagens/quota/referências, onboarding, recuperação de trabalho efetivamente pendente e clientes ativos. Não afirmar que os testes HTTP sintéticos provam esses casos, nem ativar o reader/eventos. Total formal7/10, tarefas5/9/10 e Etapa13 abertas; sem main/push/merge ou garantia financeira.
