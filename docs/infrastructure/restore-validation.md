# Validação de restore da Vapt

Este runbook prova restauração; backup criado não basta. Execute em host descartável, sem apontar DNS de produção e sem reutilizar volumes da instância ativa.

1. Exporte o compose efetivo e seus arquivos montados do Coolify e recrie a mesma stack da [matriz observada](../../infrastructure/supabase/deployed-stack.md), com chaves descartáveis. A instalação atual não tem `.supabase-version` registrada; não atribua uma release upstream fictícia.
2. Restaure o dump Postgres e o backup do backend físico do Storage em volumes vazios.
3. Inicie a stack e verifique saúde interna de Postgres, Auth, REST, Storage, Realtime e gateway.
4. Rode `scripts/apply-supabase-migrations.sh`; versões já presentes precisam ter o mesmo SHA-256, e qualquer divergência deve falhar.
5. Execute todos os arquivos `supabase/tests/*_test.sql` como `postgres`. Cada um deve terminar em `finish()` sem `not ok` e fazer `rollback`.
6. Crie um usuário descartável já confirmado sem exercitar o WIP de email. Valide login, refresh de sessão, JWKS/HS256 conforme a configuração ativa e bootstrap `auth.users → organization_members → organizations → restaurants`.
7. Como dois usuários de organizações diferentes, valide leitura/alteração permitida no próprio tenant e negação cruzada em restaurantes, pedidos, subscriptions e objetos do Storage.
8. Faça upload e download nos buckets `menu-images` e `restaurant-assets`; reinicie Storage e confirme persistência. Valide que paths de outra organização são negados.
9. Assine Realtime de `orders`, altere somente `status` com um membro autenticado e confirme um evento no tenant correto. Confirme que alteração direta de `payment_status` é negada.
10. Crie pedido público pela API, consulte-o com `X-Vapt-Order-Token`, confirme pagamento manual em usuário autorizado e valide um fluxo sandbox do Mercado Pago. n8n e Stripe devem continuar indisponíveis.
11. Faça nova cópia de backup, destrua apenas o host descartável e repita o restore uma segunda vez. Registre release, checksums, duração, RPO/RTO observado e resultado de cada prova.

`pg_dump` cobre objetos e dados do PostgreSQL, mas não contém objetos binários do backend de Storage/MinIO, volumes/configuração do gateway, secrets, chaves JWT, configuração Auth, certificados, DNS, configuração Coolify/Vercel nem backups externos. Esses itens exigem cópia e restore próprios.
