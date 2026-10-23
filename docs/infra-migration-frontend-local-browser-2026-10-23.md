# Frontend candidato — navegador local, 23/10/2026

Atualização posterior18:56UTC: a proposta abaixo foi autorizada por “continuar”, implementada/testada e [executada com API real de preview](infra-migration-frontend-preview-browser-2026-10-23.md), com limpeza verificada e encerramento. Este relatório continua sendo a prova anterior de UI **com backend sintético**; não repetir seus passos nem interpretar a proposta histórica como pendência de nova rotação.

## Resultado e fronteira da prova

Conferência encerrada às18:23UTC. O frontend da branch `codex/infra-foundation`, fonte F`07840e9`, carregou no Brave com seu React, roteamento, Better Auth client e React Query reais, mas **backend HTTP inteiramente sintético e local**. Não é certificação integrada da API de preview, autenticação remota, cookies/CORS de produção, realtime, mutações de catálogo, CPU8MiB ou ativação do catálogo. Etapa13 e catálogo7/10 continuam abertos.

Servidor vinculado exclusivamente a `127.0.0.1`, porta efêmera49168 durante a execução; já encerrado com exit0. Nenhum proxy, túnel ou chamada ao control plane/Neon/Resend/Stripe foi usado. Respostas de sessão eram fixtures em memória, não credenciais reais. Banco, Access, bearer, API e frontends publicados não foram alterados ou certificados novamente. Não houve publicação, main/push, flags, schema, grants, emails, pagamentos ou contratação.

Build isolado com `envFile:false`, `envPrefix:[]` e allowlist de valores públicos definidos individualmente; base API apenas na mesma origem loopback. Flags locais de catálogo/realtime/imagens desligadas; Turnstile desligado **somente neste artefato sintético**, sem modificar configuração remota ou fonte do produto. CSP da fixture restringe scripts/conexões à própria origem e bloqueia scripts/fontes externos; não é prova da experiência de consentimento/CAPTCHA em produção. Rejeição de Host/Origin estrangeiros, `no-store`, caminhos estáticos limitados e operações HTTP desconhecidas recusadas, sem proxy automático.

## Observações reais no navegador

| Cenário | Resultado observado |
| --- | --- |
| Proprietário Business | Cozinha carregou com UnidadeA, navegação de gestão e badgeBusiness |
| Seleção explícita A→B | Select real emitiu `PATCH /account/preference`; URL e unidade passaram aB |
| Recarga e preferência | Recarga manteveB; navegação nova sem `restaurantId` também selecionouB pela preferência sintética do servidor |
| Seletor e criação | Ambas as unidades listadas; “Novo restaurante” mostrou2de25 e botão de continuação habilitado; não iniciou onboarding |
| Logout | Menu real→Sair emitiu `POST /api/auth/sign-out`, voltou a/login; navegação nova à cozinha retornou a/login |
| Staff | Cozinha carregou; Cardápio/Aparência/atalho de cobrança ausentes na navegação, badgeEquipe |
| Cobrança por URL direta | `/dashboard/subscription` exibiu “Sem permissão para acessar a cobrança desta organização.” |
| Criação por URL direta | `/restaurants/new` informou falta de permissão; botão “Continuar configuração” desabilitado |

Contadores locais: proprietário1PATCH de preferência/1POST de logout, nenhuma operação desconhecida; staff0requisições ao endpoint de assinatura e nenhuma operação desconhecida. São observações da interface contra fixtures; não demonstram autorização do servidor real nem custo sob carga. Não foram testados admin/manager, onboarding completo, compras, uploads ou mutações de cardápio neste gate.

Artefato servido: entry`assets/index-BIRHU5cj.js`, SHA256`730e7ee29f98dfe65c46def6ceb4e2dfde0c45924705728abb20e72565dacf66`; HTML SHA256`4f9b0e5e3a07bcd5a8d1595a07c41054c54e0b4972ffa545efeae05e473491dd`. Esses hashes identificam HTML/entry locais, **não** um pacote completo aprovado para publicação. Artefatos/harness e capturas guardados apenas no scratch ignorado deste plano:

