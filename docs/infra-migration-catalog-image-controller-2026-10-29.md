# Controlador do gate de imagens — 29/10/2026

Estado: preparado, testado e revisado, com os dois achados importantes corrigidos na passagem única. **A execução real ainda não começou.** Nenhuma credencial temporária nova, fixture remota, upload, alteração SQL no Neon, deploy, flag, billing, DNS ou main nesta continuação. A única chamada externa nova foi um GET R2 somente-leitura descrito abaixo.

## Percurso fixo

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

## Próximo gate

Salvar checkpoint e obter aprovação específica para a nova credencial restrita. Só então iniciar uma janela com o usuário disponível para os dois campos S3 e Turnstile. O marcador `production-catalog-image-v1-start.json` ainda não foi consumido; não iniciar duas vezes.

Depois desse ciclo sem associação ainda faltam as provas de imagem publicada/referências retidas/quota, onboarding canônico e recuperação, reader/bootstrap/eventos públicos e integração das branches/PRs. O plano permanece formalmente7/10, tarefas5/9/10 e Etapa13 abertas. Nenhum teto global de fatura foi criado.
