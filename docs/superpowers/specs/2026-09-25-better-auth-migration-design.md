# Fase 5 — Migração de Supabase Auth para Better Auth

Status: desenho aprovado em 25/09/2026; implementação ainda não iniciada.

## Objetivo

Migrar a autenticação do Vapt de Supabase Auth para Better Auth executado dentro da API, preservando usuários, senhas e UUIDs existentes, sem alterar a relação `restaurants.owner_id` e sem fazer cutover em big bang.

O resultado final deve permitir que frontend e API usem sessões Better Auth persistidas no Neon, com Cloudflare Turnstile nos fluxos sensíveis e emails de verificação/recuperação enviados pela Resend por meio dos templates customizados já existentes.

## Estado atual

### Frontend

- `src/contexts/AuthContext.tsx` usa `supabase.auth` para cadastro, login, sessão e logout.
- `src/lib/vapt-api-client.ts` e `src/lib/n8n-client.ts` extraem o JWT Supabase e o enviam como `Authorization: Bearer`.
- `SettingsPage` usa `supabase.auth.updateUser` para nome e senha.
- o UUID de `user.id` é usado diretamente para localizar e criar restaurantes por `owner_id`;
- cadastro e login já usam Cloudflare Turnstile no navegador.

### API

- `src/plugins/auth.ts` valida localmente JWTs HS256 usando `SUPABASE_JWT_SECRET`;
- rotas protegidas recebem `request.auth.userId`, `email` e `role`;
- autorização de tenant compara `request.auth.userId` com `restaurants.owner_id`;
- `/auth/me` e `/auth/restaurants/:restaurantId/access` são a superfície mínima atual de autenticação;
- a API ainda é Fastify/Node durante a transição, mas será portada para Cloudflare Workers numa fase posterior;
- ainda não existe camada central de email ou integração Resend na API.

### Banco

- o baseline de negócio está aplicado somente em `preview.vapt` no Neon;
- `restaurants.owner_id` é UUID e não possui FK para uma tabela de identidade;
- schemas/tabelas Supabase Auth não foram copiados para o Neon;
- produção não recebeu o baseline nem objetos Better Auth.

## Princípios

1. Preservar os UUIDs dos usuários atuais.
2. Preservar as senhas atuais sempre que os hashes puderem ser migrados com segurança.
3. Não migrar sessões Supabase; um novo login será necessário no cutover.
4. Manter rollback para Supabase Auth durante toda a validação de preview.
5. Não criar um servidor ou microserviço separado de autenticação.
6. Não usar Neon Managed Auth.
7. Não recriar HTML de email no código.
8. Não expor tokens de sessão ao JavaScript do navegador.
9. Não promover o schema ou usuários Better Auth para produção antes de um ensaio completo em preview.

## Abordagens avaliadas

### Escolhida: transição dual dentro da API

A API passa a aceitar sessões Better Auth e, temporariamente, JWTs Supabase. O frontend de preview troca para Better Auth, enquanto o sistema antigo continua disponível para rollback.

Vantagens:

- mudança reversível;
- permite previews pareados de frontend e API;
- preserva rotas e contratos de autorização;
- testa Better Auth no Fastify atual antes do porte para Workers;
- reduz o risco do cutover de identidades.

Custo temporário:

- dois validadores de sessão durante a janela de migração;
- configuração adicional para impedir que o fallback legado permaneça ativo por acidente.

### Rejeitada: substituição imediata

Trocar frontend, middleware, usuários e sessões numa única implantação reduziria código temporário, mas eliminaria o rollback granular e contrariaria o plano conservador.

### Rejeitada: serviço de autenticação separado

Um Worker ou serviço exclusivo para autenticação adicionaria uma fronteira operacional desnecessária. O plano exige Better Auth como biblioteca dentro da API Vapt.

## Arquitetura escolhida

```text
Frontend Vite preview
        │
        │ cookie HTTP-only + credentials: include
        ▼
API Vapt preview
        │
        ├── /api/auth/* → Better Auth handler
        ├── middleware de sessão Better Auth
        └── fallback JWT Supabase, apenas em modo dual
                  │
                  ▼
          AuthContext normalizado
          { userId, email, role }
                  │
                  ├── autorização por restaurants.owner_id
                  └── rotas atuais sem mudança de contrato

Better Auth
        │
        ├── PostgreSQL/pg
        ├── schema better_auth no Neon preview
        ├── Turnstile
        └── EmailService → Resend template ID + variables
```

No runtime Worker, o mesmo `auth.handler(Request)` será chamado diretamente. No Fastify atual, um adaptador traduz request/response Node para Web Standards. A configuração do Better Auth e as regras de negócio de sessão não ficam acopladas ao adaptador Fastify.

