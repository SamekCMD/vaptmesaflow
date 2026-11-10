# Etapa 13 — diagnóstico de cota de compute, 14/10/2026

## Mitigação aprovada e aplicada — 14/10/2026

Após aprovação explícita, os dois Cron passaram de `* * * * *` para `*/30 * * * *`: oportunidade de despacho nos minutos00/30 de cada hora UTC,48 por dia em vez de1440. Control-plane PUT somente em schedules, sem redeploy: readback confirmou preview `e27200db-8db8-4a44-9876-a2f0df9b899d` e production `1f578bc6-586a-46ca-b180-0301057b2cc8` preservados, assim como settings/bindings/secrets por nome, ingresso e consumers/retries/DLQ. Dois testes RED1440vs48→GREEN, suíte billing47pass/2DBskips, typecheck e dois dry-runs passaram. Nenhuma consulta ao banco, email ou replay solicitado por essa alteração. A propagação de Cron na rede é assíncrona; não foi certificado despacho real saudável, porque a cota Neon continua esgotada.

O intervalo afeta também o reaper e a republicação da outbox. Backoff e limites de lease/attempt/idempotência do código não foram alterados. Com o batch existente20, backlog pode levar vários intervalos:30min é a frequência, não SLA de entrega para qualquer volume. Mitigação adequada ao produto em desenvolvimento; retomada de latência/capacidade real exige gate separado.

Neon Launch **não ativado**. Usuário perguntou recomendação por consumo, não autorizou contratação. [Preço atual](https://neon.com/pricing):US$0,106/CU-h, sem mensalidade mínima; quotas Free não acompanham o upgrade, compute/storage passam a ser cobrados por uso. Exemplo de regime ocioso, não medição ou teto: dois endpoints0,25CU, cinco minutos ativos a cada30min,30dias→60CU-h→US$6,36 de compute Neon. Somando somente a base WorkersUS$5,US$11,36; storage/history, tráfego útil, autoscaling e excedentes Cloudflare não estão incluídos. Sem redução do polling, ambos sempre ativos0,25CU por30dias→360CU-h→US$38,16 somente compute Neon. Manter scale-to-zero e revisar sizing/limites antes de qualquer upgrade; alertas não equivalem a um bloqueio rígido de fatura.

Recomendação condicionada: Launch é útil para recuperar acesso e continuar testes sem aguardar o próximo ciclo, **se esse custo extra for aceitável**. Se orçamento prioritário for não adicionar custo de banco, manter Free e aguardar a renovação. A mudança de Cron não devolve a cota consumida, nem autoriza Paid/ZeroTrust/StripeLive/retirada do servidor.

## Resultado atual

O projeto Neon `vapt` (`dawn-morning-27332079`) está no Free e exibe `Limit reached`: a franquia mensal de compute foi consumida. Isso bloqueia os gates que precisam do banco; não significa defeito de credenciais, perda de dados ou reprovação retroativa dos testes anteriores.

Leitura nova da API do Neon: `compute_time_seconds=413311`, `active_time_seconds=1623528`, `owner.subscription_type=free_v3`. Ciclo `2026-10-01T00:00:00Z` a `2026-11-01T00:00:00Z`. O primeiro contador é ponderado por tamanho e corresponde a **114,81 CU-h**, não a horas corridas; o segundo soma tempo ativo dos endpoints. A página aberta inicialmente mostrava57,16 CU-h, valor não adotado como consumo atual diante do GET novo. Não interpretar a ausência de `quota` no JSON como cota zero.

A [documentação atual do Free](https://neon.com/docs/introduction/plans) inclui100 CU-h por projeto/mês, somando os computes de todas as branches. Esgotar compute suspende o acesso até o próximo ciclo ou upgrade; não apaga os dados. [Conversão dos campos da API](https://neon.com/docs/introduction/usage-calculations). A renovação indicada pelo projeto é1Nov00UTC (31Oct21h America/Sao_Paulo); não foi executado upgrade/reset/recriação de projeto.

## Evidências independentes de Cloudflare

Uma query GraphQL, janela UTC13Oct16:42:21.632→14Oct16:42:21.631, com agrupamento por Worker/outcome, sem payloads:

| Worker | Invocações | Erros de invocação |
| --- | ---: | ---: |
| vapt-api-production |18|0|
| vapt-billing-email-production |1319|1319|
| vapt-billing-email-preview |1320|1320|

Todos os erros de billing eram `scriptThrewException`; limite20grupos não atingido. Isso não prova status HTTP nem saúde SQL da API, pois18invocações podem não consultar banco. Os outros dois nomes consultados, frontend e paralelo, não tinham linhas de invocação; assets não precisam invocar o Worker.

Leitura temporária de **uma execução natural do Cron por ambiente**, sem disparo sintético: ambos `outcome=exception`, uma exceção `Error` cujo texto classificou como limite/cota. Autenticação, banco/relação ausente, permissão, timeout, transporte, métodoquery e configuração não classificaram. Texto original, stack, logs e credenciais não foram impressos nem salvos. As duas sessões próprias de live-tail foram removidas, DELETE confirmado, e o operador encerrouexit0.

Pré/pós control-plane idênticos: production `1f578bc6-586a-46ca-b180-0301057b2cc8`, preview `e27200db-8db8-4a44-9876-a2f0df9b899d`,100% cada; um Cron `* * * * *` por ambiente; mesmas Queues e dois secrets verificados somente por nome; workers.dev/PreviewURLs desligados, coleção persistente desligada. Nenhuma implantação, troca de secret, retry manual, email ou pagamento solicitado.

## Mecanismo de consumo anterior e recuperação pendente

O handler cria o repository Neon e executa `reapExpired` e `reserveDispatch` mesmo sem emails pendentes. Antes da mitigação, fazia isso a cada minuto em preview e production. O [Neon Free suspende após cinco minutos sem atividade](https://neon.com/docs/introduction/scale-to-zero); aquele polling impedia o intervalo ocioso necessário enquanto o banco estava acessível.

Isso identifica um mecanismo recorrente de consumo, **não uma atribuição quantitativa de todo consumo histórico ao Cron**. Testes, aplicação, autoscaling e outros clientes também podem consumir compute. A estimativa de dois computes0,25CU sempre ativos por30dias é360CU-h, já acima da franquia100, sem tráfego útil. Não é uma projeção medida de fatura nem prova de utilização máxima.

O usuário aprovou a frequência30min e a mitigação foi aplicada conforme o registro inicial. Apenas espaçar Cron não devolve a cota já consumida. Não desabilitar consumers/Cron, enviar mensagens/replay, remover outbox, restaurar banco, criar projeto substituto ou contratar Neon Paid por inferência. Próximo ciclo/decisão externa de capacidade é necessário para repetir gates SQL reais; trabalho local e testes sintéticos sem banco podem avançar separadamente.

Observabilidade da API ainda tem apenas preparação local/CI aprovado. Sonda de metadata não foi criada: permissão ObservabilityWrite recusada403/10000 antes de provisionar. Esse bloqueio é independente da cota Neon. Sem main/DNS/aposentadoria da Hetzner/StripeLive/ZeroTrustproduction.
