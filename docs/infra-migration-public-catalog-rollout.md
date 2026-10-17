# Catálogo por eventos — ativação e rollback

Estado em17/10/2026: telas integradas e testadas localmente; separação do armazenamento aprovada e preparada no código/configuração. Implantação **pendente**, nenhuma flag ativada. Código salvo em branches de infraestrutura, não na main. Referências: [plano aprovado](infra-migration-public-catalog-event-driven-plan.md), [writers](infra-migration-public-catalog-writers.md), [consolidação](infra-migration-branch-integration.md). Prova API: `docs/public-catalog-runtime-verification.md` no repositório `vapt-api`.

## Armazenamento aprovado — somente preparação local

| Ambiente | Imagens existentes: `R2_BUCKET` | Snapshots privados: `PUBLIC_CATALOG_BUCKET` |
| --- | --- | --- |
| Preview | `vapt-assets-preview` | `vapt-catalog-preview` (candidato, não criado) |
| Production | `vapt-assets-production` | `vapt-catalog-production` (candidato, não criado) |

O novo binding atende GET público/legado, registro do socket, projeção/recuperação e verificação das referências retidas antes de limpar imagens. Ausência/incompletude retorna503, sem usar imagens ou SQL como fallback. Upload, inventário e exclusão física de imagens continuam no binding antigo. Não há novo token S3, URL pública, domínio, CORS ou alteração de ACL; os dois buckets privados ainda precisam ser criados e ter privacidade confirmada no gate remoto autorizado. Não presumir privacidade pelo nome ou pelo teste local. Aprovação atual não libera criação, deploy, bootstrap ou ativação.

## Flags separadas

| Controle | Função |
| --- | --- |
| API `PUBLIC_CATALOG_WRITER_ENABLED` | Admitir novas mutações no protocolo durável. Não desligar o executor de operações já aceitas. |
| API `PUBLIC_CATALOG_READER_ENABLED` | Leitura pública via snapshot e canal de sinal. |
| Frontend `VITE_PUBLIC_CATALOG_WRITER_ENABLED` | Tratamento de recibos, status/retry e protocolo de imagens, independente do reader. |
| Frontend `VITE_PUBLIC_CATALOG_EVENTS_ENABLED` | Reader event-driven. Quando ligado, implica tratamento do writer no cliente. |

Ambas as flags frontend são false por padrão. Builds normais de produção, inclusive o modo de realtime privado, fixam ambas false e ignoram injeção do ambiente. Não existe neste checkpoint comando que autorize ativar catálogo em produção. Realtime privado de pedidos é outro controle e não deve ser desligado para medir economia fictícia de catálogo.

## Antes de qualquer implantação