- `frontend-browser-fixture.mjs`, `frontend-browser-controller.mjs`, `frontend-browser-fixture.test.mjs`;
- `frontend-browser-owner-capacity.png`;
- `frontend-browser-staff-navigation.png`;
- `frontend-browser-staff-creation-blocked.png`.

## Verificação e correção do harness

Seis testes das fronteiras locais falharam antes da implementação e passaram depois. Uma asserção de Host foi corrigida para usar `http.request`: o cliente Fetch não enviava o Host customizado, portanto não reproduzia o caso pretendido.

O primeiro navegador ficou vazio antes de qualquer requisição à API: o build com definição única de `import.meta.env` perdeu os valores no objeto dinâmico gerado pelo Vite. Regressão reproduzida com **compilação Vite real** (API resultavaundefined), corrigida usando o padrão de chaves individuais já empregado pelo build protegido existente. Resultado final do harness: **7/7**, zero falhas/skips; navegador efetivamente carregou após a correção. Sem alteração em `src`, scripts versionados, dependências ou configuração de produção. Aviso existente de caniuse-lite antigo não foi usado como motivo para atualizar pacotes. A suíte F383 do gate anterior não foi repetida nem apresentada como nova prova desta execução.

## Proposta integrada anterior — histórico antes da autorização/execução

O bearer de `stage11-inert` continua write-only, desconhecido após o encerramento do controller anterior. Não recuperar de logs/cache/UI, embuti-lo em Vite ou abrir a API para contornar o problema. Repetir o smoke de68checks já concluído ou publicar o frontend antigo não resolve essa admissão.

Desenho proposto: um **adaptador HTTP de teste local e temporário**, sem código novo do produto ou recurso público. Mantém AccessJWT, bearer e cookies Better Auth reais **apenas na memória do processo servidor**, com contextos separados de proprietário/staff. O navegador recebe somente o frontend e DTOs sintéticos do gate. O adaptador não é proxy genérico: destino fixo no preview, métodos/rotas allowlisted para sessão, bootstrap, seleção, leitura de unidades/entitlement/cozinha e logout; nenhum checkout/portal/upload/mutação de catálogo. Host/Origin loopback estritos, prazo máximo30min/expiração de Access, sem cabeçalhos/tokens nos logs/arquivos/argv/env. Não alterar CORS/trustedOrigins/cookies/Access do backend para fazer passar.

O operador faria login das fixtures no servidor e encaminharia seus cookies em memória; isso permite testar interface+HTTP remoto, mas **não equivale** ao login direto do navegador, atributos de cookies ou CORS da publicação final. Essa limitação deve acompanhar o resultado. Preparação e testes do adaptador podem ser locais; qualquer integração real requer gate próprio de autorização e preflight, não uma promessa de que o desenho já foi implementado/certificado.

Escopo de autorização a pedir em conjunto: renovar uma única vez somente `PARALLEL_PREVIEW_TOKEN` no preview nomeado, pin31/deployment`6110a9fe-0ee6-4faa-920e-23f73f7a504d`→32, após verificar código/configuração/controles; autenticação Access temporária existente, sem ServiceToken; fixtures UUID/marcador próprias do driver já qualificado e cleanup com readback independente; somente seleção/logout e leituras acima. Sem replay automático, nova rotação em falha incerta, frontend remoto, produção, flags, schema/grants, email/pagamento, recurso/plano ou integração de main. Cleanup incerto impede retomar. Não executar essa mutação com base somente na continuação do gate local.

Antes de qualquer execução remota, implementar/testar o adaptador contra upstream sintético (allowlist, isolamento de contextos, ausência de credenciais no conteúdo/erros, fechamento e cleanup) e conferir novamente o baseline real. Esta proposta não libera writers, readers ou bootstrap/rebuild. Produção continua exigindo seu gate pareado próprio.
