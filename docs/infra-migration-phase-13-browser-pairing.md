# Etapa 13 — publicação controlada e navegador

## Estado atual — 08/10/2026

Usuário autorizou explicitamente publicar `vapt.app.br` e `api.vapt.app.br` nos Workers existentes, ajustando somente esses dois nomes. Sem merge/main, Stripe Live, assinatura Zero Trust production, contratação adicional ou desligamento da VPS. A Etapa13 não está concluída.

| Domínio | Worker | Versão a100% | ID do vínculo |
| --- | --- | --- | --- |
| `vapt.app.br` | `vapt-web` | `deb94199-9d96-4db5-bcc5-e4d7f027298c` | `42d2afe630dc5122d027cf55cb13607c7e0d6bd3` |
| `api.vapt.app.br` | `vapt-api-production` | `eeb0d212-ad66-4c0a-90ec-7117b89a4266` | `f7344b662aa02bcfa576e9cb5b0108d6d59b667f` |

A API agora tem ingresso público pelo custom domain autorizado. `workers.dev` e Version/Preview URLs continuam desativados na API; registros anteriores “production privada” são históricos. Readback confirmou CPU1000ms, oito nomes de secrets (sem valores), mesmos Hyperdrive/R2/DO, realtimefalse, StripeTest, Cron0 e R2 privado. Não houve redeploy da API.

## DNS e artefato

Painel confirmou sete registros e nenhum A/AAAA/CNAME no apex/API antes; depois, nove registros: os sete originais preservados e dois Worker. MX/SPF/DMARC/DKIM, `coolify`, `send` e `rsend` intactos; nenhum `www` criado. [Custom Domains criam DNS e certificado](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/); nenhuma assinatura separada de Advanced Certificate Manager foi necessária.

Frontend baseado em `9abbe348ea449448c79ae28693d16f555d028a57`: build com API correta, Turnstile ativo/sitekey público existente, pagamentos sandbox e imagens/realtime desativados durante qualificação. O primeiro bundle revelou webhook legado sem consumidor, herdado de `.env.local` pelo objeto dinâmico `import.meta.env`. Build seguinte zerou nove chaves VITE não utilizadas e manteve o contrato atual, inclusive VAPID público; nenhum arquivo env foi editado.

Build exit0/77JSfiles/cinco assertions aprovadas (origem API/sitekey/ausência URL legada/ausência preview inválido/valores removidos ausentes). SHA256 index+bundles: `1e7d65bab4e587593ea75802e06cc17b4a2de8b95441f9d105ed2074824f3d31`; index publicado byte a byte igual ao local, SHA256 `09c9f2ac2584a3792fa145460ac1e2947f87372089cb0cfccf24b86dc1f569d4`.

**Deploy protegido implementado em08/10:** `npm run deploy:production` agora seleciona config público/build isolado com allowlist e semântica production. API tem deploy:worker-production-public, preservando domínio e guard de recursos. Detalhes/testes/limites em `infra-migration-phase-13-public-deploy.md`; qualificação remota dos comandos novos ainda pendente. Config API `wrangler.worker-production.jsonc` continua privada/routes[]: não usar para redeploy público. Alerta do comando genérico antigo é histórico.

## Evidências e limites

