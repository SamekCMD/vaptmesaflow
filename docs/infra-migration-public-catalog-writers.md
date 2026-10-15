# Inventário de writers do catálogo público

Data:15/10/2026. Escopo: [plano aprovado](D:/Projetos/vaptmesaflow/docs/infra-migration-public-catalog-event-driven-plan.md), T5. Inspeção de código local; não é prova de tráfego ou configuração remota. Flags novas seguem ausentes/desligadas nos arquivos de implantação existentes.

## Escritas de domínio

| Dados publicados | Entrada Worker | Protocolo preparado |
| --- | --- | --- |
| id, nome, slug e primeiro prato | POST /onboarding | Comando durável; UUID interno estável por owner; mesma sala para diferentes chaves; unicidade SQL de owner/slug preservada |
| name, slug, whatsapp, address, phone, hours, description | PATCH /restaurants/me | Patch público passa inteiro ao coordenador, inclusive campos privados de patch misto; só DTO público vai à projeção |
| primaryColor, secondaryColor, fontFamily, logoUrl | PATCH /restaurants/me | Mesmo comando de restaurante; sem serializar DTO administrativo |
| totalTables, maxTables, paymentMode, maxPendingOrders, localEnabled, deliveryEnabled | PATCH /restaurants/me | Mesmo comando; compra e limites continuam validados na origem |
| id, restaurantId, name, price, description, category, available, imageUrl, availableFrom/Until, badge, isChefSuggestion, prepTimeMinutes, createdAt, updatedAt | POST/PATCH/DELETE /restaurants/me/menu-items[/:itemId] | CRUD/remoção transacionais, journal e snapshot juntos; exclusividade isChefSuggestion incluída na mesma transação |
| variations: id, name, options, required e ordem | Criar/editar item | Substituição de variações dentro da mesma transação; não há endpoint avulso fora do comando |
| updatedAt do restaurante | Capturado no snapshot | Não é versão de publicação; alteração privada/billing que apenas muda updated_at não publica |
| Republicação administrativa | POST /restaurants/me/catalog/rebuild | Autenticada, limitada ao owner e à chave de operação; não aceita restaurantId arbitrário no corpo |

Os arquivos de domínio ficam na API em `src/modules/restaurants`, `menu` e `catalog`; o gateway fica em `src/worker/catalog/writer.ts` e `src/worker/routes/restaurant.ts`. Helpers transacionais preservam o caminho legado quando a flag está desligada.

CNPJ isolado não passa pelo journal público nem cria versão/socket. O protocolo opt-in pode devolver resultado autenticado com recibo ready/version=null, mas isso não significa publicação de CNPJ ou nova versão de catálogo. Patches mistos não são divididos em duas gravações.

## Escritas que não publicam

- Stripe em `src/modules/billing/stripe/repository.ts` e `webhook-repository.ts` altera cliente/assinatura/checkout/plano/status e updated_at. Nas implementações inspecionadas não altera max_tables nem outro campo público além do timestamp; não gerar evento público para esse ruído.
- Pedidos, cozinha, pagamentos, table sessions, notificações e outbox não participam deste protocolo; nada autoriza alterar seus intervals/leases nesta tarefa.
- SQL manual e scripts de smoke de infra não são CDC. Se usados para editar dados reais fora da API, exigem rebuild administrativo explícito antes da liberação do reader.

## Imagens: gate ainda aberto

Inspeção mostrou um writer adicional de **conteúdo de objeto**, não apenas de imageUrl:

- `src/modules/storage/service.ts` assina PUT sempre para a chave `restaurantId/itemId`; um segundo upload sobrescreve a mesma URL pública antes do PATCH de catálogo.
- DELETE de imagem remove essa mesma chave sem verificar snapshots publicados.
- `src/pages/dashboard/MenuManagement.tsx` remove imagem antes de excluir item; na edição também precisa distinguir gravação/publicação/limpeza.

Assim, só encaminhar CRUD ao coordenador não cobre esse writer. **Ativação permanece bloqueada** até que upload não sobrescreva uma imagem publicada, exclusão não remova um objeto ainda referenciado e a UI espere a publicação correta antes de limpar. A integração de imagens exige testes de armazenamento e frontend; não declarar T5 completa apenas porque os novos testes do gateway passaram. Não habilitar lifecycle destrutivo nem tornar bucket público para contornar o problema.

