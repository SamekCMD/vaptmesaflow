# Fase 3 — Supabase Storage para Cloudflare R2

Status em 24/09/2026: implementação local pronta para validação; nenhum objeto foi copiado. Somente o bucket vazio de preview possui acesso público temporário por `r2.dev`.

## Baseline remoto confirmado

Uma consulta somente leitura ao Cloudflare R2 confirmou, nos dois ambientes:

| Bucket | CORS | Domínio personalizado | URL `r2.dev` |
| --- | --- | --- | --- |
| `vapt-assets-preview` | aplicado para `PUT` das origens de preview | nenhum | `https://pub-c7718cfb495f4c83866dfe3ed8c52890.r2.dev` |
| `vapt-assets-production` | não configurado | nenhum | desabilitada |

Antes da aplicação do CORS, o erro `10059` retornado ao listar a política confirmou que ela ainda não existia. Após autorizações explícitas, a política versionada e o acesso `r2.dev` foram habilitados somente no preview e conferidos remotamente. O bucket de preview permanece vazio (`object_count: 0`, `bucket_size: 0 B`), e uma leitura de uma chave inexistente respondeu `404`. Um preflight `OPTIONS` da origem de preview retornou `204` com os cabeçalhos CORS esperados; a mesma solicitação partindo de uma origem não autorizada retornou `403`. Produção permaneceu inalterada.

Rollback imediato do acesso público de preview:

```bash
npx wrangler r2 bucket dev-url disable vapt-assets-preview
```

## Escopo confirmado

A auditoria do código não encontrou MinIO nem cliente S3 em uso. O storage efetivo é o bucket público `menu-images` do Supabase Storage:

- chave preservada: `restaurantId/itemId`;
- limite atual no frontend: 5 MiB;
- MIME aceito: `image/jpeg`, `image/png` ou `image/webp`;
- referência persistida: URL completa em `menu_items.image_url`;
- destinos já criados: `vapt-assets-preview` e `vapt-assets-production`.

Logos continuam fora desta cópia: `restaurants.logo_url` armazena uma URL, mas não existe fluxo de upload de logo nos repositórios auditados.

## Contrato implementado

Enquanto a API ainda roda em Docker/VPS, ela usa a API S3 compatível do R2.

1. O frontend redimensiona a imagem e solicita `POST /restaurants/:restaurantId/menu-items/:itemId/image/upload`.
2. A API valida o JWT, a propriedade do restaurante, a associação do item, o MIME e o tamanho máximo.
3. A API devolve uma URL `PUT` assinada por no máximo 300 segundos para uma única chave, MIME e tamanho.
4. O navegador envia o blob diretamente ao R2 sem receber credenciais permanentes.
5. A exclusão passa por `DELETE /restaurants/:restaurantId/menu-items/:itemId/image` e é executada pela API.

As rotas só são registradas quando toda a configuração R2 está presente. O bucket de preview e o de produção devem usar credenciais e URL pública próprias.

O frontend mantém `VITE_MENU_IMAGE_STORAGE_MODE=disabled` por padrão e só chama essas rotas quando o valor é alterado explicitamente para `r2`. Isso impede que um deploy de frontend se antecipe à configuração da API, do domínio público e do CORS.

## Configuração da API

Variáveis obrigatórias para habilitar o módulo:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
R2_UPLOAD_URL_TTL_SECONDS=300
```

O token R2 deve ter apenas leitura e escrita de objetos no bucket do ambiente. Credenciais não entram no frontend, no Git nem nos relatórios de migração.

Em 24/09/2026, o token de conta `vapt-api-preview-r2` foi criado com `Object Read & Write` restrito exclusivamente a `vapt-assets-preview`, TTL permanente e sem filtro de IP. Os valores da Access Key e da Secret Key não foram registrados neste repositório.

Ruling operacional posterior: não implantar esta mudança na API atual do Coolify nem voltar DNS para a Hetzner. O token foi validado por um smoke local efêmero contra o R2 de preview e será usado apenas durante a migração enquanto necessário. O runtime seguinte da API será Cloudflare.

O smoke criou uma chave aleatória sob `codex-smoke/`, confirmou `HeadObject`, MIME, tamanho, leitura pública `200` e igualdade do conteúdo, removeu exatamente a chave criada e reconfirmou `404`. O bucket retornou a `object_count: 0` e `bucket_size: 0 B` após a limpeza.

URLs canônicas propostas, ainda não criadas:

- preview: `https://assets-preview.vapt.app.br` → `vapt-assets-preview`;
- produção: `https://assets.vapt.app.br` → `vapt-assets-production`.