- Continuação08/10: CI dos heads API6181175/F8a50796 confirmado completed/success tanto em pull_request quanto push. São os commits documentais anteriores a este registro, não cobertura de qualquer head posterior.
- Readback final pós-cleanup aprovou novamente as duas versões/domínios da tabela, API1000ms/mesmos oito nomes de secrets/HD/R2/DO, Cron0, realtimefalse, StripeTest, R2privado e ingress alternativo da API desligado. Nenhuma mutação no control plane nesta continuação.
- CI dos heads API3eca4b6/F9abbe348: pull_request e push completed/success nos dois repositórios.
- Oito controles públicos passaram: frontend200/index exato, health200, SQLready200, sessão anônima200/null, auth sem Cookie401, catálogo ausente404, preflight204 e origem não confiada rejeitada.
- CORS permitido usa origem exata e credentials:true; preflight permite Content-Type/X-Captcha-Response. Origem não confiada retorna500 sem concessão CORS, conforme contrato atual, não403. Nenhuma proteção foi relaxada.
- Brave: formulário real e verificação automática real do Turnstile, sem clicar/burlar CAPTCHA; login normal e dashboard do restaurante próprio carregaram. Contagem Neon confirmou uma sessão válida sem ler token/cookie.
- Na primeira execução, uma janela de extensão bloqueou reload/logout; a fixture foi removida imediatamente. Na continuação de08/10, versões remotas e Git permaneceram iguais; a frase diferente do hero era uma variação já presente, não novo deploy. Nova fixture própria foi criada sem substituir dados existentes.
- Brave real: login normal com Turnstile aprovado automaticamente; reload completo de `/dashboard` preservou o dashboard próprio e uma sessão válida no banco. Menu da conta acionado por teclado → “Sair” retornou a `/login`; contagem de sessões próprias caiu para zero **antes** do cleanup. Navegação nova a `/dashboard` redirecionou novamente para `/login`. Capturas locais `browser-reload-verified.jpg` e `browser-logout-protected.jpg` guardadas no workspace da Etapa13.
- O transporte de mouse da automação apresentou timeout/ações sem efeito; observação nova e teclado acessível normal concluíram o menu, sem alterar produto, extensão ou segurança. Navegação pós-logout expirou esperando `/dashboard` porque o resultado real foi o redirecionamento observado para `/login`, não falha do gate. Não inferir atributos de cookie a partir de DOM: prova anterior de Secure/HttpOnly/SameSiteLax continua separada.

Fixture descartável “Restaurante Teste Navegador”: user `af98d95d-d944-43a9-86e1-3d95ac2e75e1`, restaurante `f6d28df8-15af-4e83-b354-708392c68c37`, item `288cf9bd-20ae-4f80-96e8-a852f07d599e`, email sintético `example.invalid`, senha exclusivamente de teste. Dados preverified evitaram email; login executou autenticação/hash/Turnstile normais. Novo cleanup em08/10 por identidade exata removeu user/account/session/restaurante/item, zero resíduos nas cinco verificações, pool fechado. Nenhum pedido, upload, email ou pagamento solicitado. Nenhuma fixture ou sessão própria ficou ativa.

## Rollback e próximos gates

Antes de retirar ingresso, conferir por GET conta/hostname/service/IDs da tabela. Remover apenas esses vínculos por `DELETE /accounts/3ce69408aa5112617a282957aba71932/workers/domains/{id}` e confirmar ausência dos registros Worker. Estado anterior não tinha destinos nos dois nomes; não restaurar legado nem tocar nos sete registros preservados.

Frontend anterior `a489f0c5-c9b2-434a-8008-6aba502ed038`: fechar ingresso antes de eventual restauração, pois esse artefato não foi certificado com as origens/auth atuais. Rollback de ingresso/código não reverte recursos ou dados. Certificados podem permanecer após remover o vínculo; identificar somente os próprios antes de limpeza, sem apagar preexistentes.

Pendências: provedores Test/Resend, imagens públicas deliberadas, realtime production, observabilidade/volume, deploy público reproduzível e aceitação final de cutover/estabilidade/backup/desligamento VPS. Login/reload/logout do browser concluídos neste escopo; isso não certifica todos os fluxos ou capacidade. Não recriar infraestrutura nem repetir gates privados concluídos.

Delta local concluído em08/10: configs públicos explícitos/guards/build isolado e CI dry-run, sem alterar configs privados/preview. Próximo controle é publicação/readback pelos comandos novos, preservando vínculos/secrets/recursos antes/depois. Não ligar imagens/realtime/StripeLive nem recriar infraestrutura por este delta. Gate local não prova publicação remota.
