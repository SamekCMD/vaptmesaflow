# Imagens associadas e referências retidas — preparação local,30/10

Continuação das tarefas5/9 do [plano aprovado](infra-migration-public-catalog-event-driven-plan.md), após a [limpeza da fixture anterior](infra-migration-catalog-image-controller-2026-10-29.md). Não reinicia os testes concluídos, não muda o desenho de imagens e não certifica o gate remoto.

## O que foi preparado

API:`scripts/catalog-image-reference-probe.mjs`, export `runProductionCatalogImageReferenceProbe(options)`, com testes em `scripts/catalog-image-reference-probe.test.mjs`. É código operacional sem CLI, fetch padrão, descoberta de credenciais, seed/login, PUT de imagem, SQL direto, deploy ou retry de escrita. Nenhuma chamada real foi executada nesta preparação.

O chamador precisa fornecer uma imagem **já enviada e verificada**, baseline ready e fixture sintética comprovadamente própria; o probe não cria esses pré-requisitos. Aceita somente a API production conhecida, cookie no formato Better Auth esperado, restaurante UUID/tag próprios, uma chave exata `RID/branding/UUID` ou `RID/itemId/UUID` e a URL pública correspondente. Só o perfil de produto admite um único item, com ID/nome/tenant/imagem esperados; branding exige cardápio vazio. IDs das três operações são distintos e copiados antes de callbacks.

Sequência limitada, para logo ou produto:

1. Conferir alvo autenticado e presença física por leitura exata no provedor.
2. PATCH de associação; exigir recibo ready e versão decimal crescente; conferir estado autenticado e snapshots atual/anterior por leitura independente privada.
3. Exigir que DELETE da imagem retorne409/`menu_image_cleanup_pending`, com objeto ainda presente.
4. PATCH de desassociação; conferir atual sem referência, mas anterior ainda com a imagem; exigir novamente DELETE409 e presença física.
5. Um rebuild avança a versão sem modificar dados de domínio. Atual e anterior precisam estar sem a imagem.
6. Somente então aceitar DELETE204 e ausência física confirmada.

Há no máximo14 requisições à API, incluindo até um GET de status por mutação inicialmente pendente, sem loop. No caminho imediato são11. As leituras independentes de objetos ficam em portas separadas e **não estão incluídas** nesse contador HTTP. Cada corpo HTTP tem limite64KiB; callbacks recebem AbortSignal; prazo total5min e por request15s, com pacing padrão3,3s. Resultado pendente preserva o recibo observado e a chave original; resposta perdida, leitura divergente ou cancelamento encerra como incerto, sem desassociação, nova gravação ou cleanup automático. Os dois DELETEs negados são provas de estados distintos, não retries de uma resposta perdida.

Só metadados seguros de recibo, contagens e etapa são retornados. Cookie, DTO privado, diagnósticos externos e assinaturas não vão para o relatório. O transporte real do futuro controlador deverá honrar o sinal; um cancelamento local não desfaz efeito remoto já iniciado.

## Cota e compressão permanecem as mesmas

O código existente continua limitando imagem otimizada a1MiB e somando logo, produtos, versões retidas e reservas pendentes no orçamento de104857600bytes por restaurante. A suíte local já cobre limite exato, excesso, concorrência/reserva, restart, expiração sem reembolso cego e inventário incompleto. A execução completa da API nesta continuação também passou por esses testes, mas o novo probe de associação **não mede100MiB físicos no R2** nem prova codec/browser. Não encher o bucket remoto nem contratar processamento de imagens para simular uma cota. Esses limites técnicos não são teto global da fatura.

## Evidência local

- Os20 testes iniciais falharam pela ausência do export antes da implementação, depois passaram20/20.
- Regressão adicional do recibo comprometido ainda pendente reproduziu0recibos quando se esperava1, depois passou preservando operação/fase/versão observadas.
- Casos: logo/produto, origem/cookie/tag/chave/operações/portas inválidos, snapshot anterior ausente/divergente, referência errada/tenant estrangeiro, DELETE aceito prematuramente, respostas perdidas, versão regressiva, status ainda pendente, cancelamento e corpo excessivo.
- Suíte completa dos operadores589/589; API704/704; todas as execuções finais exit0, zero falhas/skips.

