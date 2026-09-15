# Distribuição Supabase

A recuperação preserva a stack Coolify já instalada. A matriz observada em 15/09/2026 está em `deployed-stack.md`; ela usa Kong e PostgreSQL 15 e não deve ser trocada por uma release upstream durante este bootstrap.

O compose completo continua sendo fonte de verdade no Coolify. Este repositório versiona somente o overlay sem segredos, a matriz de imagens e os runbooks. Copiar um compose parcial para cá daria uma falsa sensação de reprodutibilidade e perderia scripts, volumes e overrides que precisam avançar juntos.

Para uma instalação futura em host novo, use uma release oficial completa de `supabase/supabase/docker`, gere as chaves com os utilitários da própria release e aplique o overlay de URLs de `.env.example`. Em 15/09/2026, `self-hosted/v0.8.1` era a release upstream atual, mas não é uma instrução para atualizar a stack recuperada. Antes de adotar uma release, registre a versão escolhida no artefato de deploy e valide backup/restore, gateway e major do PostgreSQL em ambiente descartável.

A stack atual não tinha release upstream registrada na interface. Não invente uma `.supabase-version`: primeiro exporte o compose efetivo, preserve os arquivos montados e associe-o a um release/commit verificável. Migração de gateway ou PostgreSQL é uma mudança separada, com backup externo e restore testado.

Referências: [Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker), [atualização self-hosted](https://supabase.com/docs/guides/self-hosting/updating), [chaves assimétricas](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys).
