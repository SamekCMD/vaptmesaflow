# Fase 5 — Migração de Supabase Auth para Better Auth

Status: desenho revisado em 25/09/2026 após confirmação de que não existem contas ou dados reais em produção; implementação ainda não iniciada.

## Objetivo

Substituir a autenticação Supabase por Better Auth executado dentro da API. Como as contas atuais são apenas testes descartáveis, o ambiente Better Auth começará vazio, sem migração de usuários, senhas, sessões ou UUIDs legados.

O resultado final deve permitir que frontend e API usem sessões Better Auth persistidas no Neon, com novos IDs UUID compatíveis com `restaurants.owner_id`, Cloudflare Turnstile nos fluxos sensíveis e emails de verificação/recuperação enviados pela Resend por meio dos templates customizados já existentes.

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

1. Não migrar contas, senhas, sessões ou UUIDs Supabase descartáveis.
2. Gerar novos IDs UUID para manter compatibilidade de tipo com `restaurants.owner_id`.
3. Usar branches/deploys como mecanismo de rollback, sem manter dois validadores de autenticação na mesma versão.
4. Não criar um servidor ou microserviço separado de autenticação.
5. Não usar Neon Managed Auth.
6. Não recriar HTML de email no código.
7. Não expor tokens de sessão ao JavaScript do navegador.
8. Não promover o schema ou usuários Better Auth para produção antes de um ensaio completo em preview.

## Abordagens avaliadas

### Escolhida: substituição isolada em preview

Frontend e API da branch pareada de preview passam diretamente para Better Auth. O deploy legado continua disponível em sua versão anterior para rollback, mas o código novo não aceita JWT Supabase.

Vantagens:

- mudança reversível por branch/deploy;
- permite previews pareados de frontend e API;
- preserva rotas e contratos de autorização;
- testa Better Auth no Fastify atual antes do porte para Workers;
- elimina código e testes de compatibilidade sem usuários reais para proteger.

### Rejeitada: modo dual Supabase + Better Auth

Aceitar cookies Better Auth e JWTs Supabase na mesma versão só seria útil para preservar sessões ou usuários ativos. Como existem apenas contas de teste, esse modo adicionaria fallback, configuração, telemetria e testes sem benefício operacional.

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
        └── middleware de sessão Better Auth
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

O resolver consulta apenas Better Auth. A abstração existe para manter as rotas desacopladas do framework e facilitar testes, não para suportar múltiplos provedores.

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

Better Auth será configurado para gerar novos IDs UUID. A migration gerada deve ser inspecionada para confirmar que esses IDs podem ser usados diretamente em `public.restaurants.owner_id`. Não será criada FK entre `public.restaurants.owner_id` e `better_auth.user.id` nesta fase; a autorização continua sendo aplicada pela API e os schemas mantêm ciclos de vida independentes.

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

## Bootstrap de usuários e dados de teste

Não será criado script de migração do Supabase Auth. Usuários, senhas, hashes, identities e sessões atuais são descartáveis e não serão lidos nem copiados.

O bootstrap de preview será:

1. aplicar o schema Better Auth vazio;
2. cadastrar novas contas de teste pelo fluxo público;
3. verificar os emails de teste pelo template Resend;
4. recriar ou reseedar restaurantes de teste ligados aos novos IDs;
5. eliminar fixtures manuais quando o fluxo de onboarding puder criar os dados necessários.

Essa decisão também remove bcrypt e qualquer acesso ao schema `auth.users` da origem do escopo desta fase. O bloqueio de acesso ao Supabase de origem continua relevante para a migração futura dos dados de negócio, mas não bloqueia Better Auth.

## Compatibilidade de IDs e autorização

O novo `userId` retornado por Better Auth deve ser um UUID válido para uso em:

- `restaurants.owner_id`;
- onboarding;
- consultas `fetchOwnedRestaurant`;
- checagens de tenant da API;
- billing e pagamentos;
- upload de imagens.

Um teste de integração deve cadastrar um usuário Better Auth novo, criar um restaurante com esse ID e confirmar que todas as checagens de ownership retornam o mesmo restaurante.

