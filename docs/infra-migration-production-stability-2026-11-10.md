# Estabilidade e dependências de produção em 10/11/2026

A leitura da Cloudflare às 22:28 de Brasília confirmou `vapt.app.br` no Worker `vapt-web` e `api.vapt.app.br` em `vapt-api-production`. As versões conhecidas da API `0aadb532`, do frontend `372e0bb3` e do billing `b156056a` atendiam 100% de seus deployments.

| Caminho | Dependências observadas |
| --- | --- |
| API | Hyperdrive com origem Neon, Better Auth no domínio da API, Stripe em Test e limite de CPU de 1.000 ms |
| Imagens e catálogo | Bindings R2 para imagens e catálogo, com acesso gerenciado `r2.dev` do bucket de catálogo desativado |
| Catálogo e realtime | Reader e writer ligados, com os Durable Objects `PublicCatalogCoordinator` e `RestaurantRealtime` |
| Billing | Cron de 30 minutos, fila ativa, consumidor no Worker de billing e secrets de banco e Resend presentes por nome e tipo |

A listagem dos domínios Workers passou. A listagem completa dos registros DNS da zona recebeu HTTP 403 com a credencial disponível. A confirmação se aplica aos dois domínios públicos acima. A auditoria de outros registros da zona, de jobs legados e dos destinos de webhooks externos continua aberta.

## Métricas de 01:30 a 22:20 de Brasília

| Componente | Invocações registradas | Resultado observado |
| --- | ---: | --- |
| API | 188 | 168 classificadas como sucesso e 20 encerramentos de conexão ou stream. O contador de erros de execução do Worker foi zero e a CPU máxima observada foi 303,360 ms. |
| Billing | 41 | Todas classificadas como sucesso pelo Worker. |
| Durable Object de catálogo | 32 | 20 classificadas como sucesso. Os 12 erros reportados foram classificados como desconexão de cliente ou stream. |

O intervalo inclui a edição real do cardápio e o evento observado no navegador. Os status de execução agregados não são status HTTP por rota, confirmação de entrega de email ou atribuição individual das desconexões. [Observação do cardápio](infra-migration-catalog-live-production-2026-11-10.md)

## Backup e conteúdo publicado

O dump de 24/10 permanece no workspace protegido e seu SHA-256 e tamanho de 108.972 bytes coincidem com o recibo. A cópia atualizada de 10/11 inclui o schema posterior às migrations 009–012 e o restaurante de teste. A restauração local conferiu estrutura, permissões, contagens e hashes das 30 tabelas. [Backup de 24/10](infra-migration-production-backup-2026-10-24.md) · [Backup atualizado](infra-migration-production-backup-2026-11-10.md)

