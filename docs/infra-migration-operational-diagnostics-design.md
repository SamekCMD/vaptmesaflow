# Diagnóstico operacional privado — desenho de fechamento

Execução autorizada pelo pedido “faça tudo isso”, em24/11/2026. O usuário mantém o orçamento e dispensou novas confirmações para passos necessários já autorizados. O contrato anterior de privacidade continua obrigatório: somente códigos fixos, sem URLs, headers, cookies, payloads, mensagens de erro ou identidades. Este desenho substitui a tentativa reprovada de Workers Logs e não a habilita.

## Escolha técnica

Usar uma binding nativa de Workers Analytics Engine nos produtores de produção, com dataset privado `vapt_operational_diagnostics_production`. API e billing compartilham somente esse destino de diagnóstico; Preview não recebe binding para produção. Não acrescentar Tail Worker, destino externo, secrets ou plano pago. A leitura usa o SQL API privado com a sessão já existente, cujo preflight constante retornou200.

Cada ponto contém exclusivamente dois valores de enum internos (componente e código) e contagem1. Index de amostragem também deriva desses enums. Escrita apenas em fronteiras de falha conhecidas; deduplicar código dentro da invocação e limitar o conjunto. A função não recebe Request, Error ou contexto de negócio. Falha da telemetria é descartada sem alterar resposta, retry ou reconciliação, e sem fallback de log bruto.

Workers Logs, traces e Issues de produtores permanecem desligados. Métricas agregadas continuam cobrindo exceções que impeçam emissão de código. Analytics Engine tem amostragem adaptativa e retenção do fornecedor; não constitui trilha completa de auditoria nem prova de entrega individual. Consultas usam `SUM(_sample_interval * double1)`.

## Prova antes de produção

Sonda privada sem DB/R2/DO/Queue/secrets de negócio; somente binding de teste e CPU restrita. Emitir eventos conhecidos e sentinelas fictícias em request e erro. Ler todas as colunas do dataset próprio e confirmar allowlist, valores esperados e ausência de sentinelas, mantendo Workers Logs desligados. Não ativar binding de produção se essa verificação falhar. Remover a sonda no encerramento; pontos sintéticos podem permanecer durante a retenção normal do fornecedor.

## Implementação e publicação

1. Testes RED→GREEN da função de emissão: valores dinâmicos rejeitados, falhas de transporte isoladas, sem serialização de erro/request e limite por invocação.
2. Integrar nos limites HTTP e cron/queue sem modificar regras de auth, billing ou retry. Testes comprovam comportamento idêntico com binding ausente, quebrada e válida.
3. Provar o dataset sintético remoto com orçamento de chamadas limitado.
4. Acrescentar bindings somente aos perfis atuais de produção, preservando recursos/flags/CPU/rates e ambientes. Testar em runtime Workers e atualizar CI; revisão independente do delta.
5. Publicar apenas os produtores alterados, com baseline exato e readback, e confirmar diagnóstico. Não trocar credenciais Stripe/Neon/R2/Resend nem repetir os fluxos de migração concluídos.
6. Registrar consultas e procedimentos de diagnóstico, quota e recuperação. Não configurar envio de alertas a terceiros ou nova automação sem destinatário/escopo aplicável.

## Custo e limites

A página oficial consultada informa que Analytics Engine ainda não é faturado e publica franquias/preços futuros. Não tratar essa informação como gratuidade permanente ou teto global da conta. O desenho registra somente falhas e impõe conjunto finito de códigos; não emite um ponto a cada sucesso e não lê o Neon. O limite financeiro anterior permanece próprio.

Referências: [escrita nativa](https://developers.cloudflare.com/analytics/analytics-engine/get-started/), [estrutura das tabelas e leitura](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), [amostragem](https://developers.cloudflare.com/analytics/analytics-engine/sampling/), [preço](https://developers.cloudflare.com/analytics/analytics-engine/pricing/).
