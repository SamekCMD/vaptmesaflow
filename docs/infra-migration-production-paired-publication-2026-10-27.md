# Publicação production — 27/10/2026

## Estado real: três versões publicadas, gate ainda pendente

O usuário autorizou explicitamente publicar API, billing e frontend sob manutenção, criando somente o namespace SQLite de catálogo pendente. A execução única começou às00:15:43SP. API e billing tiveram confirmação no journal; o upload do frontend também ocorreu, mas o operador parou na verificação pública. **Não houve retry, rollback, abertura de tráfego ou retomada de billing.** O recibo original permanece parcial; o readback independente não o reescreve como sucesso.

| Componente | Deployment | Version, 100% |
| --- | --- | --- |
| API | `b877793d-73c9-4754-bab5-a6a951c5c0c4` | `4089ee21-2eec-4a5f-8031-f515d5cff5c5` |
| Billing | `e9db2125-fec9-4871-9854-d7532f54dc19` | `b156056a-c5b5-4f14-94c3-65bfd6097fd6` |
| Frontend | `1ef9bf9a-4ff4-4f9a-81b1-06b482e724df` | `f4289757-b092-4ea6-af52-a8ca4191d833` |

API contém o módulo canônico4754027bytes/SHA256`7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94`, sob o wrapper503 de228bytes fixado. Billing contém407543bytes/SHA256`6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587`, enviado pelo endpoint content-only. Bytes foram novamente conferidos por outro processo.

Namespace PublicCatalogCoordinator criado: `1e226bebcddc47079def5ed60beb73df`, SQLite. RestaurantRealtime existente `d3ad7a4008c64124b765f934986956da` preservado. Bucket `vapt-catalog-production` existente continua privado, agora com binding na API; não foi recriado.

## Controles preservados

Readback GET-only independente às00:21:50SP confirmou API503/no-store/Retry-After60/sem cookie; CPU1000ms; bindings esperados de oito secrets por metadados, Hyperdrive, imagens, realtime e seis rate limits. Catálogo reader/writer false. Workers.dev/preview e custom domains preservados. Fila pausada, retenção86400s, consumer/settings/DLQ preservados, backlog aproximado0. Cron de billing vazio. Nenhum novo secret, DNS, plano pago, main, push ou aposentadoria de legado.

Antes da publicação, conferência SQL somente-leitura às00:14:25SP confirmou hash`b28390b5839143e11b99d9c82b427fc44f3b11aaadd237f8f8731cd0a32294fe`,30tabelas vazias e integridade; conexão real `vapt_api_production` com cinco leituras permitidas e payload privado negado. TLS1.3, quota216000s e compute0.25CU fixo. **Não se reaplicou SQL, backup ou ensaio.**

## Causa da parada e pendência real

O verificador tratava todos os caminhos como respostas200 byte-idênticas. Dois comportamentos do provedor exigem uma verificação específica, sem desativar proteções:

- `/index.html` responde307 para `/`; a raiz entrega exatamente o HTML congelado, SHA256`03995f34bcf9b0a5723c424c483e74832481e5a55bd54c6ae5de4daa06ca28a0`. É o [tratamento canônico de HTML](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
- `robots.txt` contém os174bytes originais como sufixo exato, precedidos por2676bytes de conteúdo gerenciado da Cloudflare, prefixo SHA256`3073d1e371afb3271c7666148766fedc5145f7d8440f7114062db79b7bd58add`. Esse [prefixo gerenciado é documentado](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/). O readback só reconhece esse hash observado, não qualquer divergência.

**Falha no operador desta rodada:** o `_headers` congelado foi enviado somente como arquivo estático, sem transmitir suas regras em `assets.config._headers`. JS/CSS estão com `Cache-Control: public, max-age=0, must-revalidate`, não o `public, max-age=31556952, immutable` previsto. Não é falha da aplicação ou banco; a semântica de cache do deployment ainda precisa de correção. A ferramenta instalada confirma que o deploy assets-only deve transmitir o texto das regras no metadata, conforme o mecanismo de [headers de assets](https://developers.cloudflare.com/workers/static-assets/headers/).

Readback independente posterior verificou os92arquivos congelados (HTML na raiz e robots com prefixo estritamente identificado), e terminou explicitamente **reprovado apenas no gate de cache**. Não representar como publicação integralmente aprovada. Para a correção, `_headers` deve ser configuração, não integrante da lista pública:91assets públicos e o mesmo arquivo de controle fixado, sem rebuild.

Correção local preparada em `scripts/production-paired-publish.mjs`: `frontendMetadata` transmite exatamente as regras congeladas; teste de regressão falhou antes da implementação e passou depois. Ainda **não foi publicada**. Nova execução restrita somente ao frontend exige autorização renovada após esta parada; não repetir o operador pareado, migrations ou publicações API/billing.

## Evidências preservadas

Workspace: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`.

- Controlador consumido `production-paired-publication-v1-controller.mjs`, SHA256`8c32687aa729d59c9f0ddea75161c1151538911c96cf8aa2b2beb1e8e1711bce`. Não alterar/reexecutar.
- Recibo `production-paired-publication-v1-2026-10-27T03-15-43-264Z.json`, SHA256`84e4ae725a98370c813a1d5dcbb949551b2042845754d2177fe28f603442a82c`.
- Journal `production-paired-publication-v1-start.json` e cinco phase files: API/billing attempt+confirmed; frontend attempt, **sem confirmed**. Preservar, não fabricar confirmação nem apagar para repetir.
- Readback independente `production-paired-independent-2026-10-27T03-21-50-122Z.json`: controles e bytes confirmados, cache reprovado. Diagnóstico público `production-paired-asset-diagnosis-2026-10-27T03-20-24-212Z.json`.
- Verificações locais: frontend383/383; guardas relacionados66/66 após regressão do cache. O primeiro teste conjunto no sandbox bloqueou subprocessos Vite/CLI; execução permitida passou, sem relaxar testes. Não houve rebuild dos pacotes congelados.

Etapa13/catálogo continuam abertos. Após corrigir e verificar o cache, ainda faltam os gates próprios de validação/liberação da API e retomada de billing. Nenhuma garantia de teto global de fatura é dada por essa publicação.