## Componentes

### `auth/better-auth.ts`

Responsável por construir a instância Better Auth a partir de dependências explícitas:

- conexão PostgreSQL;
- base URL e trusted origins;
- secret;
- Turnstile secret;
- callbacks de email;
- relógio/background task quando necessário.

Não deve ler `process.env` diretamente em testes. A configuração continua centralizada em `src/lib/config.ts`.

### `auth/session-resolver.ts`

Expõe uma interface única para as rotas da API:

```ts
type AuthContext = {
  userId: string;
  email: string | null;
  role: string;
};

type SessionResolver = (request: RequestLike) => Promise<AuthContext | null>;
```

Modos permitidos:

```text
supabase    valida somente JWT legado
dual        tenta Better Auth e depois JWT legado
better-auth valida somente Better Auth
```

O modo deve ser explícito por ambiente. Produção permanece em `supabase` até o cutover aprovado. Preview começa em `dual` e passa a `better-auth` quando os testes de rollback estiverem concluídos.

O fallback só ocorre quando não existe sessão Better Auth válida. Uma sessão Better Auth apresentada e rejeitada não deve ser silenciosamente substituída por outra identidade Supabase no mesmo request.

### `auth/routes.ts`

- monta o catch-all Better Auth em `/api/auth/*`;
- mantém `/auth/me` e `/auth/restaurants/:restaurantId/access` com o contrato existente;
- usa o `SessionResolver`, sem conhecer detalhes de cookie ou JWT;
- preserva rate limits e o formato atual dos erros da API nas rotas Vapt.

### Cliente frontend

Um único `authClient` Better Auth será criado com a URL da API do ambiente. `AuthContext` continuará oferecendo a interface necessária às telas, mas os tipos deixarão de vir de `@supabase/supabase-js`.

O modelo de usuário compatível com a UI será:

```ts
type VaptUser = {
  id: string;
  email: string;
  name: string;
};
```

Adaptações previstas:

- `signUp` → `authClient.signUp.email`;
- `signIn` → `authClient.signIn.email`;
- `signOut` → `authClient.signOut`;
- sessão reativa → `authClient.useSession` ou uma camada equivalente;
- nome → `user.name` em vez de `user_metadata.full_name`;
- mudança de nome/senha → métodos Better Auth;
- chamadas da API usam `credentials: "include"` em vez de ler um access token no navegador.

O frontend não armazena o token da sessão em `localStorage` ou `sessionStorage`.

## Banco Better Auth

As tabelas Better Auth ficarão no schema PostgreSQL `better_auth`, separado das tabelas de negócio em `public`.

Motivos:

- evita colisão semântica com o antigo schema Supabase `auth`;
- permite grants independentes;
- facilita dump, auditoria e rollback;
- impede que migrations de identidade sejam confundidas com o baseline de negócio.

O schema deve ser gerado pela CLI da versão Better Auth fixada no `package-lock.json`, revisado e versionado como SQL antes de ser aplicado em preview. Migrations programáticas em startup não serão usadas em produção.

IDs de usuários migrados serão gravados com o mesmo valor textual UUID usado no Supabase. Não será criada FK entre `public.restaurants.owner_id` e `better_auth.user.id` nesta fase; a autorização continua sendo aplicada pela API. Isso evita acoplamento entre os ciclos de vida dos schemas e preserva rollback.

A role de runtime terá apenas os privilégios necessários em `better_auth` e nas operações de negócio da API. A role de migration será separada quando Hyperdrive/roles forem configurados.

## Sessões, cookies e CORS

Better Auth será a fonte de verdade da sessão nova. A sessão será enviada em cookie:

- `HttpOnly`;
- `Secure` fora do desenvolvimento local;
- sem acesso pelo JavaScript do frontend;
- escopo de host da API sempre que possível;
- CSRF e verificação de origin mantidos ativos.

Frontend e API preview devem usar hosts sob o mesmo domínio registrável do Vapt. A API permitirá credenciais CORS somente para origins explicitamente configuradas. `Access-Control-Allow-Credentials` será habilitado e origins curinga não serão aceitas em requests com credenciais.

Trusted origins e hosts dinâmicos de preview usarão allowlists restritas. URLs arbitrárias recebidas em headers não poderão definir callback URLs ou domínio de cookie.

## Turnstile

O plugin CAPTCHA oficial do Better Auth protegerá:

- cadastro por email;
- login por email;
- solicitação de recuperação de senha.

O componente Turnstile atual será preservado. O token será enviado no header `x-captcha-response` de cada chamada protegida. O token deve ser limpo e o widget reiniciado depois de sucesso ou erro terminal.

