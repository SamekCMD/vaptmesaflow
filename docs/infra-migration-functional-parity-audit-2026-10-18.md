# Migração — auditoria de paridade funcional

Data:18/10/2026. Solicitação: corrigir múltiplos restaurantes/equipe e verificar outras funcionalidades anteriormente decididas que ficaram fora da candidata. Este registro é uma inspeção estática e uma correção do inventário, **não uma correção de runtime nem uma especificação aprovada de implementação**.

## Escopo e evidência

- Frontend candidato: `codex/infra-foundation`, `303af28`; API candidata: mesma branch no repositório separado, `ab24eb0`.
- Conferidas as12 refs locais frontend e13 refs locais API com `for-each-ref`, `merge-base --is-ancestor` e `log --right-only --cherry-pick --no-merges`. Contagens e equivalências seguem a [matriz de branches](infra-migration-branch-reconciliation.md). Sem fetch; não certifica refs remotas.
- Comparadas as famílias frontend `multitenant-v2 → e2e-regression-cleanup → infrastructure-recovery` e API `jwks-auth-transition → membership-authorization → infrastructure-recovery`; inspecionados os commits exclusivos, o plano histórico e os arquivos de comportamento relevantes nas pontas locais.
- Fontes históricas principais: frontend `4299d94`, `139b5e5`, `d46c2df`, `fa54aae`, `1222f92`, `ed5bfc2`, `8208a90`, `69dedf3`, `085f133`; API `72bb04e`. O plano `docs/implementation-references/Vapt_Codex_Implementation_Plan.md` e o runbook Phase7 foram lidos na ref histórica, não aplicados como instruções de restauração de Supabase.
- Preservados os WIPs de outras sessões: frontend e2e possui adaptação de envio auth direto; API membership possui `src/modules/auth-email/`, configuração e documentos Resend não commitados. Seus diffs de código e nomes foram inspecionados, não editados ou incorporados; não se certifica a implementação integral desses WIPs. `.env` e credenciais não foram lidos. O manifesto histórico identifica esses WIPs como pertencentes a outra sessão.
- Nenhum código de produto, dependência, banco, deploy, DNS, plano pago, main ou branch alheia foi alterado nesta auditoria. Não houve nova execução das suítes; testes existentes são citados como cobertura a reconciliar, não como resultados novos.

## Requisitos já confirmados

Multi-tenant é parte do produto já trabalhado, não expansão opcional. O usuário confirmou sua preservação e pediu a correção. Não preservar UUIDs e contas sintéticas não autoriza retirar funcionalidades. A substituição de Supabase por Neon/Better Auth muda o mecanismo, não estes requisitos.

No último contrato de limites da branch funcional (`4299d94`): Starter1, Pro1 e Business25 restaurantes por organização; trial1. Papéis históricos: `owner`, `admin`, `manager`, `staff`; apenas membership ativa concede acesso. Os aliases antigos growth/scale/enterprise são compatibilidade histórica, não novos planos a oferecer.

## Lacunas confirmadas no código candidato

