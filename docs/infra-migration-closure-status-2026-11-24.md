# Fechamento da migração — estado em 24/11/2026

Este é o resumo atual de encerramento. Seções de outubro e checklists sem marcação no plano original são histórico e critérios de aceitação, não uma nova lista de trabalho a repetir.

## Delta recente preparado para integração

As branches de trabalho foram avançadas por fast-forward às mains já existentes, após comprovar que as árvores commitadas eram idênticas; alterações locais foram preservadas. A API recebeu o commit `1a391f4153a25147a29fcc37d0dcda0acf05cb68` e o [PR#2](https://github.com/SamekCMD/vapt-api/pull/2), separado dos PRs principais já merged. A documentação desta continuação segue em PR próprio no frontend. Esse é o único delta novo a integrar, sem refazer os merges anteriores.

Verificação local atual: API712/712, runtime Workers32/32, guards/operador66/66, frontend385/385, TypeScript API e dry-run do perfil Live aprovados. Revisão independente do delta API sem achados acionáveis. CI remoto do novo SHA está em acompanhamento; os testes locais não substituem esse resultado. Nenhum arquivo pessoal ou alteração local alheia foi incluído por inferência.

## Concluído com evidência

| Frente | Evidência atual |
| --- | --- |
| Consolidação principal frontend/API | GETs GitHub em24/11, antes dos novos PRs de fechamento, confirmaram frontend#4 e API#1 merged em10/11 e listas abertas vazias |
| Main frontend | `04a3e75f00c867796a6351bb60aaeed711eda294`, merge de `2fe605e` |
| Main API | `12596fa0a4fa098aaeaaff03b048bf3320ef4759`, merge de `068b0fb` |
| Produção na Cloudflare | Site/API publicados; correções da main publicadas em10/11 e Stripe Live configurado em24/11 |
| Neon, Hyperdrive, Better Auth, R2, catálogo e realtime | Arquitetura nova em produção; catálogo reader/writer/realtime ligados e recursos separados por ambiente |
| Billing assíncrono | Consumidores/fila/Cron30min já preparados e retomados; não contratar/recriar recursos para encerrar o plano |
| Backup e restauração | Dump production10/11 restaurado e comparado em30tabelas; recibo e hash no registro próprio |
| Aposentadoria Hetzner/Coolify | Servidor excluído pelo usuário, projeto sem recursos remanescentes e testes públicos após exclusão em10/11 |
| Stripe Test | Pagamento Pro, webhooks reais, estado Neon/API e cancelamento validados; fixture aposentada |
| Stripe Live técnico | API versão41 com sete bindings Live, webhook habilitado e recursos preservados; nenhum pagamento real realizado |

Fontes: [PR frontend#4](https://github.com/SamekCMD/vaptmesaflow/pull/4), [PR API#1](https://github.com/SamekCMD/vapt-api/pull/1), [produção e aposentadoria](infra-migration-production-stability-2026-11-10.md), [backup restaurado](infra-migration-production-backup-2026-11-10.md), [catálogo ao vivo](infra-migration-catalog-live-production-2026-11-10.md), [Stripe Test](infra-migration-stripe-test-new-account.md), [Stripe Live](infra-migration-stripe-live-readiness.md).

## Duas frentes técnicas restantes

1. **Integrar o delta recente.** O código e as configurações da nova conta Stripe e seus registros ainda têm alterações locais. Conferir refs atuais, testar/revisar somente esse delta, versionar arquivos pertinentes e integrar com CI. Preservar alterações alheias, branches antigas e worktrees. Os dois PRs principais já integrados não precisam de novo merge. O novo perfil Live agora foi incluído no workflow local de CI com teste e dry-run, sem deploy automático.
2. **Fechar a conferência operacional.** Reconciliar a definição de pronto com os recibos existentes; conferir o estado atual de uso/limites e observabilidade/diagnóstico, os procedimentos de recuperação e o manifesto final das versões. Registrar lacunas reais e comprová-las sem repetir os canários, restaurações ou janelas já aprovados. O registro de observabilidade de outubro contém pendências de logs/alertas que exigem reconciliação; métricas agregadas não equivalem a logs sanitizados ou teto financeiro.

O consumo confortável informado é US$10–15 e a capacidade financeira máxima é US$20; nenhum limite monetário global foi comprovado. Verificação de consumo é parte do encerramento operacional. Não contratar serviços, garantir teto de fatura ou ativar persistência de logs com dados de requisição por inferência.

## Duas pendências para cobrança comercial

- **Stripe liberar o cadastro.** Último GET confirmou cadastro enviado, zero campos atualmente devidos e verificações pendentes; recebimentos e saques ainda desabilitados. A conexão técnica está instalada. Uma entrega real Live e o ciclo de cobrança comercial ainda não foram comprovados; não criar pagamento real automaticamente.
- **Definição fiscal brasileira.** Preços já são totais finais com impostos incluídos. Categoria SaaS apresentada ao titular ainda não confirmada; Stripe Tax não cobre o Brasil na consulta registrada, e nenhuma alíquota ou automação de recolhimento foi inventada. Esta frente exige definição fiscal própria, sem reabrir a migração de banco/infra.

## Escopo e estimativa

A infraestrutura principal já foi migrada e a integração principal das branches já aconteceu. O restante técnico é fechamento do delta recente e aceites operacionais, não uma nova implantação de todos os serviços. Não há medida de horas ou percentual global suficientemente confiável para prometer um prazo. O tempo de análise cadastral da Stripe e a definição fiscal não são controlados pela execução do código.

Preços trimestrais/semestrais/anuais futuros permanecem preparados e inativos em Test, conforme solicitado. Disponibilizá-los no produto exige um trabalho futuro de periodicidade; não reabrir essa expansão como condição para encerrar a migração atual. UI completa de convites de equipe não foi comprovada como funcionalidade anterior e não deve ser declarada restaurada nem criada silenciosamente neste encerramento.
