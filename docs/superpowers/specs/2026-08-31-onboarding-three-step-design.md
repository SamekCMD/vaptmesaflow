# Onboarding de três etapas

## Objetivo

Substituir o onboarding atual de quatro etapas por um wizard focado, profissional e retomável. O fluxo deve coletar apenas o necessário para deixar o restaurante operacional. Branding, logo, primeiro produto e visitas guiadas aos módulos permanecem como tarefas opcionais de ativação pós-onboarding na Fase 5.

## Fluxo

### 1. Dados básicos

- Nome do restaurante, obrigatório.
- Slug do cardápio, obrigatório e editável.
- WhatsApp, opcional.
- Erros de validação aparecem junto ao campo.
- Conflito de slug recebe mensagem humana no campo de slug.

### 2. Operação

- Escolha obrigatória entre `Salão`, `Delivery` ou `Ambos`.
- A escolha persiste em `local_enabled` e `delivery_enabled`.
- Número de mesas aparece apenas quando Salão está habilitado.
- Quando o restaurante opera somente com Delivery, o valor técnico mínimo de mesas permanece compatível com o schema, mas não é apresentado como uma decisão ao usuário.

### 3. Pronto

- Exibe um resumo dos dados básicos e da operação.
- Permite voltar para corrigir qualquer etapa.
- A ação final será conectada à finalização atômica e idempotente da Tarefa 14.
- A tela de sucesso oferece entrada no dashboard sem marcar tarefas de ativação como concluídas.

## Composição visual

Usar um card central de coluna única, com indicador discreto de três etapas, título específico por etapa e uma ação primária `Salvar e continuar`. A hierarquia deve preservar os componentes, cores e espaçamentos atuais do Vapt, com largura confortável no desktop e ocupação quase integral no mobile.

## Arquitetura

- `OnboardingPage` atua apenas como controlador do wizard.
- `RestaurantBasicsStep` contém campos e validação dos dados básicos.
- `OperationStep` contém modo operacional e quantidade de mesas.
- `ReadyStep` apresenta o resumo e solicita finalização.
- A camada `onboarding-service` continua sendo a única responsável por traduzir dados do formulário para a RPC de rascunho.
- O estado inicial vem do rascunho persistido na Tarefa 12; localStorage não participa do onboarding obrigatório.

## Persistência e navegação

- Avançar salva a etapa atual antes de navegar.
- Voltar também salva antes de navegar.
- O maior passo alcançado continua persistido, permitindo voltar visualmente sem reduzir o ponto de retomada no servidor.
- A ação fica desabilitada durante a mutation para impedir submissões duplicadas no cliente; a RPC permanece a garantia idempotente no servidor.
- Falha de rede mantém o usuário na etapa atual com os dados preenchidos.

## Erros

- Validação local usa mensagens de campo, não toasts genéricos.
- Slug duplicado é reconhecido pelo código de conflito do Postgres e associado ao campo de slug.
- Falhas inesperadas exibem uma mensagem geral sem apagar o formulário.
- Nenhuma etapa avança quando o salvamento falha.

## Testes

- Renderização das três etapas e remoção de branding/primeiro produto do fluxo obrigatório.
- Validação de nome, slug e modo operacional.
- Exibição condicional da quantidade de mesas.
- Persistência antes de avançar e voltar.
- Retomada a partir do rascunho salvo.
- Mensagem de conflito de slug no campo correto.
- Bloqueio de duplo clique enquanto salva.
- Regressão mobile dos controles e ações principais.

## Fora do escopo

- Finalização transacional, coberta pela Tarefa 14.
- Upload real de logo, coberto pela Tarefa 15.
- Persistência dos lembretes e progresso de ativação, coberta pela Fase 5, Tarefa 16.
