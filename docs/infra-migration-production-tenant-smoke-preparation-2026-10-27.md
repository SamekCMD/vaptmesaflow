# Login e isolamento de unidades em production — preparação 27/10/2026

A API já está aberta. Esta preparação acrescenta uma validação positiva de sessão e isolamento, sem republicar código nem repetir Stripe/Resend.

## Escopo do teste

Reutiliza o operador de preview com entradas separadas e estritas para production: API `https://api.vapt.app.br`, origem `https://vapt.app.br`, banco `vapt` no endpoint direto de production com TLS verificado. O operador de preview continua recusando production.

São cinco usuários sintéticos `example.invalid`, duas organizações e três unidades. Os dados incluem assinaturas simuladas Business/Pro, sem objetos ou chamadas Stripe. O teste verifica os papéis owner/admin/manager/staff, bootstrap, unidades acessíveis, limites de plano, seleção persistente de unidade, negativas entre organizações, negativa de alteração por staff e logout com invalidação real da sessão. Não constitui teste de todo CRUD permitido.

Não faz signup, envio de email, pagamento, Checkout, criação de pedidos, upload, publicação de catálogo, alteração de schema/grants, deploy, DNS ou main. Billing permanece pausado e flags do catálogo permanecem desativadas.

## Desafios e limpeza

Cada login de production exige um Turnstile real e diferente, concluído pelo usuário quando necessário. Não reutiliza dummy tokens de preview nem credenciais Access/bearer. A página local só inicia após o clique em **Iniciar testes**; antes disso não busca credenciais nem cria dados remotos.

O coletor fica apenas em `127.0.0.1`, porta aleatória, com verificação de Host/Origin/nonce e corpo limitado. Senhas, conexão do banco e cookies nunca são enviados à página. Os desafios transitam em memória e não aparecem no status, recibos, Git ou logs. A consulta periódica do status é somente local, não consulta o banco.

Há prazo de 20 minutos e espaçamento padrão de 3,3 segundos entre requisições. A limpeza só remove IDs sintéticos do manifesto, após conferir marcadores, ownership e relações sob locks. Dados de terceiros ou efeitos inesperados fazem a limpeza parar; não se tenta esvaziar o banco. COMMIT incerto interrompe sem repetição ou exclusão cega.

## Evidência local

- 445 testes dos scripts: passaram, sem falhas ou skips.
- 704 testes da API: passaram nesta preparação; nenhuma fonte runtime foi alterada depois.
- 2 testes em PostgreSQL local real, preview e production: seed, hashes BetterAuth, sessões/preferências e limpeza comprometida passaram. Não representam TLS ou login remoto.
- 26 testes focados incluem entradas/isolamento, vazamentos, logout, limpeza incerta, expiração, desafios duplicados e coletor HTTP local. Os novos comportamentos foram observados falhando antes da implementação.

O controlador de uso único fica no workspace ignorado do plano, `production-tenant-session-smoke-v1-controller.mjs`. Antes de criar fixtures, exige readback atual da API aberta/configurações/fila pausada e quota Neon216000s/compute fixo0,25CU; depois grava marcador exclusivo e manifesto público sintético. Não repetir o controlador após marcador consumido sem reconciliar o resultado.

**O teste remoto ainda não foi executado neste checkpoint.** A preparação e os testes locais não fecham o gate positivo de production. Após os desafios, o recibo deve confirmar os cinco logins e a limpeza; em caso de incerteza, preservar manifesto e investigar somente os IDs envolvidos.

Etapa13 e os gates de catálogo/estabilidade/integração continuam abertos. Não há garantia de teto global de fatura. As fontes congeladas de frontend/API e os deployments existentes permanecem inalterados.
