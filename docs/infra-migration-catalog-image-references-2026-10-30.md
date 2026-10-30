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

Faltam o controlador fixo deste ciclo, leitura privada concreta dos snapshots, preflight/journal próprios e retirement de **quatro versões** (baseline, associação, desassociação, avanço), além de cleanup/logout e revogação em falhas. O perfil antigo de aposentadoria aceita somente um baseline vazio: não ampliá-lo genericamente nem reutilizar seu marcador consumido. A página de desafio também tem um problema conhecido de reload/Start a corrigir antes de outro login humano; não pedir instalação de navegador ou desativação de proteção.

A execução futura precisa dos seus próprios gates e autorização de acesso/escritas. Nenhuma chave, fixture ou URL de login foi criada nesta continuação. O parecer e as provas anteriores não autorizam o novo canário. Nenhum reviewer extra foi disparado por este subpasso; a revisão apropriada continua no gate do workflow completo antes de uso remoto/merge.

O `ok:false` histórico e a prova S3 de revogação não obtida na limpeza anterior permanecem preservados. Tarefas5/9/10 e Etapa13 abertas; total formal7/10. Este checkpoint não autoriza reader/bootstrap/eventos públicos, main, push, merge ou mudanças de planos pagos.
