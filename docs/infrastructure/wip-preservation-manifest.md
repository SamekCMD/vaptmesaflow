# Manifesto de preservação dos WIPs

Capturado em 15/09/2026 antes da integração da recuperação. Estes diretórios não são alvos de deploy nem de edição nesta tarefa.

## Fontes da recuperação

| Repositório | Worktree isolada | Branch | Base |
| --- | --- | --- | --- |
| Frontend/database | `D:\Projetos\vaptmesaflow\.worktrees\infrastructure-recovery` | `codex/infrastructure-recovery` | `8e02d4d6e66d96106ea728f5a45951fca4c7e74f` |
| API | `D:\Projetos\vaptmesaflow\vapt-api\.worktrees\infrastructure-recovery` | `codex/infrastructure-recovery` | `d37878094a33d0691ded728208771df8d9fbd2a5` |

O database consolida manualmente o estado confirmado em `codex/multitenant-v2`, `codex/multitenant-onboarding`, `codex/payment-effects-stage7-db` e no frontend avançado `codex/e2e-regression-cleanup`. A API parte da ponta de `codex/membership-authorization`, que já incorpora JWKS, autorização por membership e a cadeia atual do Mercado Pago. Nenhum merge geral ou cherry-pick de worktree foi feito.

## WIP Auth/Resend — outra sessão

Status: **ACTIVE WIP — OWNED BY ANOTHER CODEX SESSION — DO NOT MODIFY**.

Worktree frontend: `D:\Projetos\vaptmesaflow\.worktrees\e2e-regression-cleanup`, HEAD `8e02d4d`. Estado preservado:

| Arquivo | Estado | SHA-256 |
| --- | --- | --- |
| `.env.example` | modificado | `1D60D6F6B92740FBFE8FC8639C4365C2933D996C9B66E5F332EAF5B457B11FAD` |
| `src/features/auth/auth-service.ts` | modificado | `92FECD1D7D8537D23953C6DEC202A6C390A04A1BEC916E909D4B21E491CE7281` |
| `src/features/auth/direct-email.ts` | não rastreado | `50D1BBFEB8A9C150BD3BF234E834749F75A89896F1773B3607CF89D1600725F4` |
| `src/test/auth-email-direct.test.ts` | não rastreado | `AD28BD3916AF24097344EC4F3BF8EB195037CBEE183D175AFC082B99DFB50881` |

Worktree API: `D:\Projetos\vaptmesaflow\vapt-api\.worktrees\membership-authorization`, HEAD `d378780`. Além dos arquivos abaixo, `docs/deployment/`, quatro documentos Resend e `src/modules/auth-email/` permanecem não rastreados e intactos.

| Arquivo | Estado | SHA-256 |
| --- | --- | --- |
| `.env.example` | modificado | `A2EC55386150EA570E828B89DD32226F2E4EAD58FEF0A9E41D371E3DACA71733` |
| `package-lock.json` | modificado | `5B36B5CCA15DAD4DBAEACE099C3507627A85E1104AEDD79B9CEAF23A3FEDB526` |
| `package.json` | modificado | `1B88B4B34D47EA16F9A98680501BFA1BB9C8A4484F020E1C9FD193FE4988C775` |
| `src/app.ts` | modificado | `F2F7094762B96FDB525B86754F1AA6197C3F8993E17B9A4F1A5007005498720C` |
| `src/lib/config.ts` | modificado | `FC498E4317637E02D44AC1136295EFA1D72CE0B3E5E50F9BA68D28E57ABDBE95` |

Repetir `git status --short` e os hashes acima antes de qualquer integração. Divergência bloqueia a entrega até ser explicada; não corrigir o WIP por reset, stash, checkout ou merge.
