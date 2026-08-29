# Mercado Pago: integracao e sandbox

Documentacao verificada em 25 de julho de 2026. Este roteiro usa apenas a documentacao oficial do Mercado Pago.

## Solucao escolhida

Checkout Pro com redirecionamento para o ambiente do Mercado Pago. Cada restaurante conecta sua conta de vendedor ao Vapt por OAuth Authorization Code. A preferencia e criada server-side para cada tentativa de pagamento.

Referencias oficiais:

- [Visao geral do Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview)
- [Criar preferencia de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/create-payment-preference)
- [Referencia para criar preferencia](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/preferences/create-preference/post)
- [OAuth Authorization Code e PKCE](https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation)
- [Referencia OAuth e refresh token](https://www.mercadopago.com.br/developers/pt/reference/authentication/oauth/overview)
- [Webhooks e validacao de assinatura](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Contas de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/test-accounts)
- [Compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases)

## Aplicacao e ambientes

Criar uma aplicacao para Pagamentos online e Checkout Pro. Separar configuracao de teste e producao:

- credenciais e contas de teste nunca processam dinheiro real.
- comprador e vendedor de teste devem pertencer ao mesmo pais.
- URLs de callback e webhook precisam usar HTTPS publico.
- frontend nao recebe client secret, access token, refresh token ou secret de webhook.
- logs de sandbox seguem as mesmas regras de redacao de producao.

## OAuth Authorization Code com PKCE

### Inicio

API gera e persiste:

- `state` aleatorio, opaco, de uso unico e com expiracao.
- `code_verifier` aleatorio entre 43 e 128 caracteres.
- `code_challenge = BASE64URL(SHA256(code_verifier))`.
- `code_challenge_method = S256`.
- restaurante, usuario iniciador e redirect URI permitida.

O browser recebe somente a URL de autorizacao. O `state` nao contem dados sensiveis.

### Callback

1. validar existencia, expiracao, tenant e nao reutilizacao do `state`.
2. consumir o `state` de forma atomica.
3. trocar `code`, `code_verifier`, client ID/secret e redirect URI no endpoint `/oauth/token`.
4. cifrar access/refresh tokens antes de persistir.
5. consultar identidade/conta conectada e salvar IDs externos.
6. redirecionar o usuario ao painel sem tokens na URL.

A documentacao oficial informa que o authorization code possui validade curta e que o access token pode ser renovado com `refresh_token`. A renovacao ocorre no backend sob lock para evitar duas trocas simultaneas.

## Checkout Pro

### Criacao da preferencia

API carrega pedido e itens do banco e envia ao Mercado Pago:

- itens com titulo, quantidade, moeda e preco calculado pelo servidor.
- `external_reference` vinculada a transacao/pedido interno.
- `notification_url` da API.
- `back_urls` HTTPS permitidas.
- expiracao coerente com a politica do pedido.

Uma nova preferencia e criada para cada tentativa financeira. A idempotency key do Vapt impede criacao repetida pela mesma acao.

### Retorno

O redirect de sucesso, pendencia ou falha serve somente para experiencia do usuario. A pagina de retorno consulta `GET /orders/:orderId/payment` usando a API; parametros da URL nao alteram o estado financeiro.

## Webhook

Rota planejada:

```text
POST /webhooks/payments/mercado-pago
```

Para o topico `payment`, o Mercado Pago envia `x-signature`, `x-request-id` e o identificador em `data.id`. A API deve usar o validador oficial do SDK ou reproduzir exatamente o algoritmo HMAC documentado.

Processamento:

1. capturar headers, query e raw body sem transformacao destrutiva.
2. validar assinatura com o secret da aplicacao/ambiente.
3. reservar `external_event_id` antes de efeitos.
4. responder `200`/`201` rapidamente apos persistencia segura.
5. consultar `GET /v1/payments/{id}`.
6. comparar conta coletora, external reference, transaction/order IDs, moeda e valor.
7. normalizar estado e aplicar transicao atomica com outbox.
8. duplicatas retornam sucesso sem repetir efeitos.
9. falhas transitorias permanecem reprocessaveis e reconciliaveis.

O Mercado Pago documenta novas tentativas quando nao recebe resposta de sucesso dentro da janela esperada. Por isso, processamento precisa ser idempotente e o endpoint nao deve esperar notificacao, impressao ou cozinha.

Topicos da V1:

- `payment` para alteracoes de pagamento do Checkout Pro.
- eventos de contestacao ficam registrados como extensao futura e nao aplicam estorno automatico na V1.

## Estados externos e normalizados

| Estado Mercado Pago | Estado Vapt |
| --- | --- |
| `pending`, `in_process`, `in_mediation` | `pending` ou `processing` |
| `approved` | `paid` apos todas as validacoes |
| `rejected` | `failed` |
| `cancelled` | `cancelled` |
| `refunded` | `refunded` |
| `charged_back` | evento de risco; bloqueia automacao otimista e exige tratamento operacional |

Um evento desconhecido e persistido para auditoria e nao altera a transacao.

## Cancelamento e estorno

- cancelamento so e solicitado para pagamento ainda cancelavel.
- estorno V1 e apenas total e exige transacao `paid`.
- `partialRefunds` permanece `false` e solicitacao parcial retorna erro de capability.
- o Vapt registra solicitacao e resultado; nunca apaga a transacao paga.
- estados finais sao confirmados consultando o provider quando a resposta nao for conclusiva.

## Contas e compras de teste

1. criar/usar conta vendedor de teste da aplicacao.
2. criar conta comprador do mesmo pais.
3. conectar o vendedor de teste ao restaurante sandbox via OAuth.
4. iniciar compra em janela anonima para evitar mistura de sessoes.
5. usar cartoes e identidades de teste publicados pelo Mercado Pago.
6. simular aprovado, recusado e pendente.
7. testar Pix/offline quando disponivel e respeitar estado pendente ate confirmacao.
8. reenviar notificacao pelo painel e validar deduplicacao.

Dados de cartao mudam na documentacao e nao devem ser copiados para o repositorio. O executor consulta a pagina oficial no momento do teste.

## Matriz de sandbox

| Cenario | Resultado esperado |
| --- | --- |
| OAuth valido | conta ativa e tokens cifrados |
| `state` invalido/reutilizado/expirado | callback rejeitado sem troca de token |
| PKCE incorreto | conexao falha sem persistir credencial parcial |
| refresh valido | tokens trocados atomicamente |
| refresh revogado | conta entra em atencao e checkout e bloqueado |
| preferencia duplicada | mesma transacao/URL para a mesma chave |
| valor alterado no browser | preferencia usa valor do banco |
| pagamento aprovado | webhook consultado, transacao `paid`, um efeito por tipo |
| pagamento recusado | transacao `failed`, pedido nao liberado |
| webhook invalido | `401`, nenhum estado alterado |
| webhook duplicado | `200`, nenhum efeito repetido |
| webhook fora de ordem | estado terminal nao regride |
| banco indisponivel | provider retenta; evento nao e descartado |
| redirect antes do webhook | tela mostra pendencia e consulta API |
| estorno total | transacao `refunded` e auditoria preservada |
| estorno parcial | rejeitado por capability |

## Checklist para producao

- URLs HTTPS definitivas cadastradas.
- CORS e redirects restritos aos dominios Vapt.
- secret de webhook de producao separado do sandbox.
- chave de cifragem versionada e backup operacional.
- alertas para OAuth expirado, webhook invalido, transacao pendente antiga e outbox falha.
- reconciliacao agendada sem criar cobranca.
- piloto por restaurante com feature flag.
- rollback desliga novos checkouts e preserva webhooks de transacoes abertas.