Os merges na `main` acrescentaram as correções de validação Stripe e Better Auth na API e as correções de fallback de delivery e remoção de item no frontend. A conferência dos deployments acima ainda encontrou as versões anteriores a essas correções. [API #1](https://github.com/SamekCMD/vapt-api/pull/1) · [Frontend #4](https://github.com/SamekCMD/vaptmesaflow/pull/4)

## Conferência do legado após o backup

Às 22:41 de Brasília, a listagem completa dos dois buckets R2 de produção retornou HTTP 200. `vapt-assets-production` tinha zero objetos. `vapt-catalog-production` tinha 31 objetos, com 4.114 bytes no total. A inspeção local do dump encontrou um restaurante e um item, sem valores em `logo_url` ou `image_url`. A conferência cobre os arquivos referenciados pelo banco nesse snapshot e o inventário atual dos buckets de destino. [Backup atualizado](infra-migration-production-backup-2026-11-10.md) · [Listagem do R2](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/list/)

O DNS público retornou A e AAAA para `coolify.vapt.app.br`. A consulta HTTPS ao painel expirou em 12 segundos. `assets.vapt.app.br` e `dashboard.vapt.app.br` retornaram NXDOMAIN no resolvedor consultado. A lista administrativa completa da zona segue pendente pelo HTTP 403 registrado acima.

O webhook Stripe Test da conta anterior apontava para `https://api.vapt.app.br/webhooks/stripe` e voltou ao estado desativado após o ensaio. Em 10/11, o usuário confirmou que mudou de conta Stripe e que a conta atual ainda está sem webhooks. A configuração do billing nessa conta passa a ser uma etapa própria. [Ensaio anterior do Stripe](infra-migration-phase-13-stripe-provider.md)

O usuário também confirmou que o Coolify deixou de executar serviços e que sua única função anterior, o banco Supabase, já foi transferida para o Neon. O registro DNS do painel legado ainda resolve. O próximo passo de aposentadoria é identificar a VPS exata no painel Hetzner e confirmar a exclusão do recurso. [Cancelamento na Hetzner](https://docs.hetzner.com/general/billing-and-account-management/cancellation/cancellations-hetzner-console/)

## Exclusão do servidor e conferência pública

O usuário identificou o servidor `vapt-1` no projeto `Default`, autorizou a exclusão definitiva e confirmou que concluiu a ação no painel. Às 23:00:54 de Brasília, três GETs públicos retornaram HTTP 200 para o site, a saúde da API e o catálogo de teste. O catálogo retornou a revisão `19` e um item.

O usuário confirmou que o projeto `Default` ficou sem recursos remanescentes, incluindo volumes, IPs, snapshots e load balancers. A etapa de aposentadoria da Hetzner está encerrada com base nessa confirmação e na verificação pública após a exclusão. A fatura final pode incluir uso proporcional anterior à exclusão. [Cobrança e cancelamento de recursos](https://docs.hetzner.com/general/billing-and-account-management/cancellation/cancellations-hetzner-console/)

## Publicação das correções da main

Às 23:34 de Brasília, os artefatos das árvores verificadas na `main` entraram nos Workers de produção. A API foi publicada primeiro, com os ajustes de validação Stripe e Better Auth. O frontend recebeu em seguida as correções do delivery e da remoção de itens. [Main da API](https://github.com/SamekCMD/vapt-api/commit/12596fa0a4fa098aaeaaff03b048bf3320ef4759) · [Main do frontend](https://github.com/SamekCMD/vaptmesaflow/commit/04a3e75f00c867796a6351bb60aaeed711eda294)

| Worker | Deployment | Versão ativa a 100% |
| --- | --- | --- |
| `vapt-api-production` | `bb67ca5a-f978-4812-93f3-2936818c25f4` | `25bf7ff3-5148-439b-9d6c-6d7007ad1cbd` |
| `vapt-web` | `07de2d09-147e-4902-806d-0c31d40ec73e` | `b96edcf0-297e-4317-b363-26a4cace92d2` |

O módulo ativo da API correspondeu ao hash do artefato. Saúde, inicialização e catálogo retornaram 200 e a consulta de sessão anônima retornou 401. A conferência do painel confirmou as versões e os controles de produção, incluindo flags do catálogo, limites de CPU, Durable Objects, domínios, fila e cron de billing.

O publicador confirmou a versão do frontend e encerrou com falha na primeira leitura pública. A causa dessa primeira divergência ficou indeterminada. Às 23:34:44, uma nova consulta somente leitura confirmou HTTP 200 e bytes exatos para a home, o link do cardápio e o JavaScript de entrada. O Brave, em perfil temporário, renderizou o cardápio com revisão `19`, um GET de catálogo e WebSocket 101. A tela de login também renderizou, com checagem visual de campos e botão.

O build foi validado com os hashes registrados no manifesto local `production-main-fixes-v1/manifest.json`. Os 31 testes dos componentes de publicação passaram. O recibo original `publication-result.json` preserva a falha da primeira leitura do frontend e as seis operações de publicação. As verificações posteriores usaram somente leitura.
