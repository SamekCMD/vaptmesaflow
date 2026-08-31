# Design: email de confirmação do Auth

## Objetivo

Substituir o email padrão de confirmação do Supabase Auth por uma mensagem em
português, com identidade visual Vapt, mantendo simultaneamente as duas formas
de confirmação já suportadas pelo produto:

- código OTP de seis dígitos para a tela `/verify-email`;
- link de confirmação como alternativa acessível por botão.

Também corrigir a origem pública do link gerado pelo GoTrue, que não pode
apontar para `localhost` em nenhum ambiente publicado.

## Escopo

Esta entrega cobre apenas o email de confirmação de cadastro. Templates de
recuperação, convite, magic link e troca de email permanecem inalterados. Não
será criado um serviço próprio de email nem um hook de envio, pois o SMTP do
Resend e o template remoto nativo do GoTrue atendem ao requisito.

## Arquitetura

O frontend publicará um arquivo HTML estático em:

```text
https://vapt.app.br/auth-email-confirmation.html
```

O GoTrue buscará esse arquivo para cada email de confirmação e renderizará as
variáveis de template. A versão instalada, `supabase/gotrue:v2.177.0`, fornece
`Token` e `ConfirmationURL` ao template de confirmação.

O domínio de produção será usado para hospedar o template mesmo durante testes
em previews. Isso evita acoplar o Auth a URLs efêmeras da Vercel. As previews
continuam válidas apenas como valores de `redirect_to`, mediante allowlist do
GoTrue.

## Template visual

O email usará HTML compatível com clientes de email, com layout baseado em
tabela e CSS inline:

- fundo cinza-claro e cartão branco central com largura máxima de 560 px;
- marca textual `Vapt` no topo;
- título `Confirme seu email` e texto curto em português;
- `{{ .Token }}` centralizado, grande, espaçado e com alto contraste;
- botão verde Vapt apontando para `{{ .ConfirmationURL }}`;
- URL textual abaixo do botão como fallback para clientes que bloqueiem links
  estilizados;
- aviso de segurança para ignorar o email quando o cadastro não foi solicitado;
- rodapé discreto identificando a Vapt.

O template não carregará JavaScript, fontes externas, pixels de rastreamento ou
imagens remotas. A marca textual evita bloqueio de imagem e reduz dependências.

## Configuração do Auth

O source atual do EasyPanel já repassa SMTP e caminhos do mailer, mas não
repassa assunto nem URL de template. O bloco `services.auth.environment` do
compose deverá receber:

```yaml
GOTRUE_MAILER_SUBJECTS_CONFIRMATION: ${MAILER_SUBJECTS_CONFIRMATION}
GOTRUE_MAILER_TEMPLATES_CONFIRMATION: ${MAILER_TEMPLATES_CONFIRMATION}
```

O Environment do EasyPanel deverá manter:

```dotenv
API_EXTERNAL_URL=https://samuel-supabase.br8r5p.easypanel.host
SUPABASE_PUBLIC_URL=https://samuel-supabase.br8r5p.easypanel.host
MAILER_SUBJECTS_CONFIRMATION=Seu código de verificação chegou
MAILER_TEMPLATES_CONFIRMATION=https://vapt.app.br/auth-email-confirmation.html
```

`API_EXTERNAL_URL` é a origem usada para construir `ConfirmationURL`; portanto,
ela corrige o link que antes começava com `localhost:8000`. `SITE_URL` continua
como `https://vapt.app.br`, e `ADDITIONAL_REDIRECT_URLS` continua incluindo os
destinos de produção e previews aprovados.

Como o EasyPanel lê um compose diretamente do GitHub, a alteração deverá ser
mantida em uma fonte versionada controlada pelo projeto, em vez de uma edição
manual dentro do container.

## Fluxo

1. O frontend chama `signUp` com o domínio atual em `emailRedirectTo`.
2. O GoTrue valida esse destino contra `GOTRUE_URI_ALLOW_LIST`.
3. O GoTrue cria o usuário pendente e obtém o template em `vapt.app.br`.
4. O GoTrue substitui `{{ .Token }}` e `{{ .ConfirmationURL }}`.
5. O Resend entrega o email.
6. O usuário informa o código na aplicação ou usa o botão do email.
7. O código confirma via `verifyOtp`; o botão confirma no endpoint público do
   Auth e redireciona ao domínio solicitado.

## Falhas e rollback

Se o template remoto não estiver disponível ou for inválido, o comportamento do
GoTrue deve ser verificado em staging antes do rollout, pois o cadastro não pode
depender de um recurso não publicado. A publicação do HTML no domínio estável
deve ocorrer antes de ativar `MAILER_TEMPLATES_CONFIRMATION`.

O rollback consiste em remover ou esvaziar
`MAILER_TEMPLATES_CONFIRMATION`, preservar a configuração SMTP e recriar o
serviço Auth. O GoTrue volta ao template padrão. A correção de
`API_EXTERNAL_URL` não deve ser revertida.

## Verificação

- validar que o arquivo estático é servido com HTTP 200 em produção;
- verificar no HTML publicado a presença das variáveis Go sem interpolação pelo
  build do frontend;
- gerar cadastro com email novo e confirmar assunto, remetente e renderização no
  Gmail em desktop e mobile;
- confirmar que o código recebido autentica em `/verify-email`;
- confirmar que o botão usa HTTPS no host público do Supabase e redireciona para
  a preview autorizada;
- confirmar que nenhum trecho do link contém `localhost`;
- confirmar que um template indisponível não deixa o rollout ativo;
- executar testes, lint e build do frontend antes do push.

## Conta de teste

A conta usada na investigação deve ser removida por `auth.users`. As relações
legadas `profiles` e `user_roles`, além de `account_preferences`, possuem cascata
de exclusão. Eventos históricos de auditoria podem permanecer como registro
operacional e não representam uma conta ativa.