Decisão explícita revisada pelo usuário: **100 MiB (104.857.600 bytes) de imagens por restaurante**, substituindo os50MiB iniciais; soma objetos atuais, versões retidas e reservas pendentes. Seleção de JPG/PNG/WebP até5MiB; `src/lib/menu-image-optimization.ts` converte antes da assinatura/upload, preferindoWebP, maior lado até1200px, meta300KiB e teto1MiB enviado. Backend valida esse teto independentemente do navegador. FallbackJPEG apenas para fonteJPEG; PNG/WebP mantém fallbackPNG para não perder transparência. Não contratar Cloudflare Images nem instalar codec/dependência para esse fluxo. Reserva não expira financeiramente junto com a URL: um PUT com resposta perdida pode ainda estar em andamento. Só liberar bytes após descarte confirmado e protegido contra reuso da URL. A cota não é um teto da fatura de requisições Cloudflare.

Proteções locais em preparação: reserva durável antes do armazenamento, no máximo dez uploads pendentes e inventário limitado a mil objetos por restaurante, com falha fechada se o inventário não puder ser lido integralmente. Esses limites técnicos controlam trabalho/estado; não alteram o plano contratado. A compressão está integrada ao cliente local; o protocolo durável de cota/limpeza continua sem integração/ativação remota.

Medição local do encoder real Chromium em15/10, somente imagens sintéticas; tempos não representam celulares lentos nem garantia de qualidade para qualquer foto:

| Entrada | Original(bytes) | Fluxo anterior(bytes) | NovoWebP(bytes) | Tempo(ms) |
| --- | ---: | ---: | ---: | ---: |
| PNG detalhado2400×1600 | 3838014 | 160226 | 95140 | 149 |
| JPEG detalhado2400×1600 | 783798 | 159590 | 95994 | 169 |
| PNG transparente300×150 | 1592 | 1592 | 866 | 8 |
| PNG ruído1200×800 | 3303892 | 3303892 | 307120 | 614 |

Teste de transparência confirmou alfa0 no canto e pixelcentralRGBA[255,1,0,255]; arquivo corrompido foi rejeitado. O caso de ruído precisou reduzir para960×640; demais fotos ficaram1200×800 sem ampliar fontes pequenas. Não guardar originais, transformar a cada visualização, nem prometer que toda imagem terá poucosKB. Até9 encodes com qualidade0.82/0.72/0.62 em3 escalas (mais1 caso de fallback); se a meta não for atingida, aceitar apenas resultado≤1MiB ou mostrar erro, sem reduzir qualidade indefinidamente.

## Node/Coolify e outros consumidores

Fastify/Node ainda possui rotas legadas usando os mesmos repositórios com transações próprias, mas sem intenção DO anterior. Isso é compatibilidade de código, **não prova de que pode escrever no banco de produção durante o novo reader**. O gate remoto deve comprovar que nenhum writer Node/Coolify ativo contorna o protocolo, ou integrá-lo antes de ativar. Não alterar DNS, investigar Easypanel/Vercel legado, remover servidor ou presumir aposentadoria a partir deste inventário.

Clientes sem opt-in mantêm DTO/201/204 quando a operação está ready; pendência deve retornar202 explícito. Todos os clientes ativos precisam tratar esse protocolo antes do corte. Na resolução de operações, restaurantId opcional em query só pode ser o restaurante pertencente à sessão ou seu endereço de onboarding derivado pelo servidor; metadados/resultados nunca são públicos por operationId.

## Critérios de liberação

1. Testes do gateway, repositórios, imagens e frontend verdes, com prova local workerd e integração PostgreSQL real (esta última ainda pendente por falta de banco local de teste/cota remota).
2. Nenhum caminho ativo de domínio ou imagem sem cobertura; evidência de Node/Coolify e consumidores reais antes do corte.
3. Bootstrap e recursos remotos confirmados no gate próprio, inclusive privacidade real do R2 e CPU1000ms; sem novo plano pago para executar testes.
4. Nenhuma flag ligada por este documento. Rollback do reader não desliga o executor de operações aceitas.
