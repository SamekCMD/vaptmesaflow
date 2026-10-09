# Etapa 13 — emails de autenticação no provedor

## Execução iniciada — 08/10/2026

Objetivo: qualificar signup, template publicado de confirmação, callback e estado verified, seguido do template de reset. Fluxo real Better Auth/Turnstile/Resend, sem editar senha ou emailVerified no SQL, sem trocar keys/template/serviço e sem destinatário de cliente.

Usa `delivered+stage13-authmail-20261008-6c84d257@resend.dev`, nome `Vapt Teste Auth Email 6c84d257`, conta descartável do workflow autorizado. [Resend admite labels + em endereços de teste; eventos são simulados e os envios consomem quota](https://resend.com/docs/dashboard/emails/send-test-emails). Isso não prova entrega em caixas reais.

Preflight SQL somente leitura confirmou identidade ausente na branch production conhecida; pool fechado. Guard do operador recusando identidade antiga/alheia/duplicada/malformada: três testes RED→GREEN. Não houve seed nem bypass de autenticação. Conta criada pelo fluxo normal: ID `9a6bf9e6-8946-4228-81b0-7c5240bc9cd1`, emailVerified=false, accounts=1, sessions=0, resetRecords=0, restaurantes=0. Nenhum valor de senha/cookie/token lido do banco ou exposto no registro.

Par remoto conferido por GET: API94fffd63/frontend916951fb a100%, mesmos vínculos/CPU1000/oito nomes de secrets/HD/R2/DO/StripeTest/realtimefalse/Cron0/R2privado/API ingresso alternativo off. CI dos heads documentais API8bbb88a/Fb3834d4 passou nos quatro runs push/pull.

## Histórico — interrupção do navegador

A aba antiga tinha bundle anterior; navegação lazy ao cadastro falhou buscando chunk antigo. Reload normal carregou formulário atual. Turnstile passou automaticamente, sem automação do desafio. Formulário somente sintético preenchido, envio teve timeout e captura seguinte informou bloqueio por janela de extensão. Depois da confirmação humana de fechamento, a aba antiga já não existia; nova aba no mesmo Brave foi aberta. Envio por teclado teve novo bloqueio. Comandos UI interrompidos, sem desativar extensão/proteção ou salvar senha.

Solicitada conclusão humana do botão Criar Conta e fechamento normal do aviso da extensão. Leitura SQL posterior encontrou a conta acima: naquele momento, prova de criação, não atribuição exata da ação nem prova de email aceito/Delivered. Entrega, callback, verified e reset foram comprovados na retomada abaixo. Não reutilizar linhas históricas do painel como prova deste envio. Alteração final de senha por UI foi feita pelo usuário, sem enviar senha/token no chat.

Operador de inspeção/cleanup no workspace ignorado da Etapa13: somente email+nome+UUID+data exatos, sem restaurantes; cleanup remove a própria conta/sessões/accounts e registros reset do próprio UUID, verifica zero em cinco tabelas e fecha pool. Nunca remover outras contas ou emails do Resend. Não deixar fixture ativa ao encerrar o teste ou abandonar o fluxo.

## Retomada — confirmação e recuperação reais

O navegador voltou a responder sem desativar a extensão ou qualquer proteção. O envio novo de confirmação, correlacionado ao label acima, apareceu como Delivered no Resend: `01a11c79-7299-7316-a69b-ee62b712d4a1`, remetente `Vapt <no-reply@vapt.app.br>`, assunto “Confirme seu e-mail para começar no Vapt”, template publicado Account Confirmation (`8aedd871-bd59-4922-b153-3750efc154b8`). Não é uma linha histórica nem prova de entrega em caixa real.

O link real foi validado em memória contra `https://api.vapt.app.br/api/auth/verify-email` e callback exato `https://vapt.app.br/login?verified=1`, sem registrar o token. A navegação retornou ao callback com “Email confirmado. Você já pode entrar.” Leitura SQL posterior confirmou emailVerified=true para a própria conta, accounts=1, sessions=0, resetRecords=0 e nenhum restaurante; pool fechado. Não houve patch SQL de autenticação.

A recuperação foi solicitada pelo formulário real do Vapt, com Turnstile automático. Novo envio `01a11c84-8a30-7658-b651-1b53dfceb935` apareceu Delivered, assunto “Redefina sua senha do Vapt”, mesmo remetente e destinatário, template Password Reset (`555aa2c7-fd51-42d9-b687-9d8100839ff6`). Seu link foi validado em memória contra o endpoint de reset da API e callback `https://vapt.app.br/reset-password`; abriu a página “Criar nova senha”, com dois campos vazios e botão “Redefinir senha”. Tokens não foram impressos nem persistidos.

A inspeção SQL seguinte confirmou a própria conta verified=true, accounts=1, sessions=0 e resetRecords=1, sem restaurante, com pool fechado. A primeira tentativa local parou na conexão restrita, sem consultar ou alterar dados; a consulta com rede autorizada passou.

A entrada, confirmação e submissão da senha nova foram entregues ao usuário na aba real; a fixture própria ficou mantida somente durante esse handoff ativo.

## Resultado final — 08/10/2026

Após o usuário informar conclusão, a mesma página mostrou “Senha redefinida” e “Use a nova senha para entrar na sua conta.” Inspeção SQL somente de metadados confirmou o mesmo UUID, emailVerified=true, accounts=1, sessions=0 e resetRecords=0; o registro de recuperação anterior foi consumido pelo fluxo real. Nenhum valor de senha/hash/token foi consultado ou persistido. Não houve novo login com a senha escolhida; a prova anterior de login/reload/logout permanece separada em `infra-migration-phase-13-browser-pairing.md`.

Os três testes do guard do operador passaram novamente. Cleanup transacional removeu exclusivamente a conta descartável acima e seus registros vinculados, verificando zero resíduos em cinco tabelas (user/account/session/verification/restaurants), com pool fechado e exit0. Nenhum email do Resend foi removido. A conta e sua senha de teste não permanecem utilizáveis; não foi criado backup desses dados descartáveis.

Este gate comprova criação normal, dois templates publicados/envios correlacionados ao sink oficial, callback real de confirmação, verified e redefinição real com consumo do registro e limpeza. Não comprova caixa postal real, novo login pós-reset, billing, pagamento, capacidade ou o cutover completo. Não houve alteração de runtime nesta rodada; testes gerais anteriores não foram reapresentados como execução nova.

## Outros provedores: somente leitura

Stripe Test: três preços mensais BRL e portal existentes active=true/livemode=false. Único webhook `we_1UNjPKQYNWCekS7FvWV2SZuo`, URL https://api.vapt.app.br/webhooks/stripe, disabled/livemode=false, seis eventos previstos. Não ativado; não houve customer/checkout/pagamento. Turnstile inclui domínio apex e loopback. R2 conserva PUT CORS e custom domains vazios. Nomes antigos do widget não são motivo para reabrir legado.

Etapa13/cutover permanecem incompletos. Nenhum deploy/main/DNS/secret/plano ou produção StripeLive/ZeroTrust alterado nesta validação.
