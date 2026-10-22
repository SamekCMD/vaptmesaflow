# Promoção pareada — readiness22/10/2026

Continuação da Etapa13 e T5/9/10 do catálogo, após o encerramento local do plano de paridade. Este checkpoint prepara o procedimento; não executa promoção, SQL, flags ou merge.

## Candidatos e CI já conferidos

- F`a4eb545ff6e098ef0c8a7e3552b09d085cb34d40`, [PR#4](https://github.com/SamekCMD/vaptmesaflow/pull/4): [CI push39799968361](https://github.com/SamekCMD/vaptmesaflow/actions/runs/39799968361) e [PR39799976688](https://github.com/SamekCMD/vaptmesaflow/actions/runs/39799976688), completed/success.
- A`7d5604f404cd62b6d18a27d9851172701895faa9`, [PR#1](https://github.com/SamekCMD/vapt-api/pull/1): [CI push39800006430](https://github.com/SamekCMD/vapt-api/actions/runs/39800006430) e [PR39800006431](https://github.com/SamekCMD/vapt-api/actions/runs/39800006431), completed/success.
- São SHAs funcionais/documentais anteriores a este checkpoint; uma atualização documental posterior não é novo comportamento de runtime e exige seu próprio status de CI. Não atribuir os runs acima a outro SHA.
- Código pareado: frontend/migrations/consumidor em F; API/Worker em A. PR frontend#3 já incorporado e #2 Vercel legado encerrados sem merge. Branches/WIPs preservados. Main não integrada por opção2.

## Gates, sem confundir prova local com remota

| Gate | Evidência disponível | O que ainda impede promoção |
| --- | --- | --- |
| Paridade funcional/capabilities | 16 tarefas concluídas; revisão independente com dois Important corrigidos; F383/A701/PG92/workerd30 no checkpoint final22/10 | Não comprova o código, schema ou grants em execução |
| Qualidade/artefatos | Tipos/builds e CI dos SHAs acima aprovados; guards e dry-runs sem publicação | Nenhum artefato novo publicado por este checkpoint |
| Capacidade Neon | Readback22/10 já registrado nos PRs: free_v3, compute413311s ponderados=114,8086CU-h, ciclo1Oct→1Nov, quota personalizada ausente; dois endpoints esperados idle/disabledfalse/0,25→2CU/suspend_timeout0 | Sem evidência de capacidade restaurada; não executar SQL para reencontrar a cota esgotada, não contratar Paid ou criar projeto substituto |
| Schema/grants tenant | Migrations010–012 e grants ensaiados em PostgreSQL descartável, incluindo permissões restritas | Backup e aplicação/readback remotos em ordem, sob gate e protocolo de drain; 001–009 intactos |
| Writers/clientes ativos | Inventário canônico local atualizado; gateways Worker e clientes testados | Confirmar quais versões/processos realmente escrevem, inclusive Node/Coolify; nenhum bypass ativo antes do reader |
| R2/DO e CPU | Recursos privados preparados historicamente; local workerd/SQLite; CPU configurada1000ms e snapshot limitado8MiB | Readback atual de privacidade/bindings, workload/CPU suportado, publicação e rollback compatível; tempo de parede não é CPU |
| Bootstrap e canário | CLI estrito, sessão protegida e UUID explícito; dry-run0writes nos dois ambientes | Capacidade, permissões e writer controlado antes de apply; ready/recuperação e reader canário separados |
| Operação/custos | Workers Paid já ativo; rates/limites existentes, meta pessoalUS$10–15/máximoUS$20 | Estabilidade/consumo real, backup final e dependência zero; limites não são teto global de cobrança |

Os números de testes são evidências datadas já executadas, não novas execuções completas neste checkpoint documental. Logging persistido reprovado continua desligado; esta continuação não reprojeta observabilidade nem cria alertas/automação.

## Conferência local desta continuação

Conferidos os fontes A`src/worker/routes/{account,restaurant,misc}.ts`, `src/worker/catalog/writer.ts` e `scripts/bootstrap-public-catalog.ts`, no HEAD`7d5604f`. O operador usa GET/POST do mesmo restaurante explícito; `/me` não é necessário e a preferência não é autoridade.

Checks offline `node scripts/catalog-operator.mjs check preview` e `check production`: exit0/oktrue, **activationReadyfalse**, gates pendentes explícitos. A lista conservadora do operador não é um leitor do ledger de testes: `postgres-integration`/`final-review` nela não anulam as provas locais já registradas, nem as convertem em provas remotas.

CLI real, sem `--apply`, com UUID sintético `30000000-0000-4000-8000-000000000001` em preview e production: exit0, `targets:1`, `writes:0`, `mode:dry-run`. Por implementação, esse caminho retorna antes de ler sessão ou chamar fetch. Não houve GET de catálogo, bootstrap remoto ou fixture criada.

Testes focados executados nesta continuação: `npm run test:catalog-config`69/69 e `npm run test:catalog-bootstrap`27/27, exit0. Adaptadores de rede/provedor são sintéticos nos testes; o caso nomeado "inert apply" não executa apply remoto. Não foi necessário fabricar RED ou alterar código de runtime para corrigir a documentação humana.

## Ordem futura corrigida — não executar agora

1. Congelar SHAs compatíveis e conferir CI; não juntar branches antigas sem análise de comportamento nem ativar auto-merge.
2. Fechar capacidade e backup/restauração, bloquear admissões incompatíveis e drenar comandos/claims com consumers compatíveis. Não descartar journal, efeitos aceitos, leases ou dados.
3. Aplicar/validar schema e grants canônicos na ordem; preparar API/consumidor e frontend de recibos compatíveis, inicialmente sem reader. Conferir os recursos/configuração reais de cada ambiente.
4. Somente depois dos gates e autorização de janela/canário: disponibilizar writer e cliente compatível sob controle, ainda readerfalse. O rebuild é writer-only; com writerfalse recebe404. Não habilitar reader ou aceitar tráfego irrestrito para fazer esse ensaio.
5. Bootstrap autenticado do alvo explícito com operationId preservado; confirmação manual de publicação/recuperação, privacidade e CPU antes da liberação ampla. Resposta perdida não autoriza outra chave ou retry automático.
6. Reader/frontend canário após snapshots prontos e ausência de bypass. Produção repete os gates com seus IDs/segredos próprios, reutilizando o código, não recriando funcionalidades.
7. Em rollback, manter executor de efeitos aceitos e versão compatível com schema tenant; nunca owner-only depois de dados multi-tenant. Reader desligado não equivale a desfazer um commit.
8. Só após estabilidade/consumo e backup/dependência zero retomar desligamento/cancelamento de Hetzner. Não repetir DNS Vercel nem procurar Easypanel.

Decisão documental: corrigir "bootstrap antes de writer" para refletir a guarda real, sem alterar seu código nem afrouxar gates. Custo se a interpretação estiver errada: o procedimento precisará ser ajustado antes de qualquer ação remota; nenhuma flag foi ligada por esta decisão.

Resultado: preparação local de promoção atualizada; catálogo permanece7/10 formalmente e Etapa13 aberta. Os próximos passos operacionais precisam de capacidade/evidência e autorização do gate, não de outra rodada de testes locais já aprovados.