Nenhuma role, restaurante ou organização será inferida a partir de dados controlados pelo cliente. A API continuará consultando a relação de ownership no banco.

## Configuração por ambiente

Novas variáveis previstas na API:

```text
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
- métricas registram sucesso/falha dos fluxos Better Auth sem registrar cookies ou tokens;
- falhas de bootstrap de dados de teste interrompem a validação do preview.

## Testes obrigatórios

### API

- configuração falha quando variáveis Better Auth obrigatórias faltam;
- cookie Better Auth válido cria o contexto normalizado;
- sessão ausente ou inválida retorna 401;
- JWT Supabase legado não autentica a versão nova;
- `/auth/me` mantém o contrato normalizado;
- ownership recebe o novo UUID Better Auth;
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

### Bootstrap

- novo usuário recebe ID UUID válido;
- cadastro e verificação criam uma conta utilizável;
- onboarding associa o restaurante ao novo ID;
- nenhuma tabela Supabase Auth é consultada;
- nenhuma senha, hash ou sessão legada é importada.

### Preview integrado

- signup → verificação → login → onboarding;
- logout → refresh permanece deslogado;
- recuperação → nova senha → sessões antigas revogadas;
- dashboard acessa somente o restaurante do usuário;
- frontend e API da mesma branch usam o Neon preview;
- rollback do deploy restaura a versão anterior do frontend e da API.

## Sequência de implementação

1. Adicionar dependências Better Auth/PostgreSQL com versões fixadas.
2. Gerar e revisar a migration do schema `better_auth`.
3. Aplicar o schema somente no Neon `preview`.
4. Montar o handler Better Auth e o resolver de sessão no Fastify.
5. Integrar Turnstile e o fake de email.
6. Migrar o `AuthContext` e os clientes do frontend na branch pareada.
7. Conectar os templates Resend reais em preview.
8. Criar novas contas e dados sintéticos pelo fluxo normal da aplicação.
9. Validar preview integrado e rollback por deploy.
10. Planejar separadamente qualquer promoção futura.

## Rollback

Durante preview:

- reimplantar a versão anterior do frontend e da API;
- manter o schema `better_auth` isolado e sem tráfego;
- manter as contas Better Auth de teste durante a investigação ou recriar o branch Neon.

Durante o futuro cutover:

- a versão legada permanece disponível até a aceitação final;
- qualquer falha de signup, login, ownership ou recuperação interrompe a promoção;
- nenhuma remoção do Supabase self-hosted ocorre nesta fase.

## Não objetivos

- portar toda a API para Workers;
- criar Hyperdrive de produção;
- migrar todas as consultas de negócio do Supabase para PostgreSQL;
- implementar organizations ou convites antes de existir requisito funcional;
- adicionar login social inexistente hoje;
- migrar usuários, UUIDs, senhas, hashes ou sessões Supabase de teste;
- remover `@supabase/supabase-js` do frontend ou API antes das demais fases;
- alterar templates visuais da Resend;
- executar cutover de produção.

## Critérios de aceite do desenho

- contas legadas descartáveis não são migradas;
- novos IDs Better Auth são UUIDs compatíveis com `restaurants.owner_id`;
- frontend nunca manipula o token Better Auth;
- Better Auth usa Neon preview e schema isolado;
- Turnstile continua protegendo os três endpoints sensíveis;
- Resend usa templates existentes;
- autorização multi-tenant continua baseada no banco;
- rollback ocorre pela versão anterior, sem código dual na implementação nova.

## Referências oficiais verificadas

- Better Auth — Fastify integration: <https://better-auth.com/docs/integrations/fastify>
- Better Auth — PostgreSQL adapter: <https://better-auth.com/docs/adapters/postgresql>
- Better Auth — email: <https://better-auth.com/docs/concepts/email>
- Better Auth — cookies: <https://better-auth.com/docs/concepts/cookies>
- Better Auth — CAPTCHA/Turnstile: <https://better-auth.com/docs/plugins/captcha>
- Cloudflare — Hyperdrive PostgreSQL: <https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/>
