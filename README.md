# Vapt

Operação mais clara para restaurantes.

O Vapt é uma plataforma para restaurantes, padarias e hamburguerias brasileiras que centraliza salão, cardápio, cozinha, caixa e visão operacional em um só produto. A proposta da marca é reduzir ruído entre etapas do atendimento e dar contexto suficiente para decidir antes do atraso aparecer.

## O que o produto resolve

- Cardápio digital com fluxo público para pedidos na mesa
- Gestão de cozinha com monitor de preparo em tempo real
- Caixa com visão das mesas e fechamento operacional
- Dashboard com leitura rápida da operação
- Onboarding guiado para tirar o restaurante do zero até a primeira operação
- Aparência personalizável para o cardápio público

## Identidade da marca

O Vapt não se posiciona como um “app bonito para restaurante”. O foco é clareza operacional.

- Direto ao ponto
- Profissional sem ser frio
- Rápido para operar
- Legível no pico
- Útil para dono, salão e cozinha

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
  - áreas internas como visão geral, caixa, cardápio, cozinha, aparência e configurações
- `src/pages/menu`
  - experiência pública do cardápio
- `src/pages/onboarding`
  - fluxo de ativação inicial
- `src/components/landing`
  - landing page e blocos comerciais
- `src/lib`
  - utilitários de negócio, configuração e integrações
- `supabase/migrations`
  - migrations SQL do projeto

## Como rodar localmente

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure o ambiente

Crie um arquivo `.env.local` a partir de `.env.example`.

Variáveis esperadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PRICE_STARTER`
- `VITE_STRIPE_PRICE_PRO`
- `VITE_STRIPE_PRICE_BUSINESS`
- `VITE_N8N_CHECKOUT_WEBHOOK_URL`
- `VITE_N8N_WEBHOOK_URL`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_PUSH_SUBSCRIBE_WEBHOOK_URL`

### 3. Inicie o projeto

```bash
npm run dev
```

O app sobe em ambiente local pelo Vite.

## Scripts úteis

```bash
npm run dev
npm run build
npm run test
npx tsc --noEmit
```

## Banco e migrations

As mudanças de banco ficam em `supabase/migrations`.

Se uma feature depender de tabela nova, rode a migration correspondente no Supabase antes de validar o fluxo em ambiente real.

Exemplo recente:

- `20260403_create_order_feedback.sql`
  - cria a base para avaliações de pedidos e resumo de satisfação

## Fluxos importantes do produto

### Landing

A landing apresenta o Vapt como cockpit operacional, não como vitrine genérica de SaaS.

### Onboarding

O onboarding foi desenhado para levar o restaurante até a primeira operação e depois oferecer um guia contextual dentro dos módulos reais.

### Cardápio público

O cardápio público é o ponto de contato do cliente final com o restaurante. Ele precisa manter clareza de navegação, contexto do pedido e consistência visual com a identidade configurada.

### Overview

A visão geral do dashboard existe para responder rapidamente:

- como está a operação agora
- se existe alguma pendência real
- o que merece atenção sem forçar leitura excessiva

## Qualidade e manutenção

Este projeto já passou por refactors importantes de:

- onboarding
- landing page
- fluxo público de avaliação de pedidos
- configuração via variáveis de ambiente
- preview visual da aparência

Ao continuar evoluindo o produto, a regra deve ser manter commits separados por assunto, com escopo claro e sem misturar feature com ruído de workspace.

## Observações

- `.env` e variações locais não devem ir para o git
- artefatos locais de skills, planos e tooling auxiliar também ficam ignorados
- o projeto ainda depende de configurações externas reais para Stripe, Supabase, webhooks e push

## Resumo

O Vapt é um sistema de operação para restaurantes que troca improviso por visibilidade. A ideia central do produto é simples: menos ruído entre salão, cozinha e caixa, mais clareza para agir no tempo certo.