O secret Turnstile continuará apenas na API. A site key pública permanece no frontend por ambiente.

## Email e Resend

Better Auth chamará uma interface interna, sem conhecer a API da Resend:

```ts
type AuthEmailService = {
  sendVerification(input: {
    to: string;
    userName: string;
    actionUrl: string;
  }): Promise<void>;
  sendPasswordReset(input: {
    to: string;
    userName: string;
    actionUrl: string;
  }): Promise<void>;
};
```

A implementação Resend usará exclusivamente:

```text
template ID
+
variáveis dinâmicas publicadas no template
```

Não haverá assunto ou HTML duplicado no código quando o template publicado já for responsável por esses campos.

Configuração prevista:

```text
RESEND_API_KEY
RESEND_TEMPLATE_VERIFY_ACCOUNT
RESEND_TEMPLATE_RESET_PASSWORD
EMAIL_FROM
```

IDs e nomes reais das variáveis serão inventariados na conta Resend antes de habilitar envio remoto. Testes usarão um fake e nunca enviarão email real.

Em Workers, o envio deve ser deferido com `waitUntil` ou abstração equivalente, conforme o callback. No Fastify atual, falhas serão registradas sem expor tokens ou indicar se um email existe. A política exata de retry será consolidada na Fase 6.

## Verificação e recuperação

Cadastro novo em preview:

```text
signUp.email
→ cria usuário não verificado
→ Better Auth gera URL/token
→ AuthEmailService usa template Resend
→ usuário confirma email
→ login/sessão liberados
```

Recuperação:

```text
requestPasswordReset
→ resposta genérica
→ Better Auth gera URL/token quando aplicável
→ AuthEmailService usa template Resend
→ usuário define nova senha
→ demais sessões são revogadas
```

Respostas públicas não revelarão se o endereço já existe.

## Migração de usuários

A migração real só será executada depois que o acesso somente leitura ao Supabase de origem for restaurado.

O processo será um script separado, repetível e auditável:

1. ler `auth.users` e identidades necessárias da origem;
2. validar email, UUID, metadata e hash antes de escrever;
3. preservar `user.id` exatamente;
4. mapear `raw_user_meta_data.full_name` para `better_auth.user.name`;
5. mapear confirmação de email para `emailVerified`;
6. criar a conta credential com o hash bcrypt existente;
7. usar batches e cursor estável;
8. suportar dry-run e relatório sem dados sensíveis;
9. ser idempotente por ID/email;
10. abortar em conflito, sem sobrescrever silenciosamente.

Better Auth será configurado para verificar os hashes bcrypt migrados. Novas senhas permanecerão compatíveis durante a transição; uma mudança futura de algoritmo terá plano próprio de rehash gradual.

Sessões Supabase não serão copiadas. No cutover, todos os usuários precisarão autenticar novamente uma vez.

## Compatibilidade de IDs e autorização

O `userId` retornado por Better Auth deve ser o mesmo UUID textual já usado por:

- `restaurants.owner_id`;
- onboarding;
- consultas `fetchOwnedRestaurant`;
- checagens de tenant da API;
- billing e pagamentos;
- upload de imagens.

Antes do cutover, um teste de paridade deve executar as mesmas checagens de ownership com uma sessão Supabase e com a sessão Better Auth do mesmo usuário e obter o mesmo restaurante.

Nenhuma role, restaurante ou organização será inferida a partir de dados controlados pelo cliente. A API continuará consultando a relação de ownership no banco.

## Configuração por ambiente

Novas variáveis previstas na API:

```text
AUTH_PROVIDER=supabase|dual|better-auth
BETTER_AUTH_SECRET
BETTER_AUTH_URL
BETTER_AUTH_TRUSTED_ORIGINS
DATABASE_URL                 # Node atual / ferramentas
TURNSTILE_SECRET_KEY
RESEND_API_KEY
RESEND_TEMPLATE_VERIFY_ACCOUNT
RESEND_TEMPLATE_RESET_PASSWORD
EMAIL_FROM
```

No Worker, `DATABASE_URL` será substituída em runtime pela connection string do binding Hyperdrive. Segredos não serão versionados. Preview e produção terão valores e bancos separados.

## Erros e observabilidade

- falhas de autenticação retornam 401 genérico;
- falta de acesso ao restaurante retorna 403, como hoje;
- falhas internas do Better Auth recebem correlation ID e log estruturado;
- email e tokens nunca aparecem em logs completos;
- métricas distinguem provedor de sessão (`supabase` ou `better-auth`) sem registrar o token;
- modo `dual` registra uso do fallback legado para medir prontidão do cutover;
- conflitos de migração geram relatório e interrompem a promoção.

## Testes obrigatórios

### API

