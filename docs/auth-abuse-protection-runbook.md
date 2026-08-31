# Auth abuse protection runbook

Este runbook configura a proteção na fronteira do Supabase Auth self-hosted. O
frontend apenas coleta o token do Turnstile; a validação real deve continuar no
container `auth` (GoTrue).

## 1. Cloudflare Turnstile

1. Crie um widget Turnstile no modo `Managed`.
2. Autorize somente os hostnames reais do frontend. Não autorize `localhost` no
   widget de produção.
3. Guarde a `secret key` somente na VPS.
4. Configure a `sitekey` pública no ambiente de build do frontend:

```dotenv
VITE_TURNSTILE_SITE_KEY=<sitekey-publica>
VITE_TURNSTILE_ENABLED=true
```

Para desenvolvimento local, use o par oficial de teste que sempre aprova:

```dotenv
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

No GoTrue local, use junto a secret de teste correspondente:

```dotenv
AUTH_CAPTCHA_SECRET=1x0000000000000000000000000000000AA
```

Nunca use a secret key, a chave da Resend ou a `service_role` em uma variável
`VITE_*`: essas variáveis são incorporadas ao JavaScript público.

## 2. Resend SMTP

1. Verifique o domínio remetente na Resend e confirme SPF, DKIM e DMARC.
2. Crie uma API key exclusiva para o SMTP do Supabase.
3. No `.env` privado da stack Supabase na VPS, configure:

```dotenv
SMTP_ADMIN_EMAIL=contato@seu-dominio.com
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_SENDER_NAME=Vapt

AUTH_RATE_LIMIT_EMAIL_SENT=10
AUTH_SMTP_MAX_FREQUENCY=60s

AUTH_CAPTCHA_ENABLED=true
AUTH_CAPTCHA_PROVIDER=turnstile
AUTH_CAPTCHA_SECRET=<turnstile-secret-key>
```

## 3. Confirmação de email por código

Mantenha confirmação obrigatória e desative autoconfirmação:

```dotenv
ENABLE_EMAIL_AUTOCONFIRM=false
```

No template de confirmação do Supabase Auth, inclua `{{ .Token }}` no corpo do
email. O frontend solicita esse código na rota `/verify-email`; um template que
contenha apenas `{{ .ConfirmationURL }}` não atende esse fluxo. Faça um envio de
teste e confirme que o código aparece sem expor dados sensíveis.

Use o domínio estável do frontend para hospedar o template e o host público do
Supabase para construir o endpoint de confirmação:

```dotenv
SITE_URL=https://vapt.app.br
API_EXTERNAL_URL=https://samuel-supabase.br8r5p.easypanel.host
SUPABASE_PUBLIC_URL=https://samuel-supabase.br8r5p.easypanel.host
MAILER_SUBJECTS_CONFIRMATION=Seu código de verificação chegou
MAILER_TEMPLATES_CONFIRMATION=https://vapt.app.br/auth-email-confirmation.html
```

`API_EXTERNAL_URL` deve ser uma origem HTTPS sem `/auth/v1` no final. Ela é
usada pelo GoTrue para construir `{{ .ConfirmationURL }}` e nunca pode apontar
para `localhost` em produção.

Autorize os domínios do frontend e suas rotas, incluindo recuperação e o
redirecionamento após confirmação. Não abra a allowlist para outros hosts:

```dotenv
ADDITIONAL_REDIRECT_URLS=https://vapt.app.br/**,https://www.vapt.app.br/**,https://vaptmesaflow-*-contatoupboost-2301s-projects.vercel.app/**
```

O template de recuperação deve manter `{{ .ConfirmationURL }}`. O link abre
`/reset-password`; o SDK estabelece a sessão temporária e emite o evento
`PASSWORD_RECOVERY` antes de permitir a atualização da senha.

## 4. GoTrue no compose do EasyPanel

O EasyPanel obtém a stack pelo source GitHub. Não edite containers ou arquivos
internos da VPS. Mantenha um fork versionado de `easypanel-io/compose`, baseado
na branch atualmente fixada, e adicione ao bloco `services.auth.environment`:

```yaml
GOTRUE_SMTP_MAX_FREQUENCY: ${AUTH_SMTP_MAX_FREQUENCY}
GOTRUE_RATE_LIMIT_EMAIL_SENT: ${AUTH_RATE_LIMIT_EMAIL_SENT}
GOTRUE_SECURITY_CAPTCHA_ENABLED: ${AUTH_CAPTCHA_ENABLED}
GOTRUE_SECURITY_CAPTCHA_PROVIDER: ${AUTH_CAPTCHA_PROVIDER}
GOTRUE_SECURITY_CAPTCHA_SECRET: ${AUTH_CAPTCHA_SECRET}
GOTRUE_MAILER_SUBJECTS_CONFIRMATION: ${MAILER_SUBJECTS_CONFIRMATION}
GOTRUE_MAILER_TEMPLATES_CONFIRMATION: ${MAILER_TEMPLATES_CONFIRMATION}
```

As variáveis SMTP padrão da distribuição oficial também devem permanecer
mapeadas para `GOTRUE_SMTP_HOST`, `GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`,
`GOTRUE_SMTP_PASS`, `GOTRUE_SMTP_ADMIN_EMAIL` e
`GOTRUE_SMTP_SENDER_NAME`. Não altere imagem, volumes, banco ou outros serviços
para habilitar o template.

Ordem de rollout:

1. Publique o frontend e confirme HTTP 200 em
   `https://vapt.app.br/auth-email-confirmation.html`.