Até a criação do domínio canônico de preview, o endpoint temporário é `https://pub-c7718cfb495f4c83866dfe3ed8c52890.r2.dev`.

## Estado do CORS

O bucket precisa aceitar o `PUT` assinado a partir das origens reais do frontend e expor `ETag`. A política final deve listar origens explícitas; não usar `*`.

```bash
npx wrangler r2 bucket cors set vapt-assets-preview \
  --file infra/cloudflare/r2-cors-preview.json

npx wrangler r2 bucket cors set vapt-assets-production \
  --file infra/cloudflare/r2-cors-production.json
```

As políticas versionadas usam o formato do Wrangler. A origem de preview isolada e
`localhost` aparecem somente no bucket de preview; a política de produção contém apenas
as duas origens públicas planejadas. Em 24/09/2026, somente a política de preview foi aplicada e validada; o comando de produção continua não executado.

## Inventário e cópia

O utilitário fica em `vapt-api` e opera em dry-run por padrão:

```bash
npm run storage:migrate -- --report=r2-dry-run.json
```

Ele:

- lista recursivamente o bucket Supabase;
- preserva a chave e o `Content-Type`;
- compara tamanho, MIME e o ETag de origem gravado como metadata no R2; quando a origem não fornece ETag, usa chave e data de atualização preservadas;
- classifica cada objeto como `missing`, `needs-copy` ou `verified`;
- não copia nem remove nada em dry-run;
- reserva o relatório com `wx` antes de qualquer acesso ou cópia, recusando sobrescrever um arquivo existente;
- finaliza um relatório parcial com `fatalError` caso uma falha interrompa o processamento.

A cópia exige dois sinais explícitos:

```powershell
$env:R2_MIGRATION_CONFIRM_BUCKET = "vapt-assets-production"
npm run storage:migrate -- --apply --report=r2-apply.json
```

No modo `--apply`, cada objeto é baixado da origem e enviado por `PutObject` com:

- verificação de tamanho antes do envio;
- `Content-MD5` para integridade durante o upload;
- SHA-256 calculado e persistido como metadata;
- ETag e data de atualização da origem preservados como metadata;
- `HeadObject` após o upload para validar tamanho, MIME, ETag de origem e SHA-256.

O utilitário nunca apaga objetos de nenhum lado.

## Sequência de cutover

1. Restaurar a disponibilidade pública do Supabase atual ou fornecer uma rota de acesso segura para a origem.
2. Usar o token R2 já limitado ao bucket de preview para validar o fluxo completo no próximo runtime Cloudflare da API; não implantar no Coolify.
3. Validar o fluxo contra a URL temporária `r2.dev`, já habilitada junto com o CORS somente em preview.
4. Executar dry-run de produção e arquivar o relatório fora do repositório.
5. Corrigir toda divergência até o inventário ficar integralmente verificável.
6. Criar o token de produção, conectar `assets.vapt.app.br` e aplicar CORS após confirmação explícita.
7. Executar a cópia inicial com `--apply` e repetir o dry-run até todos os objetos ficarem `verified`.
8. Exportar uma relação reversível `menu_items.id, image_url` antes de alterar o banco.
9. Abrir a janela coordenada: suspender temporariamente mutações de imagem, executar uma cópia delta e repetir a verificação até zero divergências.
10. Configurar `VITE_MENU_IMAGE_STORAGE_MODE=r2`, publicar a API já habilitada e o frontend, e então atualizar apenas URLs com o prefixo antigo de `menu-images` para o domínio canônico.
11. Reabilitar mutações e validar upload, substituição, remoção e leitura no dashboard, cardápio público e delivery, em desktop e mobile.
12. Manter a origem antiga disponível e sem novos uploads durante a janela de rollback.

## Gates atuais

- a origem Supabase configurada não responde aos testes TCP/HTTPS feitos nesta execução;
- o token S3 de preview foi validado localmente, mas por decisão operacional não será injetado no runtime Coolify atual;
- o smoke direto de escrita, leitura pública e remoção no R2 de preview passou e não deixou objetos residuais;
- o bucket de preview está vazio, com CORS aplicado e acesso público temporário por `r2.dev`, mas ainda sem domínio canônico;
- o bucket de produção continua privado, sem domínio público e sem CORS;
- portanto inventário real, cópia, alteração de URLs e cutover permanecem deliberadamente não executados.

Nenhum desses gates depende da infraestrutura legada de frontend.