- configuração falha quando variáveis obrigatórias do modo escolhido faltam;
- modo `supabase` preserva o comportamento atual;
- modo `dual` aceita cookie Better Auth válido;
- modo `dual` aceita JWT legado somente quando não há sessão Better Auth apresentada;
- sessão Better Auth inválida não troca silenciosamente de identidade;
- modo `better-auth` rejeita JWT legado;
- `/auth/me` mantém o contrato normalizado;
- ownership recebe o UUID preservado;
- CORS permite credenciais apenas para origins autorizadas;
- handlers de email recebem URL e variáveis corretas, usando fake;
- Turnstile protege cadastro, login e recuperação.

### Frontend

- cadastro envia nome, email, senha e Turnstile;
- cadastro não navega para onboarding antes da política de verificação permitir;
- login, logout e restauração de sessão;
- chamadas da API usam cookies e `credentials: include`;
- nome do usuário usa `user.name`;
- mudança de nome e senha;
- recuperação de senha;
- rotas protegidas e refresh do navegador;
- mensagens não permitem enumeração de emails.

### Migração

- dry-run não escreve;
- UUID, email, nome e confirmação são preservados;
- hash bcrypt migrado autentica a senha conhecida de fixture;
- execução repetida não duplica usuários/contas;
- conflito de ID/email interrompe o batch;
- nenhuma sessão Supabase é importada;
- contagens e ownership fecham com a origem.

### Preview integrado

- signup → verificação → login → onboarding;
- logout → refresh permanece deslogado;
- recuperação → nova senha → sessões antigas revogadas;
- dashboard acessa somente o restaurante do usuário;
- frontend e API da mesma branch usam o Neon preview;
- rollback para `AUTH_PROVIDER=supabase` restaura o fluxo antigo.

## Sequência de implementação

1. Introduzir abstrações e testes de sessão sem mudar o provedor ativo.
2. Adicionar dependências Better Auth/PostgreSQL com versões fixadas.
3. Gerar e revisar a migration do schema `better_auth`.
4. Aplicar o schema somente no Neon `preview`.
5. Montar o handler Better Auth no Fastify e implementar modo `dual`.
6. Integrar Turnstile e o fake de email.
7. Migrar o `AuthContext` e os clientes do frontend na branch pareada.
8. Conectar os templates Resend reais em preview.
9. Implementar e ensaiar o script de migração com fixtures sintéticas.
10. Ensaiar usuários reais somente após acesso seguro à origem.
11. Validar preview integrado e rollback.
12. Planejar separadamente a janela de produção.

## Rollback

Durante preview:

- mudar `AUTH_PROVIDER` de `dual` para `supabase`;
- reimplantar o frontend anterior ou a branch correspondente;
- manter o schema `better_auth` isolado e sem tráfego;
- não apagar usuários migrados durante investigação.

Durante o futuro cutover:

- Supabase Auth permanece disponível até a aceitação final;
- a origem fica em modo compatível com rollback durante a janela definida;
- qualquer divergência de contagem, ownership ou login interrompe a promoção;
- nenhuma remoção do Supabase self-hosted ocorre nesta fase.

## Não objetivos

- portar toda a API para Workers;
- criar Hyperdrive de produção;
- migrar todas as consultas de negócio do Supabase para PostgreSQL;
- implementar organizations ou convites antes de existir requisito funcional;
- adicionar login social inexistente hoje;
- remover `@supabase/supabase-js` do frontend ou API antes das demais fases;
- alterar templates visuais da Resend;
- executar cutover de produção.

## Critérios de aceite do desenho

- UUIDs e senhas existentes são preservados;
- sessões antigas são conscientemente invalidadas somente no cutover;
- frontend nunca manipula o token Better Auth;
- modo dual tem prazo e telemetria para remoção;
- Better Auth usa Neon preview e schema isolado;
- Turnstile continua protegendo os três endpoints sensíveis;
- Resend usa templates existentes;
- autorização multi-tenant continua baseada no banco;
- produção e Supabase permanecem operacionais durante a validação.

## Referências oficiais verificadas

- Better Auth — Fastify integration: <https://better-auth.com/docs/integrations/fastify>
- Better Auth — PostgreSQL adapter: <https://better-auth.com/docs/adapters/postgresql>
- Better Auth — Supabase migration guide: <https://better-auth.com/docs/guides/supabase-migration-guide>
- Better Auth — email: <https://better-auth.com/docs/concepts/email>
- Better Auth — cookies: <https://better-auth.com/docs/concepts/cookies>
- Better Auth — CAPTCHA/Turnstile: <https://better-auth.com/docs/plugins/captcha>
- Cloudflare — Hyperdrive PostgreSQL: <https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/>