As portas HTTP/R2 desses20 testes são sintéticas. Não são prova de publicação, exclusão ou proteção da plataforma em produção. A integração PostgreSQL existente com locks/concorrência não foi repetida sem mudança que a justificasse; os44 testes da limpeza anterior continuam evidência datada, não um novo run deste probe. Nenhum código `src`, configuração de publicação, schema, segredo ou serviço mudou.

## O que ainda impede a execução real

Na preparação inicial faltavam o leitor privado e o retirement de quatro versões; os checkpoints abaixo os implementam, com aposentadoria restrita a **branding**, e integram upload/logout/cleanup no gate local. Ainda faltam o controlador fixo deste ciclo e seus preflight/journal/pins e adaptadores reais. O perfil antigo de aposentadoria continua aceitando somente um baseline vazio: não ampliá-lo genericamente nem reutilizar seu marcador consumido. O problema conhecido de reload/Start foi corrigido e testado localmente; não foi realizado outro login humano nem pedido outro navegador ou desativação de proteção.

A execução futura precisa dos seus próprios gates e autorização de acesso/escritas. Nenhuma chave, fixture ou URL de login foi criada nesta continuação. O parecer e as provas anteriores não autorizam o novo canário. Nenhum reviewer extra foi disparado por este subpasso; a revisão apropriada continua no gate do workflow completo antes de uso remoto/merge.

O `ok:false` histórico e a prova S3 de revogação não obtida na limpeza anterior permanecem preservados. Tarefas5/9/10 e Etapa13 abertas; total formal7/10. Este checkpoint não autoriza reader/bootstrap/eventos públicos, main, push, merge ou mudanças de planos pagos.

## Integração local: leitor privado e aposentadoria de branding

`scripts/catalog-image-reference-readback.mjs` agora implementa `readProductionCatalogImageReferences`. Usa somente o `store.get` injetado, sem fetch/default, SQL, CDN, listagem ou escrita. Confere seis leituras exatas: slug, manifest, snapshot atual, snapshot anterior, manifest e slug novamente. Valida alvo, versões decimais, identidade do catálogo e tamanho4096/65536bytes; exige ETags e corpos estáveis nas duas últimas leituras. Ausência, tombstone indevido, versão/tenant divergente, mudança durante a leitura, falha ou cancelamento encerram sem reparo/retry. Os testes do probe passaram a usar esse leitor real; somente a fronteira externa de objetos é simulada, com18 GETs privados no ciclo completo.

O relatório do probe agora vincula restaurante, tipo de alvo, chave da imagem e versão baseline. Dois testes reproduziram esses campos ausentes antes da correção. Recibos e provas posteriores só podem ser usados pelo perfil correspondente.

`createProductionCatalogBrandingReferenceS3Store`, no transporte existente, aceita exatamente quatro versões crescentes daquele restaurante, mais slug e manifest: seis chaves, nunca outro bucket/prefixo. Só permite os fences pequenos exatos com If-Match; sem list/delete/alteração de manifest, credencial padrão ou retry SDK. Seu limite fixo64requests acomoda os18 GETs de readback, aposentadoria e verificação final; não é configurável pelo chamador nem teto de fatura. Os perfis antigos continuam com3/7chaves e32requests. A assinatura real do SDK foi exercitada com handler de rede sintético, não com serviço Cloudflare.

`retireProductionCatalogBrandingReferenceFixture` reutiliza os locks de organização/restaurante/usuário, propriedade/membership, ausência de sessões/efeitos, CAS e readback independente do caminho existente, mas exige quatro operações nomeadas: rebuild, attach, detach e advance. Precisa de duas exclusões negadas, prova de ausência física e recibos estritamente correspondentes. O SQL precisa conter exatamente os quatro snapshots: baseline vazio, uma associação de logo à chave registrada, desassociação e avanço vazios; estado atual sem logo/descrição e sem itens. Só as duas versões mais antigas podem já estar prune-fenced; atual e anterior nunca são aceitas como aposentadas antes da janela. Journal/revisão são removidos após os fences e seu readback; identidades continuam responsabilidade do cleanup guardado separado. Nenhum guard anterior foi dispensado.

**Decisão de escopo:** esse retirement é somente de logo. O probe de produto deixa um item existente; sua limpeza precisa incluir uma exclusão **versionada** adicional. Não apagar esse item por SQL de owner nem relaxar o guard de fixture para caber em quatro versões. O teste de produto continua preparado, mas seu ciclo completo de limpeza ainda não está integrado.

