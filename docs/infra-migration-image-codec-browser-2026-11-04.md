# Conversão de imagens — prova nativa no Brave,04/11/2026

Continuação das tarefas5/9 do [plano de catálogo](infra-migration-public-catalog-event-driven-plan.md). O teste anterior comprovou proteção/retirada da logo no R2; esta prova fecha a lacuna de codec nativo, sem repetir aquele canário, obter chave ou acessar a nuvem.

## Resultado observado

O usuário abriu a página loopback no próprio Brave e acionou uma vez a validação. O controlador recebeu **7/7**, exit0. O código real `src/lib/menu-image-optimization.ts` foi transpilado em memória com o TypeScript já instalado, sem trocar o decoder, `Image`, Canvas ou encoder por mocks. As imagens são geradas sinteticamente no navegador. O teste lê dimensões/pixels do resultado, verifica transparência e acompanha a liberação dos object URLs, preservando suas funções nativas.

| Fonte sintética | Entrada | Saída WebP | Dimensões finais | Resultado |
| --- | ---: | ---: | --- | --- |
| JPG com ruído e referência de cor | 2.266.669bytes | 281.994bytes | 1200×800 | 87,56% menor |
| PNG transparente300×150 | 1.623bytes | 918bytes | 300×150 | Alpha preservado; conteúdo não ficou em branco |
| WebP pequeno | 1.276bytes | 1.352bytes | 640×480 | Sem ampliação das dimensões; reprocessamento cresceu76bytes |

As três saídas ficaram abaixo de1MiB. SVG, entrada maior que5MiB, PNG corrompido e arquivo vazio foram recusados. Object URLs foram liberados em todos os casos. A meta300KiB e o teto1MiB não significam que todo arquivo ficará menor: o WebP já pequeno demonstra essa ressalva. Não foi alterado o algoritmo para economizar76bytes de um exemplo sintético.

Fonte verificada antes/depois: SHA256 `ca3de76aa19616a2973528ac29f202aa4bb153b00b01ea72e3e3aa1cfe65b83f`; harness de casos `b6617a0fd74730a633fe6336abba9371e8af885ac9466dd7a54b8ee8489b92dc`. Evidência agregada `image-codec-browser-result-2026-11-04.json` na pasta ignorada deste plano, sessão5070. Porta62731 fechada após o resultado, confirmado porECONNREFUSED. Sem screenshot automatizado, pois o controle do Brave continuava indisponível; confirmação humana e métricas recebidas pelo listener local estão explicitamente separadas de observação visual automatizada.

## Reprodução e limites

Executar `node scripts/menu-image-browser-verification.mjs run`, abrir a URL exibida no Brave e clicar uma vez em **Validar compressão**. Não selecionar arquivos pessoais. O servidor aceita somente loopback, rotas fixas, Origin/Host/nonce, corpo até4KiB e um resultado ligado ao hash da fonte. CSP impede conexões externas. Não serve arquivos arbitrários, não recebe imagens/chaves e encerra em até10min. Duas entregas concorrentes não podem produzir dois resultados aceitos.

Os seis testes do servidor primeiro falharam por implementação ausente e por concorrência real204/204; passaram após implementar os guards e a conferência final de admissão. Eles validam transporte/relatório, **não simulam uma prova de codec**. A execução real no Brave descrita acima é a evidência do encoder.

Regressão final: frontend383/383 em74arquivos; servidor6/6; guards de deploy18/18; typecheck app+node, build e sintaxe dos scripts exit0. Lint exit0/zero erros e um aviso existente em `TableSessionModal.tsx:86`, dependência`session`. Logs `image-codec-*2026-11-04.log` na pasta do plano. Nenhum `src`, configuração, schema, dependência ou código da API foi alterado. Os quatro documentos previamente modificados e as referências do usuário permanecem intactos.

Esta prova não certifica outros navegadores, todo arquivo possível, o seletor de arquivos da UI publicada, um inventário físico100MiB no R2, a cota agregada no provedor ou CPU Workers1000ms. Fallback sem encoder WebP continua coberto pelos testes unitários, não foi o caminho observado no Brave. A prova de imagens de produto e sua exclusão versionada, CPU, reader/bootstrap e integração final continuam nos respectivos gates. Formal7/10 e Etapa13 permanecem abertos; nenhum deploy, flag, recurso pago, chave, upload remoto, push ou main foi executado.
