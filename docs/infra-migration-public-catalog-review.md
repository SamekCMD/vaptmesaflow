# Catálogo — revisão e passagem de correções

Checkpoint18/10/2026. Uma única revisão com contexto novo examinou a implementação completa do catálogo: frontend `4184e3c..ee2145f` e API `ae8a7c3..0bac7ae`. A execução foi retomada após interrupção por limite de uso, não substituída por outro revisor. Parecer: **não pronto para merge**, nenhum achado crítico confirmado e seis achados importantes. Nenhum deploy ou alteração remota foi autorizado pelo parecer.

## Achados e estado

| Achado | Evidência / correção local | Estado |
| --- | --- | --- |
| Sinal de slug novo consultava a URL antiga tombstonada | Transporte real do controller recebe o slug validado do sinal, conserva checagem de UUID e versões; leitura antiga em voo não substitui o alvo novo | Corrigido; regressão RED→GREEN |
| Cleanup após exclusão recebe409 por referência na revisão anterior e é esquecido | Proteção do backend está correta; falta conservar/concluir o trabalho de limpeza quando as referências saírem | **Pendente** |
| Falha no descritor/PUT perde a identidade do upload e acumula reservas | Falta conectar replay da mesma reserva e reconciliação segura de reservas abandonadas; expiração sozinha não libera quota | **Pendente** |
| Ação não admitida fica incerta e status404 bloqueia a interface para sempre | Após404 autenticado específico, disponibilizar reenvio **manual** da mesma ação/chave; payload congelado somente em memória, máximo24h, descartado no logout/receipt/unmount | Corrigido; três testes inicialmente vermelhos e proteções de logout/expiração verificadas |
| Carrinho mantém preço/opções antigos e permite confirmar | Manter seleção original visível, bloquear confirmação se preço/opções/disponibilidade mudaram e exigir remoção/reinclusão explícita do item alterado; sem apagar itens não afetados | Corrigido; local e delivery RED→GREEN |
| Resposta antiga de checkout continua enquanto o próximo restaurante carrega | Invalidar continuidade na mudança do recurso solicitado, antes de obter o próximo UUID; esconder o catálogo anterior em URL desconhecida, preservar rename canônico conhecido, impedir continuidade após unmount | Corrigido; local e delivery RED→GREEN |

A passagem de correções é única e ainda está em andamento: não solicitar outra revisão para substituir os testes dos ajustes. Achados2/3 continuam bloqueantes, assim como os gates remotos anteriores.

## Verificações deste checkpoint

- `npm test`: **307/307**,58 arquivos, exit0.
- `npm run typecheck`: app e node/Vite, exit0.
- `npm run lint`: exit0, zero erros/quatro avisos anteriores de hooks. Avisos React Router/Radix da suíte permanecem registrados.
- Slug: teste integrado do transporte+controller reproduziu versão11 presa na rota antiga e passou após a correção;38 testes direcionados aprovados.
- Ação incerta:27 testes direcionados de hook/status/owner pages aprovados, incluindo chave original e patch privado sem revisão pública.
- Navegação:23 testes direcionados aprovados, mantendo a próxima busca pendente durante a resposta antiga.
- Carrinho:26 testes direcionados aprovados, incluindo integração das duas páginas; servidor não foi alterado para confiar em preços do browser.

Esses números são locais; não equivalem a CI remoto nem a catálogo ativado. Código da API não foi alterado nesta primeira parte. A checagem de CPU e a composição remota continuam sem certificação.

## Decisões e alcance da revisão

- Recuperação incerta só permite reenvio após o404 específico `catalog_operation_not_found`, com a identidade/payload originais e dentro da janela de memória24h. Não usar404 genérico nem criar outra chave para uma criação ambígua. Custo da decisão: após expirar/fechar a página, é necessária reconciliação autenticada, não replay inseguro.
- Carrinho alterado exige remover e adicionar novamente o item em vez de aceitar silenciosamente um novo preço/opção. Custo: mais uma ação do cliente nos itens afetados; não existe cobrança automática por sinal de catálogo.
- Ativação, CPU, writers ativos, roles/Hyperdrive, bootstrap e rollback remotos foram deliberadamente deixados fora do parecer local: exigem evidência própria e autorização. Custo: não há liberação de produção por testes ou revisão local.
- Mudanças anteriores de infra/auth/billing/pagamentos fora desses intervalos continuam na revisão de integração da migração. Custo: interações entre funcionalidades ainda podem impedir integração; este parecer não as certifica.
- Retenção de operações7dias e fencing conservador de objetos incertos permanecem escolhas aprovadas. Custo: retenção limitada e bytes de objetos incertos continuam contabilizados; não liberar reserva apenas pelo relógio.
- Teto financeiro global e bloqueio de chamadas diretas ao provedor não são garantidos. Custo: controles de custo/abuso e gate operacional continuam necessários; nenhum plano pago foi contratado.
- Refatoração geral/estilo dos módulos compactos não foi incluída sem defeito concreto de usuário. Custo: manutenção estilística adiada, sem renunciar aos seis defeitos funcionais.

## Readback estático separado

Em18/10, dois GETs, sem credenciais nem execução de JavaScript, conferiram HTML e entry públicos em `https://vapt.app.br`: ambos200, `/assets/index-Bt91v9Le.js`,361086 bytes UTF8, SHA256 `36b9fda5a6c0521ad90a4b77402d812437d98188c92e81b316d160853555fca5`. Literais das flags novas **não foram observados** pela extração; isso não prova seu valor nem cobertura de todos os clientes/writers. Não houve login, chamada à API/banco, teste de escrita ou publicação. Uma tentativa inicial foi recusada pela rede do sandbox e não foi interpretada como indisponibilidade do site.

Total formal continua7/10; plano principal na Etapa13. Referências: [plano](infra-migration-public-catalog-event-driven-plan.md), [rollout](infra-migration-public-catalog-rollout.md), [writers](infra-migration-public-catalog-writers.md).