1. PostgreSQL/journal/grants reais aprovados no banco isolado; não usar credencial remota como fallback. Cota indisponível não autoriza upgrade pago.
2. Prova de privacidade dos objetos R2, não apenas existência do binding: leitura remota em16/10 confirmou `r2.dev` público no bucket de imagens preview, desligado em production e zero custom domains em ambos. Compartilhar esse bucket com snapshots foi descartado; o usuário aprovou a separação acima em17/10. Criação/readback de `r2.dev` e custom domains dos novos buckets continuam pendentes no gate remoto, sem alterar os buckets de imagens. [Acesso público R2](https://developers.cloudflare.com/r2/buckets/public-buckets/) expõe os objetos do bucket, não apenas as imagens.
3. Inventário completo de writers e consumidores ativos usando protocolo compatível. CRUD/imagens, onboarding, canais, marca e rebuild incluídos.
4. Gate CPU8MiB com medição CPU suportada; teste funcional e tempo de parede não substituem esse gate. Preservar1000ms.
5. Qualidade/revisão final e deploy definitivo com migrações append-only. Os três aliases antigos de deploy da API e os três do frontend agora falham antes de chamar Wrangler, sem opção de bypass; os builds legados continuam só como regressão. No frontend isso impede publicar involuntariamente um cliente com writer legado após cutover. O novo `build:worker-catalog-production` da API valida a candidata e fixa dry-run, sem encaminhar argumentos que permitam desativá-lo. Checks offline disponíveis para ambas as candidatas. Publicação/readback/rollback de versão compatível continuam pendentes antes do cutover; o bloqueio não controla chamadas diretas ao provedor e não afeta os serviços já publicados.
6. Artefatos API/frontend pareados, IDs preview/production corretos e autorização operacional do gate. Secret/session nunca em chat, Git, argumento ou logs.

## Ordem pretendida após os gates

### Bootstrap local preparado — não executar apply neste checkpoint

No repositório API, `node --import tsx scripts/bootstrap-public-catalog.ts --environment preview --restaurant-id <UUID>` é dry-run por padrão: zero leitura de sessão, zero HTTP e zero escrita. Aceita um restaurante por execução; outros donos exigem sessões/execuções separadas. Slug, URL arbitrária, ambiente ausente e argumentos duplicados são rejeitados antes de qualquer requisição.

`--apply` exige também `--operation-id <UUID preservado>`, `--confirm-project-id dawn-morning-27332079`, `--confirm-branch-id br-rough-dew-b6ydeygb` no preview (production usa `br-odd-term-b6j2n9ms`), `--confirm-writer-coverage` e `--confirm-readiness`. As confirmações são **reconhecimento explícito do operador**, não prova automática de que o banco, CPU, privacidade, revisão ou readback passaram. Não fornecê-las até haver evidência real e autorização do gate; o script não altera flags nem contrata/provisiona recursos.

A sessão do dono chega somente em memória/entrada padrão protegida, JSON com uma única propriedade `cookie`, sem eco, arquivo, variável de ambiente, argumento de processo ou chat. Não usar receitas de shell que gravem a sessão no histórico/log. O CLI não abre login nem obtém API key. Entrada até8KiB, cookie até4KiB sem caracteres de controle; respostas até64KiB e requests com deadline15s/redirect proibido.

Após confirmar o dono em `GET /restaurants/me`, envia uma única chamada autenticada `POST /restaurants/me/catalog/rebuild`, protocolo1/body{} e a chave preservada. Só retorna ambiente/contagens e recibo estrito do mesmo restaurante/operação; ignora resultado privado. `postRequests:1` significa chamada feita, não gravação SQL: `accepted`, `committed`, `ready` e `blocked` continuam distintos. Resposta perdida/erro após POST resulta em confirmação pendente com a chave, sem retry/polling automático. Investigar manualmente antes de qualquer repetição explícita. Nunca trocar a chave para escapar de uma resposta incerta.

Teste `npm run test:catalog-bootstrap` usa transporte sintético e CLI real apenas em dry-run/entrada inválida. Não prova deduplicação PostgreSQL ou bootstrap remoto. Implementado localmente; implantação/execução real pendentes. Os gates abaixo continuam obrigatórios.

Preview existente: schema/grants → API com flagsfalse e readback → bootstrap explícito autenticado para alvos aprovados → writer com recuperação provada → reader/frontend canário. Production reutiliza código/testes, mas tem recursos/credenciais próprios; repetir os gates, não reimplementar as funcionalidades. Sem main/DNS/StripeLive/aposentadoria por inferência.

Medir SQL por publicação/visita, operações R2/DO/Workers, pendências, erros e alarmes vazios. Meta de navegação estável sem GET de catálogo não significa zero requests nem fatura zero. Orçamento confortável US$10–15 e capacidade pessoal US$20 não são teto técnico do provedor.

## Rollback

Desligar o reader do frontend mantendo **writer=true** enquanto o servidor usa o protocolo ou houver ações aceitas. Manter API writer/executor/namespace/schema/journal para drenar operações aceitas, com verificação manual autenticada; nunca reverter publicação já gravada para “falhou” por erro de leitura.

O legado de leitura volta explicitamente, incluindo seu intervalo antigo; não confundir rollback com a meta final de economia. Nenhuma versão já aceita pode ficar sem executor, nem usar limpeza de imagem legada enquanto o writer versionado estiver ativo. Só retornar todos os writers ao legado após drenagem e gate de compatibilidade próprios. Não apagar namespace, schema, journal ou bucket.

Testes locais cobrem readerfalse/writertrue no hook e em todas as operações da tela de cardápio, incluindo imagens e status. Em17/10, testes do operador também confirmaram os seis aliases antigos bloqueados e argumentos de override recusados antes de iniciar Wrangler;51 guards/operador API e18 guards frontend aprovados. Não provam rollback remoto, privacidade ou publicação segura de uma versão anterior. Esses itens permanecem gates, não passos implicitamente aprovados.

Preview exige cuidado adicional: o comando `wrangler preview` desta versão não oferece dry-run e exige autenticação. O check local do bloco `previews` não equivale a um deploy/readback do Preview nomeado. Não usar o dry-run top-level como prova de que seus bindings foram aplicados; não criar ou publicar recursos para contornar essa ausência de prova.
