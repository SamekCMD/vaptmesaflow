# Catálogo: canário privado de leitura concluído — 24/10/2026

Quatro GETs sintéticos passaram no preview real, com conteúdo integral, `Cache-Control: no-store` e **CPU máxima observada de245,860ms**. O limite configurado permaneceu1000ms. Ambas as flags foram fechadas e a limpeza foi confirmada por um processo independente. Nenhuma produção, conta de aplicação ou dado Neon foi alterado.

## Escopo e resultado

O usuário aprovou explicitamente ambas as flags temporárias no preview privado, após corrigirmos a proposta reader-only: a proteção de consistência existente rejeita reader=true/writer=false. Essa proteção foi mantida. A janela fez apenas leituras de API; não houve login/cadastro de aplicação, rebuild, upload, pagamento ou email.

| Estado | Implantação do Preview `stage11-inert` / `vapt-api-parallel` | Flags reader/writer |
| --- | --- | --- |
| Baseline34 | `55463f0b-4582-46ea-b2c5-475864e3d001` | false/false |
| Janela35 | `64e88a89-7904-4568-a2f0-daa4f63f51c1` | true/true |
| Fechado36 | `97af4604-7bc0-4dba-b867-a757d28d6ee0` | false/false |

Somente env foi alterado: renovação write-only do bearer e flags. Mesmo código, migração SQLite/executor, namespaces, bindings, demais secrets, rates, CPU1000 e logs/observability desativados. Access existente permaneceu exigido. Bucket de catálogo privado conferido antes de gravar, durante a janela e independentemente depois. Nenhum recurso pago ou plano foi criado; o uso continua sujeito à cobrança já contratada.

Dois snapshots R2 de8MiB, sob UUIDs/slugs sintéticos exclusivos e inicialmente ausentes:

| Formato | Restaurante sintético | Itens | Variações / opções |
| --- | --- | ---: | --- |
| Muitos itens simples | `9f729021-7cf8-40ac-afdb-8d891f64f5e1` |21.674 |0 /0 |
| Muitas variações | `35028069-c7b5-401b-9304-ffba619b014d` |1.060 |21.200 /1.060.000 |

Para cada formato, um GET em `/public/restaurants/reader-<uuid>/catalog-state` retornou200/exatos8.388.608bytes, e um GET em `/catalog` retornou200/8.388.581bytes. O controlador comparou objetos completos, inclusive campos aninhados, não somente tamanho/hash. A ordem das propriedades JSON da variação foi normalizada pelo validador existente; isso altera o hash textual sem alterar o conteúdo semântico.

Não houve repetição de GET, POST, seed SQL, query/migration/backup Neon, nova role, secret de provedor novo, alteração DNS/main/push ou upload do entry local `/_test/*`. Estes restaurantes existem **apenas nos objetos sintéticos R2 do ensaio**, não no banco. O caminho de leitura real usa a projeção R2; não foi instrumentado um contador remoto SQL neste canário. A prova local anterior demonstrou que esse caminho não compõe serviços SQL/auth e não possui Hyperdrive na fixture.

## CPU remoto, sem extrapolação financeira

GraphQL `workersInvocationsAdaptive`, filtrado por `scriptName=vapt-api-parallel`, `isPreview=1`, `previewSlug=stage11-inert`, versão35 exata e janela UTC **17:07:39.255–17:08:32.581** (14:07–14:08 São Paulo):

- Uma série `status=success`, **4requests,0errors,sampleInterval1**.
- `max.cpuTime=245860`µs = **245,860ms**; não é tempo de parede nem quantil tratado como máximo.
- A série agrega os quatro GETs; não atribuir o máximo a um formato/rota específico.

`readerCasePassed:true` somente para este workload. Não representa máximo futuro, carga concorrente, CPU da publicação estruturada com applier PostgreSQL, WebSocket/browser, ativação global ou teto de fatura. `fullCpuGatePassed:false` e `activationReady:false` permanecem explícitos. A publicação sintética anterior é [evidência separada](infra-migration-catalog-preview-canary-2026-10-24.md), não foi repetida.

## Fechamento, limpeza e controles

Controlador run`07a61a7b-ce1b-4960-a720-bc3185886ed2`, sessão36869, exit0. Após as quatro leituras, uma única operação fechou ambas as flags na implantação36. Executor/accepted/migração preservados. Os seis objetos conhecidos foram substituídos por fences verificadas, total **530bytes**: cada snapshot31, manifesto85 e mapping tombstone149bytes. Nenhum DELETE/listagem ampla ou gravação no bucket de imagens. Isso não afirma que o bucket inteiro está vazio; fences anteriores pertencem a outros gates.

Operações do **controlador**:30GET e12PUT R2, incluindo preparação/readbacks/retirement. Esses números não contam acessos R2 nativos realizados pelo Worker. O processo independente realizou mais seis GETs dos fences e verificou seus hashes/tamanhos, privacidade e Preview36/CPU1000/flagsfalse. Não repetiu o workload.

Controles independentes preservados:

- APIproduction:deployment`68828632-0b50-4c80-b6d1-2c43a6736760`,version`914f79f0-b679-45a2-a0c0-069acd87aa23`.
- Web:deployment`24d1b0fc-dda0-4789-a426-4146c9cad04d`,version`e77339dd-59ea-44dd-a790-660076570810`.
- APIparallel de topo:deployment`29cbfb3b-7a76-448e-a984-aeb80fc5bde9`,version`ce6f3919-1d9e-4b43-8914-865d7597619c`.

Readback independente sessão29710, exit0, `ok:true`, seis fences/530bytes/três controles. Credenciais Access/bearer/provedor permaneceram em RAM e foram descartadas pelo controlador; o cache nativo temporário de Access1h é a exceção já aceita. O secret write-only renovado permanece no preview; não foi lido de volta nem alegado revogado. Nenhuma credencial em novos arquivos, Git, argv, env ou saída de sessão.

## Evidência reproduzível, sem replay

Checkpoint API`2a700ef`:20 testes da janela e6 do probe novos RED→GREEN, teste de identidade isolada RED→GREEN. Finais locais298/298 operadores,704/704 API,9/9 workerd, zero falhas/skips; type/syntax0. Dois avisos de linha vazia no fim dos arquivos novos foram corrigidos antes do commit; não alteraram comportamento nem causaram nova execução do controlador.

Scratch próprio do plano: `catalog-reader-controller-2026-10-24.mjs`, marcador exclusivo `catalog-reader-approved-2026-10-24-start.json`, resultado e readback abaixo, `catalog-reader-analysis-2026-10-24.mjs`. Asserções frescas da análise: exit0, quatro requests atribuídas/CPU/limpeza independente/fechamento36 corretos. **Não apagar marcador, repinar/reiniciar o controlador ou repetir canários encerrados.** O novo operador exige baseline34 e rejeita o atual36.

- Resultado SHA256:`444234aa2a8aee0e487258afa37aff97767e96e03880755450bb726b1b9801f6`.
- Readback independente SHA256:`9de0c74a5917497c7e0142ef6e5c7eb47f22d2b253675ea04f3108ca2895ea16`.

Próximos gates: cobertura/integração dos writers e bootstrap/ativação com escopo próprio, readiness de produção e integração ordenada das branches. Nada neste ensaio autoriza ligar reader de produção, publicar frontend/main ou desligar servidor. Catálogo formal7/10 e Etapa13 permanecem abertos; este canário limitado está encerrado e não deve ser repetido.