2. Publique no fork as duas variáveis `GOTRUE_MAILER_*`.
3. No EasyPanel, mantenha build path `/supabase/code`, compose file
   `docker-compose.yml` e selecione a branch versionada do fork.
4. Confira as variáveis no Environment sem revelar seus valores secretos.
5. Use o botão `Deploy` da aplicação compose para recriar os serviços.
6. Faça um cadastro com email descartável e valide código e botão.

Não registre nem compartilhe a saída completa de ambiente do container, pois
ela contém segredos.

Se o template impedir cadastros, remova `MAILER_TEMPLATES_CONFIRMATION` do
Environment e faça novo `Deploy`. Preserve `API_EXTERNAL_URL`; restaurar
`localhost` não é um rollback válido.

## 5. Validação manual

1. Abra login e cadastro e confirme que o botão fica bloqueado antes do desafio.
2. Complete o desafio e confirme login/cadastro válidos.
3. Confirme que um token inválido ou expirado é rejeitado pelo Auth, não apenas
   pelo frontend.
4. Solicite dois emails para o mesmo endereço em menos de 60 segundos e confirme
   o bloqueio do segundo.
5. Em um ambiente controlado, atinja o limite de email e confirme HTTP `429` e a
   mensagem de espera, sem repetição automática pelo cliente.
6. Confirme entrega, remetente, links e alinhamento SPF/DKIM/DMARC no provedor.
7. Revise os logs do `auth` procurando por `429`, falhas de CAPTCHA e falhas SMTP.
8. Abra um link de recuperação válido, recarregue a página e confirme que a
   redefinição continua ativa; atualize a senha e confirme o retorno ao bootstrap.
9. Confirme que link expirado não abre o formulário e que cancelar encerra a
   sessão temporária e retorna ao login.

## 6. Incidente e rollback

Se houver aumento anormal de tentativas, preserve os limites, restrinja tráfego
no proxy/WAF e verifique IPs, rotas e usuários afetados. Não aumente limites para
ocultar loops de cliente.

Se o Turnstile indisponível bloquear usuários legítimos, confirme primeiro DNS,
egress da VPS e status da Cloudflare. Como medida emergencial e temporária,
desative `AUTH_CAPTCHA_ENABLED`, recrie o serviço `auth`, defina
`VITE_TURNSTILE_ENABLED=false` e publique um novo build do frontend. As duas
alterações devem ser coordenadas; alterar apenas um lado mantém o fluxo
bloqueado. Preserve rate limits e monitoramento reforçados e registre horário,
responsável e prazo para reativação.

Se a credencial Resend vazar, revogue-a, gere outra, atualize `SMTP_PASS`, recrie
o serviço `auth` e revise os eventos de envio. Nunca faça rollback removendo os
limites de email.

## Referências oficiais

- [Supabase: CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase: Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase: self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase Docker configuration](https://github.com/supabase/supabase/blob/master/docker/CONFIG.md)
- [Resend: Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Cloudflare: Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Cloudflare: hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
