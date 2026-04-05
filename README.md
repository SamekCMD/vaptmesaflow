# Vapt

OperaÃ§Ã£o mais clara para restaurantes.

O Vapt Ã© uma plataforma para restaurantes, padarias e hamburguerias brasileiras que centraliza salÃ£o, cardÃ¡pio, cozinha, caixa e visÃ£o operacional em um sÃ³ produto. A proposta da marca Ã© reduzir ruÃ­do entre etapas do atendimento e dar contexto suficiente para decidir antes do atraso aparecer.

## O que o produto resolve

- CardÃ¡pio digital com fluxo pÃºblico para pedidos na mesa
- GestÃ£o de cozinha com monitor de preparo em tempo real
- Caixa com visÃ£o das mesas e fechamento operacional
- Dashboard com leitura rÃ¡pida da operaÃ§Ã£o
- Onboarding guiado para tirar o restaurante do zero atÃ© a primeira operaÃ§Ã£o
- AparÃªncia personalizÃ¡vel para o cardÃ¡pio pÃºblico

## Identidade da marca

O Vapt nÃ£o se posiciona como um â€œapp bonito para restauranteâ€. O foco Ã© clareza operacional.

- Direto ao ponto
- Profissional sem ser frio
- RÃ¡pido para operar
- LegÃ­vel no pico
- Ãštil para dono, salÃ£o e cozinha

## Stack principal

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Supabase

## Estrutura do produto

- `src/pages/dashboard`
  - Ã¡reas internas como visÃ£o geral, caixa, cardÃ¡pio, cozinha, aparÃªncia e configuraÃ§Ãµes
- `src/pages/menu`
  - experiÃªncia pÃºblica do cardÃ¡pio
- `src/pages/onboarding`
  - fluxo de ativaÃ§Ã£o inicial
- `src/components/landing`
  - landing page e blocos comerciais
- `src/lib`
  - utilitÃ¡rios de negÃ³cio, configuraÃ§Ã£o e integraÃ§Ãµes
- `supabase/migrations`
  - migrations SQL do projeto

## Como rodar localmente

### 1. Instale as dependÃªncias

```bash
npm install
```

### 2. Configure o ambiente

Crie um arquivo `.env.local` a partir de `.env.example`.

VariÃ¡veis esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PRICE_STARTER`
- `VITE_STRIPE_PRICE_PRO`
- `VITE_STRIPE_PRICE_BUSINESS`
- `VITE_N8N_WEBHOOK_BASE_URL`
- `VITE_VAPT_APP_ENDPOINT_SECRET`
- `VITE_VAPT_WEBHOOK_SETUP_SECRET`
- `VITE_VAPT_ADMIN_ENDPOINT_SECRET`
- `VITE_VAPID_PUBLIC_KEY`

### 3. Inicie o projeto

```bash
npm run dev
```

O app sobe em ambiente local pelo Vite.

## Scripts Ãºteis

```bash
npm run dev
npm run build
npm run test
npx tsc --noEmit
```

## Banco e migrations

As mudanÃ§as de banco ficam em `supabase/migrations`.

Se uma feature depender de tabela nova, rode a migration correspondente no Supabase antes de validar o fluxo em ambiente real.

Exemplo recente:

- `20260403_create_order_feedback.sql`
  - cria a base para avaliaÃ§Ãµes de pedidos e resumo de satisfaÃ§Ã£o

## Fluxos importantes do produto

### Landing

A landing apresenta o Vapt como cockpit operacional, nÃ£o como vitrine genÃ©rica de SaaS.

### Onboarding

O onboarding foi desenhado para levar o restaurante atÃ© a primeira operaÃ§Ã£o e depois oferecer um guia contextual dentro dos mÃ³dulos reais.

### CardÃ¡pio pÃºblico

O cardÃ¡pio pÃºblico Ã© o ponto de contato do cliente final com o restaurante. Ele precisa manter clareza de navegaÃ§Ã£o, contexto do pedido e consistÃªncia visual com a identidade configurada.

### Overview

A visÃ£o geral do dashboard existe para responder rapidamente:

- como estÃ¡ a operaÃ§Ã£o agora
- se existe alguma pendÃªncia real
- o que merece atenÃ§Ã£o sem forÃ§ar leitura excessiva

## Qualidade e manutenÃ§Ã£o

Este projeto jÃ¡ passou por refactors importantes de:

- onboarding
- landing page
- fluxo pÃºblico de avaliaÃ§Ã£o de pedidos
- configuraÃ§Ã£o via variÃ¡veis de ambiente
- preview visual da aparÃªncia

Ao continuar evoluindo o produto, a regra deve ser manter commits separados por assunto, com escopo claro e sem misturar feature com ruÃ­do de workspace.

## ObservaÃ§Ãµes

- `.env` e variaÃ§Ãµes locais nÃ£o devem ir para o git
- artefatos locais de skills, planos e tooling auxiliar tambÃ©m ficam ignorados
- o projeto ainda depende de configuraÃ§Ãµes externas reais para Stripe, Supabase, webhooks e push

## Resumo

O Vapt Ã© um sistema de operaÃ§Ã£o para restaurantes que troca improviso por visibilidade. A ideia central do produto Ã© simples: menos ruÃ­do entre salÃ£o, cozinha e caixa, mais clareza para agir no tempo certo.


