# Catálogo: fronteira estruturada de 8 MiB — 24/10/2026

Atualização posterior: o [canário privado de leitura remoto foi concluído](infra-migration-catalog-reader-canary-2026-10-24.md), com quatroGET200/maxCPU245,860ms e fechamento36/limpeza independente. As propostas de próximo gate abaixo são históricas; não repetí-lo nem interpretar este relatório local como autorização atual.

Publicação e leitura passaram no **workerd local** para dois snapshots de exatamente 8.388.608 bytes. Nenhum código de produto foi alterado: foram acrescentados gerador de dados sintéticos e testes, importados somente por testes locais.

| Formato | Itens | Variações | Opções | Publicação / duas rotas de leitura |
| --- | ---: | ---: | ---: | --- |
| Muitos itens simples | 21.674 | 0 | 0 | 200 / 200 / 200 |
| Muitas variações | 1.060 | 21.200 | 1.060.000 | 200 / 200 / 200 |

Cada item respeita o schema HTTP de criação existente: descrição até 1.000 caracteres, no máximo 20 variações e 50 opções por variação, identidades UUID únicas. O restaurante não recebe descrição gigante para completar o payload. São casos sintéticos de fronteira, **não previsão de quantidade de clientes, uso normal ou custo por assinatura**.

As duas rotas reais `/public/restaurants/bistro/catalog-state` e `/public/restaurants/bistro/catalog` preservaram integralmente os campos aninhados. A primeira manteve exatamente 8 MiB e `Cache-Control: no-store`. A fixture confirmou zero construções de serviços SQL/auth, ausência de Hyperdrive e nenhum objeto no bucket de imagens. A publicação usa projeção R2 e sinalização reais locais, mas **não usa o applier/journal PostgreSQL**.

## Verificação

No worktree API, com Node 24.13.0 e dependências já instaladas:

- `node --import tsx --test --test-isolation=none src/worker/catalog-structured.test.ts`: dois testes passaram, após RED observado com gerador ainda ausente.
- `node node_modules/tsx/dist/cli.mjs --test src/worker/catalog.workerd.ts`: **9/9**, zero falhas/skips; inclui os dois novos casos e regressões de sockets, recuperação e limites.
- `node node_modules/tsx/dist/cli.mjs --test 'src/**/*.test.ts'`: **703/703**, zero falhas/skips.
- `node node_modules/typescript/bin/tsc -p tsconfig.json`: exit 0.
- `git diff --check`: exit 0; aviso local de conversão LF/CRLF, sem erro de whitespace.
- Wrangler 4.138.0 `deploy --dry-run --config wrangler.worker-catalog-test.jsonc --outdir <scratch>/catalog-structured-bundle-2026-10-24`: exit 0, **sem implantação**.

A primeira tentativa dos testes foi impedida pelo sandbox ao iniciar o transpilador (`spawn EPERM`); a execução local autorizada mostrou o RED esperado e depois GREEN. A primeira comparação do teste workerd exigia ordem textual de propriedades JSON: o Zod reordena `options`/`required`, sem perder conteúdo. Corrigido o teste para comparar objetos e tamanho, sem alteração do produto.

## Perfis V8 locais

Capturado o isolate de usuário `core:user:vapt-catalog-structured-local` em Miniflare 5.20260921.1-alpha / workerd 1.20260921.1, com HTTP/inspector em loopback, buckets e SQLite efêmeros, fetch externo recusado e nenhuma credencial remota. O processo terminou exit 0 e executou `mf.dispose()` no `finally`.

| Captura | Amostras | Duração da captura — **não CPU** |
| --- | ---: | ---: |
| Publicar itens simples | 90 | 446,551 ms |
| Ler itens simples | 60 | 212,478 ms |
| Publicar variações | 134 | 502,315 ms |
| Ler variações | 68 | 324,225 ms |

As capturas incluem idle/program/native, I/O e trabalho fora da invocação; não somar intervalos como CPU faturada. São execuções individuais, sem benchmark de carga, percentil ou limite local de CPU aplicado. A validação Zod e o coletor de lixo aparecem nos perfis, mas os dados não justificam remover validações ou afirmar um gargalo de produção.

Duas inicializações do profiler usando `scriptPath` falharam antes do workload (`ERR_RUNTIME_FAILURE`), com e sem loader tsx. O mesmo bundle carregou como módulo em memória pela API pública usada pelo profiler do Wrangler instalado. Isso isolou o problema no modo de carregamento local; a causa interna exata do runtime não foi determinada. O hash do bundle permaneceu igual ao diagnóstico anterior: `55bb64789c3fb3abd94185ef5742d1e7fe02ed65c4322832f90d4a553e18f1b4`. Nenhum retry remoto ocorreu.

Artefatos sob o scratch ignorado **deste plano**: `catalog-structured-profile-2026-10-24.mjs`, `catalog-structured-profile-result-2026-10-24.json`, quatro `catalog-structured-*-2026-10-24.cpuprofile`, bundle e logs. O driver usa suporte TypeScript nativo do Node 24; executar com `node <scratch>/catalog-structured-profile-2026-10-24.mjs` a partir do worktree API, depois do dry-run acima.

SHA256 do relatório JSON: `506ecb288c2ef08b247d8afe16518973960fe6a44fbae3b5a68334eb0c0b021e`. Perfis: itens/publicação `74663ccca060866b96747e6fdb36d19cadfa85b3210f012a6f34271a57efa52a`; itens/leitura `afbe901848cfe2a1f6ab41fd1580d0e4af9083c1a965d7e5071d67a24177b256`; variações/publicação `a50fc5ef1061f43bca3cfcfca0ae4a78e83b76c85cbe4291ef67bead3521b589`; variações/leitura `f27d765f888874a557b4771aa8b0d40d1a7a8334a603b8f49ef523d72cde010d`.

## Gate que permanece aberto

Correção do próximo gate, após o pedido de continuação: o código existente `isCatalogReaderEnabled` exige **reader=true e writer=true**; reader=true/writer=false retorna503 (`catalog_configuration_invalid`). O teste local existente confirmou essa proteção. A proposta anterior de ligar somente a flag reader estava incorreta. Nenhum recurso remoto, bearer ou objeto foi alterado nesta tentativa. Não remover a proteção: para avançar sem publicar código, é necessária aprovação explícita de uma janela privada com ambas as flags, embora o controlador faça somente quatro GETs e nenhuma mutação de API/Neon. Fechar ambas ao final; produção continua fora do escopo.

`remoteCpuGatePassed:false` e `activationReady:false`. Este trabalho não ligou reader/writer remoto, não consultou Neon, não publicou código, não criou recurso pago, não mudou main/DNS e não repetiu o canário concluído. O último estado remoto verificado continua o [Preview 34 fechado](infra-migration-catalog-preview-canary-2026-10-24.md), sem novo readback nesta passagem.

A próxima prova é um **canário privado de leitura do preview**, com payload estruturado, CPU remoto atribuível, quantidade fixa de requisições e limpeza verificável. Exige escopo/autorização próprios; não reutilizar o marcador consumido da janela de publicação, recuperar bearer write-only ou publicar a fixture `/_test/*`. Produção permanece separada. Catálogo formalmente 7/10; T5/writers, T9/CPU amplo, T10/bootstrap/ativação e Etapa 13 continuam abertos.
