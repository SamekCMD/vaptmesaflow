# Paridade tenant — revisão independente e tratamento

22/10/2026. Uma revisão independente, somente leitura, de toda a restauração pareada: F `0cb286d..960cedf`, A `ab24eb0..031e5ec`, incluindo o consumidor B versionado em F. Sem outros revisores ou acesso remoto. O parecer é de código local, não autorização de publicação.

## Parecer recebido

Pontos fortes conferidos: autorização transacional e locks de tenant; filhos operacionais limitados ao restaurante; recuperação de projeção pública aceita distinta de nova mutação; reautorização de resultados privados; associação Stripe imutável e emails congelados; quota única de imagem/logo com leases preservadas; continuação frontend por identidade; matriz de evidências sem simular prova remota.

Nenhum Critical ou Minor. Dois Important/P2; ambos mantidos como importantes pelo efeito real:

1. `restaurant.read` expunha `planType`, `planStatus` e `trialEndsAt` a staff pelo DTO operacional, inclusive na carga normal do dashboard. Task3 preservava esse DTO, mas conflitava com a fronteira maior de `billing.read`.
2. Stripe Checkout/cancelamento/Portal retornavam sem organização; Mercado Pago descartava o restaurante persistido ao montar o redirect. Navegação completa apagava a dica do QueryClient e uma preferência alterada em outra aba podia levar o retorno à unidade/organização errada. O efeito no provedor permanecia correto, mas a tela e a próxima ação podiam usar outro alvo.

Veredito original: **With fixes**. Não é um segundo parecer sobre a passagem de correção.

## Passagem única de correção

- Dados financeiros removidos do DTO/query operacional para todos os papéis; endpoint de billing autorizado e features/operationActive do bootstrap permanecem canônicos. Regressão realmente vermelha com os três campos presentes, seguida de respostas HTTP explícitas e legadas sem esses campos para owner/admin/manager/staff em PostgreSQL real local.
- Retornos Stripe carregam somente o ID da organização autorizado no servidor. O frontend valida essa organização na resposta nova de bootstrap, ignora a preferência de outra organização e seleciona uma unidade válida nela; se necessário, mostra seleção filtrada, sem assumir outra organização. Depois fixa o restaurante e remove a dica transitória. Mercado Pago inclui o UUID do restaurante persistido na autorização, tanto Fastify quanto Worker. Origem/host continuam controlados pelo servidor; nenhum URL de retorno arbitrário é aceito.
- URLs de provedores RED4/37 → GREEN37/37. Retornos com cache novo RED3/3 → GREEN; cobertura adicional de Mercado Pago, organização inexistente/malformada e seleção entre várias unidades. F383/383 e A701/701, tipos/builds aprovados; lint sem erros, um aviso preexistente de dependência em TableSessionModal. Gates completos finais: PostgreSQL92/92 sem skip e workerd30/30. A fixture workerd antiga omitia o restaurantId que o callback real sempre retorna; completada a fixture, o gate inteiro passou. Não houve segunda revisão: o encerramento dos achados é sustentado pelos testes e pela verificação do executor.

Os dois Important estão encerrados localmente pelo executor, após correção e testes completos. Os commits pareados finais estão no manifesto de verificação. Não restou achado Critical/Important aberto desta revisão.

## Comportamentos que o revisor não certificou

1. Rollout/capacidade/grants/bindings/provedores reais: permanecem gates remotos, não resultado de teste local.
2. UI de convites/equipe: fora desta restauração; papéis/memberships não significam UI de convites concluída.
3. Revogação por administrador SQL irrestrito fora do protocolo: a garantia de concorrência exige o protocolo comum de locks.
4. Bloqueio adicional de criação por assinatura inativa: mantida a regra aprovada de contagem 1/1/25, separada da política de acesso comercial à operação.

Decisões e custos completos ficam no [registro durável](infra-migration-tenant-parity-decisions.md). Não há minors novos adiados por este parecer. Nenhuma promoção, migration remota, flag, merge ou push foi executada.
