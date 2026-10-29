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

## O que falta antes da janela real

O controlador ainda precisa integrar uma fixture própria, prova de ownership/baseline publicada e sem referências, journal exclusivo, login humano, execução uma vez, readback R2/SQL e aposentadoria/limpeza estritas. O callback de preflight não é essa prova por si só. Não executar este módulo diretamente, improvisar um cookie, reaproveitar markers consumidos ou enfraquecer a aposentadoria anterior, que foi desenhada exclusivamente para o CRUD de cinco versões.

Esta primeira parte cobre lease/upload sem associação pública. Ainda faltam associação da imagem ao catálogo e preservação quando referenciada pelo snapshot atual/anterior, leitura física após aposentadoria e reconciliação de quota no alvo real. A quota100MiB permanece coberta localmente; não será preenchida remotamente para obter um teste caro. A conversão automática já existente continua no navegador, sem novo serviço de processamento pago.

O onboarding deve usar as rotas canônicas de rascunho/finalização (`/account/onboarding-draft`, `/restaurants/:restaurantId/onboarding/finalize`), não `/onboarding` legado. A fixture antiga começa completa para isolar CRUD e **não** prova esse fluxo. A recuperação de finalização/resposta perdida precisa preservar a unidade e sua primeira publicação, conforme o plano e as regras de múltiplos restaurantes já existentes.

O bloqueio S3 imediato da credencial usada em27/10 continua não comprovado, embora a revogação UI esteja registrada; nenhuma credencial foi recriada para maquiar esse resultado. Reader/eventos permanecem desligados, Etapa13 e tarefas5/9/10 abertas, total formal7/10. Integração das branches/PRs permanece posterior aos gates, sem push/merge/main nesta preparação.
