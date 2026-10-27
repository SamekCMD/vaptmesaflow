# Controlador da janela writer-only — 27/10/2026

O controlador fixo foi composto e executado **somente em modo `inspect`**. O preflight real passou com zero escritas remotas/SQL de escrita. Nenhum catálogo foi ativado e nenhuma publicação foi tentada.

## Limites do controlador

Arquivo operacional: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/production-catalog-writer-v1-controller.mjs`.

Ele reutiliza as [primitivas já testadas](infra-migration-catalog-writer-publication-preparation-2026-10-27.md) e os artefatos congelados, sem recompilar. `inspect` só faz GETs nos provedores, consultas de identidade/schema/grants/integridade e contagens agregadas em duas sessões PostgreSQL READ ONLY. Credenciais existentes ficam em memória; não há instalação, conexão por navegador, arquivo de secrets ou novo recurso.

Uma futura execução `publish`, condicionada à autorização da janela, faz apenas esta passagem:

1. Journal exclusivo e preflight novo de fontes, pacote frontend, controles e banco.
2. API HTTP em manutenção com o wrapper503 sobre o módulo canônico atual, preservando classes/exports.
3. Sessão/upload de assets e publicação do frontend com writer/recibos e imagensR2, reader/eventos desligados; `_headers` na configuração privada, proof fora da publicação.
4. Readback dos90 assets públicos e cache headers, arquivos privados não expostos, estado protegido e API ainda em manutenção.
5. Nova conferência do par; publicação do mesmo módulo API com writertrue/readerfalse e readback de código/recursos/configuração/health.

A manutenção usa o endpoint de conteúdo; a alteração de bindings usa o endpoint completo do script. Não confundir os dois: atualizar só o conteúdo não é uma prova de mudança da flag. O transporte só permite esses endpoints fixos e os uploads do frontend, com número limitado de tentativas, ordem fixa, redirect proibido, deadlines e limites de resposta. Não permite writes no billing, fila, recursos, preview ou DNS. Após resposta de escrita perdida/rejeitada, impede novas escritas; o journal impede replay da operação completa. Não há retry, rollback ou reabertura automática.

Os readbacks permitem somente o deployment da etapa correspondente e, na última, a única mudança de flag prevista. Qualquer delta de fila/Cron, namespaces, privacidade, CPU, bindings, origem ou outro Worker interrompe a sequência. Readback de fonte compara os bytes reais; confirmação da API não se baseia só em health200. A entrega de emails e a cobertura runtime dos writers continuam provas independentes.

## Resultado real do inspect

Inspeção iniciada em `2026-10-27T19:53:34.284Z`, concluída com exit0:

- `ok=true`, `remoteWrites=0`, `schemaWrites=0`, `attempted=[]`, `confirmed=[]`.
- API `e2d1a9fb-c015-4876-8063-101017383280` / versão `baa2eff4-d3a8-4b96-978f-ae3e6c644319`, código canônico e health200.
- Billing `e9db2125-fec9-4871-9854-d7532f54dc19` / `b156056a-c5b5-4f14-94c3-65bfd6097fd6`, código preservado, fila com entrega habilitada e Cron `*/30 * * * *`.
- Frontend atualmente publicado `80be8dff-3cba-490e-b631-515d628cc7f9` / `adca3965-b132-4837-96ba-2e647b08d1c4` — ainda o build anterior, catálogo-off.
- API CPU1000ms, seis rate limits, oito secrets por nomes/tipos, Hyperdrive, imagens, os dois namespaces SQLite e tag de migrations existentes conferidos; bucket privado de catálogo sem r2.dev/custom domains.
- Candidato frontend:91 arquivos de build conferidos/90 assets públicos, sem novo build; reader/eventos false, recibos/writer true e imagensR2 somente no candidato local.
- Neon: projeto/branch/endpoint de produção fixos, quota216000s e compute0,25–0,25CU preservados; owner e role de aplicação autenticaram com TLS1.3 verificado, `transaction_read_only=on`.
- Integridade tenant/billing e grants mínimos do catálogo aprovados. Contagens agregadas atuais:0 restaurantes e0 operações de catálogo. Isso é observação, não pré-condição de apagar dados ou recriar banco vazio.

O gate usa SELECTs sem retornar identidades/payloads, permite contagens não zero e fecha ambas as conexões em sucesso/falha. A credencial obtida para autenticar a role não comprova por si só o valor instalado no Hyperdrive; o relatório mantém `workerCredentialVerified=false`. Não foi executada nenhuma mutação funcional, bootstrap ou teste de imagem.

## Testes e artefatos

- Transporte/readbacks:9 testes RED por implementação ausente → GREEN.
- Readiness de banco:8 testes RED por implementação ausente → GREEN; inclui compute fora do limite, TLS não autorizado, grants/schema ausentes, billing cruzado e role administrativa.
- Primeira rodada: todos os operadores root192/192; aplicação383/383 em74 arquivos,34,09s; zero falhas/skips. Nenhum novo teste de email, canário, integraçãoPG ou build repetido.
- Recibo operacional: `production-catalog-writer-v1-inspect-2026-10-27T19-53-34.284Z.json`, no workspace próprio do plano.
- SHA256 do recibo: `0a388d70256c2c7a62695e58a01e1299d1b55e8f92a0710daa176e6765c2e03a`.
- Controlador SHA256 `ae62bd22d35c87b81ce7b73acd30c24a7c7ef1cd259f215a0496a410ab2a2da4`; transporte `a150b16bc94db9dc83a00faeb2c2ce0d38f0b839db001b7c5a9c963d36f013ee`; gateSQL `9cf609a2fb2d534fae779ec97ffb835497314857f9f724d31049e343e9888978`.
- Logs: `catalog-controls-red.log`, `catalog-controls-green.log`, `catalog-production-db-red.log`, `catalog-production-db-green.log`, `catalog-controller-root-tests.log`, `catalog-controller-project-tests.log`.

## Revisão independente e correção

Uma única revisão read-only, por `catalog_writer_controller_review`, examinou os oito módulos/testes de publicação, o controlador e os requisitos. Sem chamadas remotas, edits, novo worktree ou reexecução de suítes pelo revisor. Não encontrou crítico ou minor; apontou um importante: o JWT da sessão pode informar `wrangler_single_asset_uploads=true`, modalidade para upload raw por hash não implementada neste operador bulk.

A constatação foi conferida diretamente no Wrangler instalado, que seleciona a modalidade pelo payload do JWT e não oferece um seletor bulk na requisição de sessão. Corrigido o uploader para **recusar a modalidade single-asset antes do primeiro upload se houver arquivos faltando**, sem ampliar os endpoints permitidos. A leitura desse campo é discriminação de protocolo, não autenticação; o provedor continua validando o token original.

Dois testes novos com JWT estrutural realista falharam antes da correção: uploader isolado e composição com o protocolo/journal real. Depois passaram, provando zero upload/PUT frontend/PUT writer, nenhuma repetição e journal consumido. Uma caracterização adicional confirma que uma sessão sem arquivos faltando pode usar seu completion token sem executar protocolo de upload. A suíte dos operadores após a correção passou195/195; regressão final da aplicação383/383 em74 arquivos,34,76s, sem falhas/skips.

Após a correção, outra verificação offline conferiu novamente os91 arquivos e transmitiu/comparou90 assets apenas em memória, zero rede, sem refazer build ou canário. Recibo `catalog-writer-offline-artifacts-2026-10-27T20-01-23.675Z.json` no workspace próprio.

Uploader corrigido SHA256 `7f7a7e0e5bb2b807ddc1d7dfefd16d6a52e59706dbc57cfbff1e8dfe5385bc78`. Logs adicionais: `catalog-single-asset-rejection-red.log`, `catalog-single-asset-rejection-green.log`, `catalog-controller-final-root-tests.log`, `catalog-controller-final-project-tests.log`. O inspect não cria sessão de assets e não exercitou esse ramo remoto; sua prova de recursos/banco não foi transformada em prova de upload. Sem segundo ciclo de revisão.

Comportamentos que o revisor deixou fora do parecer, e decisões do executor:

- Modalidade atualmente escolhida pelo provedor: desconhecida, pois inspect é read-only. Não criar sessão só para investigar. Se for modalidade não suportada na janela, parar **ainda em manutenção**, preservar o journal e reconciliar antes de um reparo autorizado. O custo dessa decisão é a possível necessidade de reparo manual, não uma publicação improvisada.
- Cobertura funcional dos writers/clientes/imagens, bootstrap, reader e entrega billing: continua pendente nos gates próprios. Esta janela não autoriza concluir essas funcionalidades nem ativar o reader; o custo é manter essas provas abertas.
- Estado após o inspect: o parecer não fez nova consulta. O publish exige novo preflight completo e reconferências de estado; uma mudança concorrente pode consumir o marcador e interromper a operação, sem retry automático.

O marcador `production-catalog-writer-v1-start.json` permanece ausente: publicar ainda não foi iniciado. Preservar os journals consumidos de schema/admissão/billing e não trocar seus nomes para contornar replay.

## O que esta prova não encerra

Não confirma execução natural do Cron/entrega pelo Resend, todos os writers/clientes/imagens ativos, CPU de toda carga possível, bootstrap de futuros restaurantes, reader público ou teto global da fatura. O writer-only é o próximo gate operacional; reader/bootstrap e a validação funcional mantêm suas condições próprias.

O subplano continua7/10, tarefas5/9/10 e Etapa13 abertas. Sem push/merge/main, DNS, serviços pagos ou nova credencial. A janela de publicação não deve ser inferida do sucesso dos testes/inspect.
