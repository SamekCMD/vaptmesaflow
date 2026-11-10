# Catálogo ao vivo: prova composta local — 10/11/2026

O cardápio renderizado mudou após receber um evento do Worker local, sem recarregar a página. Foram duas leituras HTTP 200 do catálogo: uma inicial e uma após a alteração. Dois minutos simulados de página ociosa, com dois heartbeats respondidos pelo socket real, não acrescentaram GETs.

- Página `PublicMenu`, hook, registro e cliente reais do frontend, com flag de eventos ligada apenas no teste; DOM em jsdom, não no Brave nem no bundle publicado.
- Worker `vapt-catalog-test` no workerd em loopback, DO/SQLite e projeção R2 locais. O socket negociou uma única resposta HTTP 101 com o protocolo `vapt.catalog.v1`.
- A projeção inicial tinha a revisão `12`. Uma segunda publicação pela fixture local trocou o nome de um item e emitiu exatamente um `catalog_changed`, preservando a revisão `9007199254740993` como string. A página exibiu o nome novo e removeu o anterior.
- O caminho público não construiu serviços de autenticação/SQL e a fixture não tem Hyperdrive. O processo de teste saiu com código 0 após fechar conexões. A publicação de teste não passa por uma edição autenticada nem pelo journal PostgreSQL; essa composição não prova o writer nem entrega de eventos em produção.

## Evidência e reprodução

1/1 na prova composta e 34/34 em cinco suítes existentes de catálogo público. Avisos preexistentes de React Router, sem falhas finais. As falhas intermediárias foram do ambiente de teste: tipos nativos do esbuild e AbortSignal de jsdom, e transformação de caminho pelo Vite. Wrangler foi isolado em processo Node; HTTP ficou em loopback com cancelamento encaminhado por evento. Nenhum código de produto foi alterado.

No workspace local ignorado do plano: `catalog-live-ui-local.config.ts`, `catalog-live-ui-local.test.tsx`, `catalog-live-ui-worker.mjs` e logs `catalog-live-ui-local-verified-2026-11-10.log` / `catalog-live-ui-regression-2026-11-10.log`. Com as dependências já instaladas e o checkout da API existente, executar da raiz:

```powershell
$p = '.superpowers/sdd/infra-migration-public-catalog-event-driven-plan'
node node_modules/vitest/vitest.mjs run --config "$p/catalog-live-ui-local.config.ts" catalog-live-ui-local.test.tsx
```

Sem chamadas remotas, credenciais, cadastro, dados de produção, deploy, custo adicional de provedor ou alteração em `main`. A próxima observação positiva em produção precisa de um catálogo existente ou de um teste sintético com janela e limpeza próprios. Não repetir o deploy nem inferir economia a partir deste teste local.
