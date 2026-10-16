# Catálogo por eventos — ativação e rollback

Estado em16/10/2026: telas integradas e testadas localmente; implantação **pendente**, nenhuma flag ativada. Código salvo em branches de infraestrutura, não na main. Referências: [plano aprovado](infra-migration-public-catalog-event-driven-plan.md), [writers](infra-migration-public-catalog-writers.md), [consolidação](infra-migration-branch-integration.md). Prova API: `docs/public-catalog-runtime-verification.md` no repositório `vapt-api`.

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
2. Prova de privacidade dos objetos R2, não apenas existência do binding: leitura remota em16/10 confirmou `r2.dev` público no bucket preview, desligado em production e zero custom domains em ambos. **O desenho de bucket compartilhado está bloqueado no preview.** Solicitado ajuste para buckets privados de snapshots separados por ambiente; aguardar aprovação, sem quebrar imagens nem criar recursos por inferência. [Acesso público R2](https://developers.cloudflare.com/r2/buckets/public-buckets/) expõe os objetos do bucket, não apenas as imagens.
3. Inventário completo de writers e consumidores ativos usando protocolo compatível. CRUD/imagens, onboarding, canais, marca e rebuild incluídos.
4. Gate CPU8MiB com medição CPU suportada; teste funcional e tempo de parede não substituem esse gate. Preservar1000ms.
5. Qualidade/revisão final e deploy definitivo com migrações append-only. Os scripts/configs legados não podem substituir os novos bindings após registro da classe; falta concluir esse gate antes do cutover.
6. Artefatos API/frontend pareados, IDs preview/production corretos e autorização operacional do gate. Secret/session nunca em chat, Git, argumento ou logs.

## Ordem pretendida após os gates

Preview existente: schema/grants → API com flagsfalse e readback → bootstrap explícito autenticado para alvos aprovados → writer com recuperação provada → reader/frontend canário. Production reutiliza código/testes, mas tem recursos/credenciais próprios; repetir os gates, não reimplementar as funcionalidades. Sem main/DNS/StripeLive/aposentadoria por inferência.

Medir SQL por publicação/visita, operações R2/DO/Workers, pendências, erros e alarmes vazios. Meta de navegação estável sem GET de catálogo não significa zero requests nem fatura zero. Orçamento confortável US$10–15 e capacidade pessoal US$20 não são teto técnico do provedor.

## Rollback

Desligar o reader do frontend mantendo **writer=true** enquanto o servidor usa o protocolo ou houver ações aceitas. Manter API writer/executor/namespace/schema/journal para drenar operações aceitas, com verificação manual autenticada; nunca reverter publicação já gravada para “falhou” por erro de leitura.

O legado de leitura volta explicitamente, incluindo seu intervalo antigo; não confundir rollback com a meta final de economia. Nenhuma versão já aceita pode ficar sem executor, nem usar limpeza de imagem legada enquanto o writer versionado estiver ativo. Só retornar todos os writers ao legado após drenagem e gate de compatibilidade próprios. Não apagar namespace, schema, journal ou bucket.

Testes locais cobrem readerfalse/writertrue no hook e em todas as operações da tela de cardápio, incluindo imagens e status. Não provam rollback remoto, privacidade nem que um comando antigo de deploy preserve o namespace novo. Esses itens permanecem gates, não passos implicitamente aprovados.
