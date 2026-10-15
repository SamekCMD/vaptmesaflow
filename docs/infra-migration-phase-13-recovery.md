# Etapa 13 — recuperação SQL isolada

## Prova executada em 07/10/2026

Ensaio real no projeto Neon existente `vapt` (`dawn-morning-27332079`), organização Free, limite observado de dez branches e duas utilizadas antes/depois. Histórico configurado: 21.600 segundos (6 horas). Nenhum plano, limite, credencial, conexão de aplicação, Worker ou DNS alterado.

Production `br-odd-term-b6j2n9ms` foi usada **somente em transações READ ONLY**, antes e depois. A fotografia verificada continha 20 tabelas em `public`/`better_auth`, zero linhas, 273 constraints e 49 rotinas. Comparações incluíram colunas/defaults, constraints, índices, grants por tabela, definições/ACL das rotinas e overrides das roles API por banco. Somente hashes saíram do PostgreSQL, nunca conteúdos de contas/sessões/passwords.

Foram criadas duas branches normais descartáveis, com compute fixo de 0,25 CU:

1. Checkpoint `br-misty-mountain-b6k6d4nt`, filha de production. Estrutura/dados comparados com a fotografia original; recebeu apenas schema próprio de teste com duas linhas sintéticas.
2. Alvo `br-noisy-poetry-b6d0bzbp`, filha do checkpoint, inicialmente com essas linhas e a estrutura completa. Somente nela foram apagada uma linha, adulterado outro payload e executado DROP de `public.restaurants` com suas dependências. A perda foi observada antes da recuperação.
3. Conexões do alvo encerradas antes de `neon branches restore <alvo> ^parent`. Após reconectar, as duas linhas/payloads originais e `restaurants` reapareceram. Removido apenas o schema sintético do alvo, as comparações de estrutura/grants/rotinas/settings e dados coincidiram com a fotografia original. Janela observada de restauração, reconexão e verificação: 18.884 ms; não é SLA ou medição isolada do serviço.
4. Production novamente comparada sem diferenças. Alvo removido primeiro, checkpoint depois, ambos por IDs/nome/parent/default/protected guardados e pertencentes exclusivamente ao operador. Ausência confirmada; restaram somente production e preview originais. Pools encerrados. As cópias de teste foram apagadas permanentemente; nenhuma branch original ou dado da aplicação foi removido.

## Restrições descobertas e respeitadas

O Free rejeitou o envio de override de suspensão, mesmo com o valor padrão de 300s. O operador passou a omitir esse campo, sem upgrade. Um checkpoint com expiração também foi recusado como parent da segunda branch. O ensaio final deixou o checkpoint sem TTL, com limpeza obrigatória em finally; somente o alvo tinha TTL de uma hora. O Neon não permite filhas de uma branch com expiração. [Regras oficiais de expiração](https://neon.com/docs/guides/branch-expiration).

As tentativas anteriores não chegaram à simulação de perda. A única cópia criada nessa investigação também foi removida, com confirmação de que as duas branches originais permaneceram. Não esconder essas falhas nem apresentá-las como testes de recuperação aprovados.

## Alcance da evidência

Prova de **restauração de uma filha a partir do HEAD intacto do parent**, em cópias isoladas. Não houve restauração da branch production, teste de PITR histórico, pg_dump/pg_restore ou exportação de backup independente. O estado inicial da aplicação estava vazio; a recuperação de conteúdo foi demonstrada apenas pelas duas linhas sintéticas, não por volume de clientes.

A documentação atual limita PITR histórico às root branches. Não aplicar `^self@timestamp` à preview/filha como se tivesse sido validado aqui. A janela de 6h observada não é backup externo nem garante recuperação fora dela. [Instant restore e limitações](https://neon.com/docs/introduction/branch-restore).

Não certifica recuperação de R2, Durable Objects, secrets, Stripe ou efeitos já entregues pelo Resend. Um restore SQL não desfaz efeitos externos: antes de recuperar dados reais, conter writers/consumers, reconciliar outboxes/provedores, avaliar sessões ressuscitadas/revogação e objetos referenciados. Essa política e o ensaio amplo continuam gates próprios; nenhuma rotina de restore destrutivo de production é automatizada por este documento.

O ensaio foi um operador descartável, sem alteração de runtime da aplicação ou nova suíte/revisão histórica. CIs dos heads API `c642400` e produto `13b00ff` passaram; commits documentais posteriores precisam de leitura própria. API production permanece privada na versão `3afed7d4-9725-4fff-b1a9-15df463936f8`. Browser/CORS/cookies reais, imagens públicas, entregas/ciclo de provedores, readiness Paid e cutover ainda não foram certificados por esta prova.