| ID | Comportamento anterior / decisão | Evidência atual e consequência | Aceite de restauração |
| --- | --- | --- | --- |
| P01 | Organização, memberships e acesso por papel (`72bb04e`) | API `src/lib/permissions.ts` consulta apenas `restaurants.owner_id`; schema Neon e código de negócio não contêm o modelo de organização/membership. Equipe não consegue usar as mesmas operações por vínculo. | Membership ativa consultada no servidor para o restaurante alvo, papéis desconhecidos/invited/disabled/cross-org negados; sem fallback owner que contorne revogação. |
| P02 | Seletor, bootstrap e última seleção válida (`4299d94`, `69dedf3`) | Ausentes `src/features/restaurants/` e bootstrap canônico; frontend chama `/restaurants/me`; repository usa `limit1`. Não há escolha determinística entre restaurantes/organizações. | Nenhum restaurante→onboarding; draft→retomada; um pronto→painel; vários→preferência válida/seletor; ID da URL validado; troca explícita não revertida por URL/resposta antiga. |
| P03 | Limites1/1/25 e criação autorizada/serializada (`4299d94`) | Frontend perdeu `maxRestaurants`; `infra/neon/004_business_constraints.sql`, introduzido por `ce93f61`, impõe um restaurante por dono. Não implementa limite por organização. | Limites e papel aplicados também no banco/serviço, incluindo concorrência, drafts e retry idempotente; frontend apenas reflete entitlement seguro. |
| P04 | Assinatura e trial pertencem à organização (plano histórico e schema da branch funcional) | Stripe repository/webhook/outbox e DTOs atuais usam restaurante/dono. Cada restaurante é tratado como escopo de assinatura separado. | Uma assinatura/trial por organização, sem cobrança duplicada ao trocar restaurante; associação/eventos/retries e emails reconciliados sem misturar cobrança SaaS com pagamento de pedidos. |
| P05 | Onboarding persistido, retomável,3 etapas e primeiro prato opcional (`fa54aae`, `1222f92`, `ed5bfc2`) | Página atual tem estado React e2 etapas; exige prato/preço e não salva draft. API cria tudo no fim, marcando completo e iniciando trial por restaurante. A transação existe, mas não substitui retomada. | Dados básicos→operação salão/delivery/ambos e mesas→revisão; salvar etapa no servidor; recarregar retoma o mesmo draft; finalizar idempotentemente, com rollback e relógio do servidor. Marca/prato opcionais após onboarding. |
| P06 | Ativação persistida e isolada por restaurante (`139b5e5`) | `src/lib/onboarding.ts` usa a chave global localStorage `onboarding-guide-progress`; `finishSetup` marca todos os módulos concluídos. Sem tabela/serviço de progresso atual. | Persistência por restaurante; A não herda progresso de B; só concluir o módulo escolhido, sem marcar todos no cadastro; avanço sobrevive a outro navegador. |
| P07 | Upload real de logo (`d46c2df`; runbook registra reload e confirmação em outro dispositivo) | `AppearancePage.tsx` cria `blob:` com `URL.createObjectURL` e envia essa string como `logoUrl`; não faz upload. Fluxo R2/WebP do cardápio atual é de imagem de produto, não de logo. | Logo persistido no R2 e referenciado por URL válida, nunca `blob:`; prévia separada; compressão e orçamento de100MiB/restaurante compartilhados, sem duplicar quota ou relaxar controles de objetos. |
| P08 | Validação de slug ao sair do campo e conflito legível (`8208a90`) | Tela de aparência atual não tem `checkSlug`, status inline ou `onBlur`. O conflito SQL genérico não preserva sozinho a UX anterior. | Verificação pontual, sem polling; conflito inline; salvar revalida; resposta atrasada não valida outro valor/tenant; unicidade final no banco continua autoridade. |
| P09 | Isolamento de formulários, arquivos pendentes, URL e cache após troca (`69dedf3`) | Settings/Appearance carregam pelo usuário, sem contexto de restaurante e sem invalidar carga antiga. `useSubscription` tem singleton global protegido por geração do usuário, mas não por organização. A defesa A→B da assinatura existe parcialmente; não equivale à troca multi-org. | Estado/query keys por usuário+organização/restaurante; cancelar/ignorar respostas antigas; limpar arquivos pendentes; bloquear save com carga ausente/erro; links/menu atualizados depois de renomear/trocar. |
| P10 | Capabilities em operações privilegiadas e mesma fronteira nos novos fluxos | Rotas Stripe, Mercado Pago e pagamento manual perderam distinção de capabilities da branch membership. Realtime, catálogo e imagens novos também consultam owner diretamente. | Aplicar a matriz abaixo em HTTP, serviço, SQL/transação, admission e revalidação realtime; comando adiado/retry revalida membership antes de nova mutação e nunca perde a recuperação segura de commit já aceito. |

P01–P10 são grupos de aceites relacionados, não dez bugs independentes nem estimativa de esforço. O código atual em uma branch divergente nem sempre chegou a receber a versão antiga; “ficou de fora” não significa que todos os arquivos foram apagados de um mesmo histórico.

### Matriz de capabilities existente a preservar

Fonte: API `72bb04e`, `src/lib/permissions.ts` e `docs/2026-09-05-membership-authorization-design.md`.

| Capacidade | Papéis |
| --- | --- |
| restaurant.read / restaurant.operate | owner, admin, manager, staff |
| restaurant.manage | owner, admin, manager |
| billing.read | owner, admin, manager |
| billing.manage | owner, admin |

Criação de restaurante: owner/admin, respeitando entitlement. Papel da sessão Better Auth não é papel da organização. A inspeção encontrou base de roles/memberships, mas **não comprovou um fluxo completo antigo de convites/gestão de equipe por UI**; não afirmar que ele já estava pronto nem inventar convites automáticos/novas permissões. Uma lacuna de produto anterior não deve ser confundida com perda comprovada na migração.

