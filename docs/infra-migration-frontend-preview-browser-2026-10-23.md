# Frontend candidato + API real de preview — 23/10/2026

## Resultado

**Gate aprovado, controlador encerrado exit0, limpeza confirmada** às18:56UTC. Uma execução autorizada; sem nova tentativa, segunda renovação ou replay do smoke de68checks. Frontend local candidato F`efa6373`; ferramentas API no checkpoint`f049819`, produto API continua no bundle de`7689ec5`. Não houve publicação do frontend ou upload de código API.

Uma renovação exclusivamente do bearer do preview nomeado `stage11-inert` criou deployment**32**, `35fd7ac3-2601-46bb-adec-39ef46813131`, anterior31`6110a9fe-0ee6-4faa-920e-23f73f7a504d`. Guard pré/pós preservou código/bindings/recursos/secrets restantes, Access, catálogoR2privado, Hyperdrivepreview/cacheoff, controles production/web/top-level, CPU1000 e reader/writerfalse. Inspect final independente confirmou32, `cpuWorkloadVerified:false` e `activationReady:false`. Nenhuma ativação de catálogo ou prova de CPU/carga foi inferida.

Preflight: Access1h no aplicativo existente, quota Neon216000 e endpointpreview0,25CU sem alteração; conexão TLS e contagens READ ONLY iniciaiszero. Sem ServiceToken, plano/recurso novo, schema/grants, produção, DNS, main/push, email ou pagamento.

## O que foi observado no Brave

| Cenário | Prova observada |
| --- | --- |
| Owner em unidadeA | Cozinha real, navegação de gestão e Business carregaram |
| Seleção A→B | Um PATCH de preferência respondeu204; URL/contexto mudaram paraB |
| Recarga e reabertura sem parâmetro | UnidadeB preservada; nova consulta sem `restaurantId` retornouB pela preferência real |
| Capacidade Business | Seletor listou duas unidades; criação mostrou2de25 e continuação habilitada, sem iniciar onboarding |
| Logout | Menu→Sair voltou a/login; cookie antigo recebeu401 no servidor; nova navegação protegida voltou novamente a/login |
| Staff | Cozinha permitida e badgeEquipe; sem Cardápio/Aparência/cobrança na navegação |
| Criação por URL | Mensagem de falta de permissão e continuação desabilitada |
| Cobrança por URL com unidade válida | Mensagem de falta de permissão; **zero chamadas staff ao endpoint de assinatura** |

Sem unidade selecionada/preferida, a primeira navegação staff a/subscription foi corretamente encaminhada ao seletor, não ao conteúdo de cobrança. O bloqueio específico foi então conferido com UUID próprio explícito. Não apresentar o redirecionamento inicial como defeito nem como a prova final de negação.

Primeiro ingresso pela automação foi recusado no guard local antes de qualquer chamada do adaptador. Diagnóstico limitado aos metadados públicos mostrou `Origin:null`, `Sec-Fetch-Site:cross-site`, navegação/documento. Uma página estática loopback, sem credenciais ou proxy, forneceu âncoras para navegação normal same-site; os guards não foram removidos. Nenhuma mudança remota ou renovação adicional para contornar esse ingresso.

## Fronteira da prova

React, roteamento, Better Auth client e consultas do candidato são reais; HTTP de negócio chegou à API real do preview. **AccessJWT/bearer/cookies Better Auth permaneceram no servidor local em memória.** Logins de owner/staff ocorreram server-side; somente DTOs projetados, sem token de sessão, chegaram ao navegador. Portanto não certifica login/Turnstile/cookies/CORS **diretos do navegador** na publicação final, frontend remoto atual, admin/manager, onboarding completo, mutations de gerenciamento, uploads, realtime, catálogo, bootstrap/rebuild ou CPU8MiB.

Build local sem envfiles/VITE ambiente, origem API loopback, flags locais catálogo/realtime/imagensfalse e Turnstile localfalse. Nenhuma dessas opções alterou o backend/produção. CSP bloqueou terceiros. Total77chamadas HTTP, dentro do orçamento120 do adaptador:73HTTP200/1HTTP204/3HTTP401. Houve38leituras de cozinha pelo fallback durante o teste com realtime localdesligado; **não é medição de tráfego/custo normal de produção** nem autorização para alterar polling/realtime. Seleção foi a única mutação de negócio; nenhum pedido foi criado.

Artefato local: entry`assets/index-gxuFtMJ1.js`, SHA256`718698540a5d41f9cf8324dd4dbc81956d1e20e5373d40b1e28bfc0486729652`; HTML SHA256`e405212ceab46786d20ec54286df5978b67db265b20444802af89c4c44540077`. Identifica HTML/entry observados, não um pacote integral aprovado para deploy.

## Limpeza e evidências

Manifesto próprio:5contas sintéticas verificadas,2organizações,3restaurantes; tag`tenant-smoke-3f641e5b-b41e-4230-bcea-34c8cdc432dd`. Somente owner/staff fizeram login. HTTP fechado antes do cleanup; ambas as sessões revogadas com verificação de cookie antigo401. Driver qualificado removeu somente UUIDs/marcadores próprios, conferiu15relações/efeitos e readback commitadozero. Nova conexão TLS READ ONLY confirmou0 organizações/memberships/subscriptions/restaurantes/preferências/users/sessions/accounts; ROLLBACK e poolclose. Dados de teste eram descartáveis e são recriáveis; não há dados de clientes removidos.

Relatório final: `ok:true`, `cleaned:true`, `logoutVerified:true`, adaptador`closed`, `sessionsRetained:0`, `retainsCredentials:false`. Não é promessa de zeragem forense de strings JavaScript. Bearer permanece write-only remoto e não deve ser recuperado/reutilizado a partir de logs/UI/cache. Operador agora rejeita baseline32; não executar outra renovação para repetir gate encerrado.

Controlador5766 encerradoexit0. Auxiliares estáticos próprios também encerrados após conferência de PID/executável/comando; leitura do sistema confirmou**zero listeners** nas quatro portas deste gate. Nenhum arquivo de evidência/backup foi apagado.

Scratch ignorado do plano catálogo, em D: `frontend-browser-integrated-result-800edee6-0aea-4113-8bfe-e7ea6417a488.json`, manifesto público do mesmo runId, marcador exclusivo de início, controlador e capturas `frontend-integrated-owner-capacity.png`, `frontend-integrated-owner-logout.png`, `frontend-integrated-staff-navigation.png`, `frontend-integrated-staff-creation-blocked.png`, `frontend-integrated-staff-billing-blocked.png`. Sem tokens em novos relatórios/arquivos/Git/argv/env.

Verificação local pré-execução:244/244 operadores e701/701 API, zero falhas/skips;12casos do adaptador incluídos, servidor local4/4. CI inclui teste offline do adaptador; nenhum resultado antigo deCI foi atribuído ao novo checkpoint. Fonte F/B não mudou e suas suítes completas anteriores não foram reexecutadas/apresentadas como prova nova aqui.

## Continuação do plano

Catálogo permanece**7/10** e Etapa13 aberta. Bpreview canônico, API compatível/tenant smoke e este gate de UI/HTTP são checkpoints fechados, não para repetir. Frontends publicados continuam nos artefatos antigos. Próximos: fechar inventário/compatibilidade dos writers ainda ativos, preparar janela writer com readerfalse e provar CPU8MiB/snapshots/bootstrap/recuperação; promoção de produção e integração das branches têm gates próprios. Não publicar, ligar flags ou aplicar schema de produção por inferência deste relatório.
