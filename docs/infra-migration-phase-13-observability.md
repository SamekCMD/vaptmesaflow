# Etapa 13 — observabilidade e proteção de custo

## Linha de base verificada em 14/10/2026

Consultas somente leitura ao control plane e GraphQL da Cloudflare, com OAuth existente em memória. Nenhuma invocação de teste, fixture, email, pagamento, deploy, assinatura ou configuração remota foi criada nesta rodada.

Readback estrito confirmou API `914f79f0-b679-45a2-a0c0-069acd87aa23` e frontend `e77339dd-59ea-44dd-a790-660076570810`, realtime ativo, CPU de 1000 ms, seis limitadores existentes, mesmos Hyperdrive/R2/DO e oito nomes de secrets. API workers.dev/Preview URLs desligados, zero Cron, Stripe Test e R2 privado preservados. Nenhum valor de secret foi registrado.

Janela UTC `2026-10-10T00:00:00.000Z`–`2026-10-14T15:35:05.952Z` (fim às 12:35:05 em São Paulo), exclusivamente `vapt-api-production`, após o gate browser de 09/10. Resposta com 106 grupos, abaixo do limite de 1000: soma de 317 requisições, zero invocationErrors, todos os outcomes `success`. Maior P99 **de grupo** de 95.992 ms; schema remoto confirmou unidade original em microssegundos, convertida em ms.

| Dia UTC | Requisições | Invocation errors | Maior CPU P99 de grupo (ms) |
| --- | ---: | ---: | ---: |
| 10/10 | 18 | 0 | 65.304 |
| 11/10 | 27 | 0 | 21.038 |
| 12/10 | 243 | 0 | 76.195 |
| 13/10 | 23 | 0 | 95.992 |
| 14/10, parcial | 6 | 0 | 34.302 |

Isso é observação retrospectiva de tráfego baixo, não teste de carga ou monitoramento contínuo. `success` é outcome de execução, **não HTTP 2xx**; não certifica ausência de 500 tratados, login, dependências ou todos os endpoints. Somar ou tirar a média dos quantis por grupo não fornece P99 global, CPU total/fatura ou máximo absoluto. Não identifica a origem das chamadas, nem prova que uma versão ficou ativa durante toda a janela. [Semântica oficial das métricas](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

## Lacunas constatadas

O control plane retornou `observability:null`: não há evidência de Workers Logs persistidos habilitados na API. Métricas agregadas acessíveis não equivalem ao checklist de logs, alertas e resposta a incidentes concluído. A consulta de subscriptions retornou indisponível (`null`), **não** plano gratuito, assinatura cancelada ou custo zero; a ativação Paid anterior permanece evidência histórica, sem nova validação financeira nesta rodada.

Nenhum alerta foi criado, testado ou certificado. Não foram consultadas métricas de billing/frontend/R2/DO/Neon/Resend/Stripe nem a fatura da conta. A janela não encerra a Etapa 14 nem autoriza desligar Coolify/Hetzner. Capacidade, observabilidade mínima operacional e cutover final continuam abertos.

## Próximo gate, sem ativação implícita

Antes de habilitar persistência, fechar o contrato de dados permitido e testar sanitização: sem cookies, headers, query strings, URLs assinadas, tokens de pedido/auth/realtime, emails, payloads ou exceções brutas. Invocation logs automáticos incluem método e URL; não ligar a configuração padrão indiscriminadamente. Logs de aplicação, exceções da plataforma, tracing e invocation logs precisam ser avaliados separadamente. [Workers Logs e sampling](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

Depois validar configuração limitada de retenção/sampling, readback e diagnóstico sintético sem PII; confirmar cobertura de API/billing, backlog/outbox e dependências. Definir e testar alertas de falhas, atraso/backlog e crescimento de uso, com destinatário e resposta operacional explícitos. Não criar uma automação de monitoramento ou enviar notificações apenas porque este runbook descreve o gate.

CPU de 1000 ms e rates já ativos limitam partes do abuso, não a fatura total. Volume de requisições rejeitadas, DO/R2 e provedores podem gerar excedentes; não aumentar CPU/remover CAPTCHA ou enfraquecer auth para perseguir custo zero. Consultar o uso real da conta e o preço vigente antes de ativar qualquer coleta adicional. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Evidência e reprodução

Operadores existentes no scratch da Etapa 13: `realtime-runtime-readback.mjs` e `read-production-metrics.mjs`, ambos exit 0 nesta rodada. O segundo teve somente o início da janela fixado em 10/10, mantendo a consulta abaixo de uma semana; não houve mudança em código produto. Saída agregada em `observability-20261014-post-gate.log`, sem request URL/body/headers ou credenciais.

Consulta exploratória mais ampla de 07/10–14/10 retornou 950 grupos; não é a evidência usada na tabela. Primeira agregação PowerShell converteu timestamps automaticamente e falhou ao agrupá-los como strings: seu resultado foi descartado. Reprocessamento preservou strings e comparou DateTimeOffset UTC; uma nova consulta delimitada confirmou 106 grupos/317 requisições. Não houve repetição de tráfego ou correção de runtime por causa desse erro local.

Checklist atual: linha de base de métricas **verificada**; logging seguro, alertas/cobertura, capacidade e estabilidade ampla **pendentes**. Main, DNS e infraestrutura existente inalterados.