## Por que não remover apenas o índice

Além do `limit1`, `RestaurantRepository.updateOwnedRestaurant` atual usa `where owner_id=...` sem `id` do restaurante. Ao permitir vários restaurantes, essa operação poderia atualizar todos os restaurantes do dono e retornar apenas a primeira linha. Kitchen, menu, overview e table-sessions também usam owner como escopo de leitura/mutação; catalogue executor e image-service possuem suas próprias verificações de owner. Restaurar apenas o seletor ou trocar apenas `src/lib/permissions.ts` deixaria escopos inconsistentes.

O índice004 já foi versionado; esta auditoria não consultou o catálogo remoto para recertificar sua aplicação por ambiente. A correção deve ser uma migration posterior, ensaiada localmente, mantendo os arquivos históricos e exigindo gate próprio no Neon; nada de editar004 e presumir o remoto atualizado. Nenhum dado de outro ambiente deve ser apagado ou copiado para simular compatibilidade.

## Substituições intencionais / comportamento a conservar

| Família | Situação observada | Limite da conclusão |
| --- | --- | --- |
| Auth Supabase/JWKS e SMTP | Substituídos por Better Auth, cookies e Resend; configuração exige email verificado e revogação de sessões no reset. UI de reset encaminha ao login. | Não reintroduzir tokens Supabase, login customizado ou Redis/GoTrue do WIP. Gates anteriores de auth estão nos documentos das etapas5/13; esta auditoria não repetiu o fluxo real. |
| Mudança/cancelamento de plano por fluxo antigo n8n | Candidata usa Stripe Checkout/Portal e reconciliação por webhook. | Preservar resultado de produto e as proteções atuais; não recuperar endpoints n8n só para igualar arquivos. Falta integrar escopo organização (P04/P10). |
| Pagamento de pedidos, retorno/status e OAuth Mercado Pago | Branches ancestrais ou patches equivalentes; módulos, telas e testes atuais presentes. | Não duplicar os3 patches equivalentes da matriz. Retestar com staff/organizações após port; presença no histórico não prova paridade completa em runtime. |
| Catálogo público, WebP/R2 de produtos e realtime | Implementações novas devem permanecer; são o mecanismo de redução de consultas autorizado. | Seus testes locais anteriores não cobrem organizations/roles. Reader/writer continuam false; não ativar recursos para testar o port. Logo é lacuna separada (P07). |
| RLS/Storage policies e recuperação de infraestrutura Supabase | Mecanismos antigos substituídos por API/roles SQL restritas e R2. | Portar os testes negativos e a intenção de isolamento/segredo, não aplicar o baseline Supabase no Neon. Sem retomar DNS/Vercel/Easypanel ou instalar serviços legados. |

## Encaminhamento e checklist

Recomendação para o desenho a validar: reconciliar seletivamente os comportamentos anteriores sobre Neon+Better Auth, com organização como fronteira de assinatura/membership e restaurante explícito como fronteira operacional. Preservar caches/eventos e limites de custo atuais. Merge completo do baseline antigo restauraria dependências removidas; patch apenas de índice/UI não atende isolamento.

- [x] Confirmar requisitos existentes sem pedir nova decisão de produto.
- [x] Inventariar todas as refs locais, famílias divergentes e WIPs sem sobrescrevê-los.
- [x] Registrar lacunas e fontes, sem declarar paridade completa ou execução de testes inexistente.
- [x] Abordagem de reconciliação validada pelo usuário em19/10; [especificação escrita](superpowers/specs/2026-10-19-tenant-parity-restoration-design.md) preparada para revisão separada.
- [ ] Usuário revisou/aprovou a especificação escrita entre schema, API, frontend, billing e catálogo.
- [ ] Especificar e planejar as entregas compatíveis; incluir testes negativos/concorrência antes do código.
- [ ] Implementar P01–P10 nos dois repositórios; verificar cada comportamento e a suíte final integrada.
- [ ] Retestar gates remotos após disponibilidade e autorização próprias; consolidar mains somente depois da paridade verificada.

Até estes aceites serem cumpridos, multi-restaurante/equipe e paridade funcional **continuam abertos**. [Capacidade Neon](infra-migration-capacity-readback-2026-10-18.md) é gate remoto separado e não impede investigação/desenho/testes locais; não autoriza contratação, SQL remoto, bootstrap ou publicação.