Evidência desta continuação:

- Leitor16casos e transporte2casos novos falharam por export ausente antes de implementar;33/33 passaram com os15 anteriores de transporte. Composição probe/leitor/transporte53/53.
- Nove casos novos PostgreSQL falharam primeiro pela ausência do perfil. Após implementação, um caso estava montado com versão do snapshot diferente da coluna e foi recusado pela constraint do schema; corrigiu-se somente a fixture, sem mudar SQL/constraints/guards.
- PostgreSQL descartável final53/53, incluindo limpeza do ciclo válido, recusa de prova insuficiente, perfil de produto, imagem presente, associação estrangeira, operação adicional, snapshot atual já aposentado, resposta CAS perdida e recusa pelos perfis antigos. O cluster encerrou ao final.
- Suítes finais: operadores607/607 e API704/704, exit0/zero falhas/skips. Código de aplicação `src` e configuração/schema/dependências não mudaram; sem novo deploy, chave, fixture remota ou chamada de provedor.

Os arquivos operacionais compartilhados mudaram de hash: controladores históricos já consumidos permanecem congelados e **não devem ser repinados ou repetidos**. O futuro controlador terá seus próprios pins, fontes de credenciais e autorização; esta preparação local não autoriza rodá-lo. A prova Cloudflare e o fluxo completo continuam pendentes, não substituídos pelo PostgreSQL local ou pelos handlers sintéticos. Sem nova revisão por subpasso; o workflow completo mantém seu gate de revisão antes de uso remoto/merge.

## Ciclo integrado e página local

`runProductionCatalogImageUploadProbe` reaproveita os mesmos guards do teste de lease, mas encerra após upload verificado e uma escrita antiga bloqueada412: não apaga nem associa a imagem. São7requests no perfil branding (8produto), duas PUTs e nenhuma DELETE. O perfil antigo completo permanece inalterado. Três novos casos falharam por export ausente antes de implementar; cobrem branding/produto e resposta PUT perdida sem retry/cleanup.

`runProductionCatalogBrandingReferenceGate` compõe baseline, upload-only, associação/proteção/desassociação/avanço/exclusão, logout401, aposentadoria de quatro recibos e cleanup guardado. Exige portas privadas de referência e presença física antes de seed. Falhas antes da associação, no readback ou na presença física não apagam a fixture; logout/revogação/fechamento continuam pelo caminho comum. Não há CLI, credencial padrão ou chamada real nessa composição. Cinco testes novos falharam primeiro por export ausente e depois passaram, com os probes reais e transportes externos sintéticos.

`createProductionCatalogRetainedReadS3Store` limita cada fase às duas versões **já conhecidas**, slug e manifest, seis GETs e nenhuma PUT. Não prever valores futuros da sequência PostgreSQL global nem ampliar o prefixo permitido. O perfil de quatro versões é reservado à aposentadoria, quando todos os recibos já existem. A mesma chave restrita pode alimentar esses clientes em memória; não são necessárias credenciais extras por fase. Teste RED→GREEN verifica recusa de escrita/chave desconhecida e sétima leitura, usando o SDK real com handler sintético.

A página de desafio começa com Start desativado até obter o estado do servidor. Reload de execução pendente/em andamento/encerrada não reativa o botão; requisição de início em voo e perda do status também mantêm bloqueio. O servidor, nonce, Origin/Host e verificação Turnstile permanecem intactos. Os testes executam o JavaScript servido em JSDOM contra o listener loopback real, sem carregar/solucionar o CAPTCHA externo:12/12. Três reproduziram o defeito antes da correção; outros caracterizam estados que já funcionavam.

Verificação final deste checkpoint: operadores621/621 e API704/704, exit0/zero falhas/skips; foco lifecycle+S3 46/46. PostgreSQL53/53 é o run do checkpoint anterior, não foi repetido porque SQL/retirement não mudaram. Nada em `src`, configuração, schema ou dependências mudou. Não houve chave, seed remoto, login, upload real, deploy, push ou merge. O próximo controlador deve exigir confirmação do **operador ativo após receber as chaves**, antes de iniciar desafio/mutações, para evitar novamente encerrar o turno enquanto a janela de revogação corre sem acompanhamento.
