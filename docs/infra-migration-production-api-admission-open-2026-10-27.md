# API production liberada — 27/10/2026

## Estado atual confirmado

Após autorização explícita do usuário, a API saiu da manutenção às01:32SP, pelo domínio existente `https://api.vapt.app.br`. Novo deployment`e2d1a9fb-c015-4876-8063-101017383280`, versão`baa2eff4-d3a8-4b96-978f-ae3e6c644319`,100%.

Foi feita **uma única escrita content-only**: módulo congelado `realtime-entry.js`,4754027bytes, SHA256`7205822d6931cef363c3730c0f9ecd553a671857a79cdff678203e0c7cec8f94`, agora como main. A resposta fixa503 não está mais ativa. Não houve rebuild ou mudança da aplicação, configurações, secrets, limites, bindings, namespaces, ingress, rotas ou DNS.

Os12controles remotos autorizados passaram: GET/HEAD health200; quatro rotas privadas401 sem Cookie; catálogo/novo socket404 com flagsfalse; realtime403 sem origem; rota inexistente404; preflight204 e401 com CORS correto para o frontend. Nenhum Set-Cookie, POST, fixture, signup, Checkout, webhook, email ou pagamento foi disparado por esses controles. A contenção503 sobre o mesmo módulo tenant foi testada localmente, mas **não foi necessária nem executada remotamente**.

Outro processo GET-only às01:33:40SP confirmou a versão, o main, os bytes e as configurações; repetiu seis controles anônimos, health200 e CORS. API permanece aberta. Não é canário privado: os endpoints normais existentes voltaram a ficar disponíveis na internet, protegidos pelos mecanismos da aplicação.

## Proteções e componentes preservados

- API CPU1000ms;8secrets somente por nomes/tipos; Hyperdrive e bucket de imagens existentes; seis rate limits; RestaurantRealtime e PublicCatalogCoordinator preservados; logs/tails não ativados.
- Catálogo reader/writer continuamfalse; bucket de snapshots permanece privado. Frontend events/writer continuam nos valores congelados, sem ativação.
- Billing versão`b156056a-c5b5-4f14-94c3-65bfd6097fd6`, cron vazio e fila pausada; consumer/settings/DLQ preservados, backlog aproximado0. Retenção da fila continua86400s — pausa não a torna infinita.
- Frontend versão`adca3965-b132-4837-96ba-2e647b08d1c4` inalterada. O readback desta rodada amostrou raiz/CSS e fallback de `_headers`, com cache correto; não apresenta essas duas amostras como nova verificação integral dos91assets, já conferidos anteriormente.
- Nenhuma alteração de SQL/schema/grants, plano pago, Access/bearer, DNS/main/push ou legado.

Antes da abertura, a conferência SQL somente-leitura às01:30:21SP confirmou schema`b28390b5839143e11b99d9c82b427fc44f3b11aaadd237f8f8731cd0a32294fe`,30tabelas vazias, integridade, conexão real `vapt_api_production` com cinco leituras permitidas/payload privado negado, TLS1.3, quota216000s e compute0.25CU fixo. Isso é uma fotografia **anterior à abertura**: novos dados legítimos não devem ser apagados para fazer esse contador voltar a zero. Não reaplicar009–012 ou restaurar backup por causa de mudanças após a liberação.

## Operador e evidências

Implementação local nova `scripts/production-api-admission.mjs`, sem CLI, autenticação ou transporte padrão. Gate exclusivo, no máximo uma abertura e uma contenção autorizada. Escrita/resposta/readback incertos param sem retry ou contenção cega; controles HTTP falhos após confirmação exigem rechecagem exata antes de503 com o mesmo código tenant. Nunca restaura código owner-only nem schema. Probe só usa12GET/HEAD/OPTIONS fixados, sem Cookie/redirects, resposta limitada e diagnóstico sem conteúdo privado.

Testes:16novos casos do operador/probe/journal passaram após falhar pela implementação ausente;86guardas relacionados passaram; frontend383/383em74arquivos,35.82s. Fonte runtime permaneceu igual; não se repetiu a suíte API704 ou os ensaios PG/provedores como se fossem evidência nova desta liberação.

Workspace `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`:

- Controlador consumido `production-api-admission-v1-controller.mjs`, SHA256`e611273678039c10d8bd595397d3b483a034d6b818c42ad88f48f6820e2eb25f`. Não alterar/reexecutar.
- Journal `production-api-admission-v1-start.json` e fases `api_attempt`, `api_confirmed`, `probes_confirmed`; sem fases de contenção. Preservar todos os journals anteriores.
- Recibo `production-api-admission-v1-2026-10-27T04-32-08-277Z.json`, SHA256`c606878635cc5c4b1c676b83c8496808d5428e284f357ed83e38f57bf0701466`, ok=true/uncertain=false/uma escrita.
- Readback independente `production-api-admission-independent-2026-10-27T04-33-40-526Z.json`, SHA256`8d8a28bd99c049f9d20039bb457ab0e9aaa3f6e9038c99ebb70237a029043b0e`, ok=true/readOnly=true/remoteWrites0.
- SQL pré-abertura `production-schema-v2-postflight-2026-10-27T04-30-21-460Z.json`, SHA256`0768f793433b1b59ee180a91043651e2de485d247db20f5535aa734497826b53`.

Os scripts antigos que exigem503 ou versões anteriores são registros históricos, não verificadores do estado atual. O operador consumido não é comando de rotina.

## Próximos gates

A retirada da manutenção e os controles de admissão estão concluídos. **Não** certificam login positivo/CRUD multi-tenant, permissões de equipe/unidades, fluxo autenticado de billing, ativação/recuperação do catálogo, entrega de provedores ou estabilidade/CPU faturada. Próximo: validar sessão e operações/isolamento por unidade de forma controlada; depois retomar billing e avançar os gates próprios de catálogo. Sem habilitar tudo junto nem repetir funcionalidades/provedores já comprovados sem necessidade específica.

Etapa13/T5/T9/T10 continuam abertos até seus contratos de conclusão. Integração canônica na main/CI, estabilidade, backup final e confirmação do legado restante seguem no plano. Nenhum teto global de fatura é garantido por esta abertura.
