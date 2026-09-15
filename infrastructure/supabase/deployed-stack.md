# Matriz observada da stack Supabase

Inventário somente-leitura feito no Coolify em 15/09/2026. Ele documenta o estado encontrado; não substitui a exportação do compose efetivo nem contém segredos.

| Recurso | Imagem | Estado observado |
|---|---|---|
| Gateway | `kong/kong:3.9.1` | saudável |
| Studio | `supabase/studio:2026.03.16-sha-5528817` | saudável |
| Analytics | `supabase/logflare:1.31.2` | saudável |
| Vector | `timberio/vector:0.53.0-alpine` | saudável |
| PostgREST | `postgrest/postgrest:v14.6` | em execução, healthcheck excluído |
| Auth | `supabase/gotrue:v2.186.0` | saudável |
| Realtime | `supabase/realtime:v2.76.5` | saudável |
| MinIO | `ghcr.io/coollabsio/minio:RELEASE.2025-10-15T17-29-55Z` | saudável |
| Inicializador MinIO | `quay.io/minio/mc:latest` | encerrado após bootstrap |
| Storage API | `supabase/storage-api:v1.44.2` | saudável |
| Imgproxy | `darthsim/imgproxy:v3.30.1` | saudável |
| Postgres Meta | `supabase/postgres-meta:v0.95.2` | saudável |
| Edge Runtime | `supabase/edge-runtime:v1.71.2` | saudável |
| Supavisor | `supabase/supavisor:2.7.4` | saudável |
| PostgreSQL | `supabase/postgres:15.8.1.085` | saudável |

Domínio público confirmado: `https://supabase.vapt.app.br`, roteado pelo Kong na porta interna 8000. O volume de dados do PostgreSQL está montado em `/var/lib/postgresql/data`; Storage/MinIO compartilham o diretório persistente de objetos. O Coolify reportou zero agendas e zero execuções de backup.

Há alterações não salvas já presentes no serviço Coolify. Elas não foram criadas, salvas nem descartadas por esta auditoria. Antes de qualquer edição do compose, o responsável deve exportar/diferençar esse estado e decidir se ele deve ser preservado.
