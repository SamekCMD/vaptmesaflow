# Catálogo publicado e atualização ao vivo

## Observação de 10/11/2026

O usuário criou um restaurante e um item pelo produto e forneceu o cardápio público `https://vapt.app.br/menu/hamburger?mesa=1`. A validação usou o Brave já instalado, em execução headless com perfil temporário próprio, carregando o frontend publicado. A edição foi feita pelo usuário no painel.

| Verificação | Resultado observado |
| --- | --- |
| Estado inicial | Revisão string `18`, item “X-Burger” visível |
| Primeira conexão WebSocket | HTTP 101 e mensagem `ready` |
| Ociosidade inicial | 65 segundos, zero GETs adicionais do catálogo e um pong |
| Edição única informada pelo usuário | Nome alterado para “Hambúrguer Teste Ao Vivo” |
| Leituras da página durante toda a observação | Dois GETs de `catalog-state`, ambos HTTP 200, revisões `18` e `19` |
| WebSocket durante toda a observação | Duas conexões HTTP 101 e mensagens `ready`, `ready`, `catalog_changed` |
| Documento principal | Um carregamento |
| DOM inspecionado após a edição | Nome novo presente, nome antigo ausente, página visível e carregamento completo |

A inspeção do DOM ocorreu na mesma página de teste, via uma segunda conexão local de diagnóstico. Ela confirmou duas leituras do catálogo no Resource Timing. Uma consulta pública independente também retornou HTTP 200, revisão `19`, um item com o nome novo, zero itens com o nome antigo e `Cache-Control: no-store`. Essa consulta adicional pertence ao diagnóstico e não está incluída nos dois GETs da página.

## Limitação do verificador

O verificador original encerrou com código 1, `stage=live_edit` e `reason=deadline`. Sua condição exigia que o evento chegasse na conexão WebSocket original. Houve uma reconexão antes do evento, e a condição desconsiderou o `catalog_changed` recebido na segunda conexão.

O resultado formal permanece reprovado. A observação de produção demonstra entrega de evento, atualização visual e ausência de leituras recorrentes nesse recorte, incluindo recuperação de conexão. O registro não transforma o verificador em aprovado nem certifica entrega sem reconexão.

## Encerramento e alcance

O processo de observação terminou e o perfil temporário foi removido, com ausência conferida no filesystem. A edição do item foi feita pelo usuário. A observação não usou sessão autenticada, chave R2 ou consulta direta ao Neon.

A atribuição de SQL e a economia financeira por fluxo continuam pendentes. Estes resultados avançam a prova positiva do catálogo, com a ressalva do verificador, e não encerram automaticamente as tarefas formais 5, 9 e 10, a estabilidade ou a aposentadoria da infraestrutura anterior.

## Correção do verificador e contagem por leitura

O verificador local agora reconhece `catalog_changed` após uma reconexão que recebeu HTTP 101 e `ready` no socket do mesmo restaurante. A leitura seguinte é correlacionada pela revisão e pelo item, pois o navegador pode registrar os eventos de rede em ordem diferente da entrega à aplicação. O verificador ainda exige dois GETs com HTTP 200, um carregamento do documento e a troca do nome no DOM.

A regressão local reproduziu duas falhas com a condição antiga. Os seis casos passaram após a correção, incluindo a entrega antes de um fechamento posterior e a rejeição de socket de outro restaurante, conexão sem upgrade ou sem `ready` e revisão antiga. A verificação de sintaxe também passou. O verificador e os testes ficam no workspace local do plano em `catalog-live-browser-observer.mjs` e `catalog-live-browser-events.test.mjs`. A edição de produção não foi repetida, e o resultado original do verificador permanece registrado acima.

Um ensaio isolado executou as rotas reais do Worker a partir do build local, com chamadas SQL e R2 contadas por adaptadores em memória. Ambas retornaram HTTP 200 para o mesmo catálogo.

| Caminho | Chamadas SQL | Leituras R2 |
| --- | ---: | ---: |
| Leitura legada com o reader desligado | 2 | 0 |
| Leitura de `catalog-state` com reader e writer ligados | 0 | 3 |

O caminho legado lê o restaurante e seus itens com variações. O novo caminho lê o mapeamento do slug, o manifesto e o snapshot no R2, sem inicializar os serviços do banco. A comparação vale para uma leitura pública bem-sucedida. A escrita no painel segue outro caminho.

## Agregados da janela de produção

Uma consulta às métricas da Cloudflare às 18:54:50 de Brasília retornou HTTP 200 e zero erros GraphQL. Os dois recortes têm seis minutos e o minuto final fica fora do intervalo.

| Métrica | 18:38–18:44 | 18:44–18:50 |
| --- | ---: | ---: |
| Invocações da versão publicada da API | 62 | 35 |
| Invocações no namespace do catálogo | 11 | 13 |
| Operações no bucket privado do catálogo | 62 | 50 |
| Consultas concluídas no Hyperdrive de produção | 207 | 95 |

O segundo recorte contém a abertura, a edição e a atualização do cardápio. As duas janelas também contêm outros fluxos da API. O Hyperdrive agrega por configuração, então a diferença entre 207 e 95 não quantifica o efeito da mudança no catálogo. A consulta histórica não gerou tráfego de aplicação nem abriu conexão direta ao Neon. [Métricas do Hyperdrive](https://developers.cloudflare.com/hyperdrive/observability/metrics/)
