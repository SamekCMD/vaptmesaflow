# Writer de catálogo — prova funcional em produção, 27/10/2026

Resultado funcional: **42 verificações aprovadas em15 requests HTTP**, usando o Worker já publicado `https://api.vapt.app.br`. Um owner verificado, uma organização Business e um restaurante sintético, sem clientes reais. Esta prova não conclui toda a migração nem autoriza reader/main.

## O que foi comprovado

- Login humano/Turnstile real e Better Auth; quatro requests de autenticação no ciclo completo, incluindo logout e verificação401 da sessão antiga.
- Criação de item com variações; replay deliberado da mesma chave, sem nova versão; disponibilidade/variações; patch privado sem revisão pública; patch misto; exclusão do item; rebuild e consulta/retry manual de operação já terminal.
- Seis recibos `ready`, `committed:true`, `retryable:false`: cinco versões públicas crescentes1–5 e uma versão privada nula. `probe.ok:true`, `uncertain:false`.
- Aposentadoria real com SQL ownership/locks, logout e validação dos objetos conhecidos, CAS S3/readback, remoção dos journals/revisão exatos e readback SQL independente: ambos zero.
- Limpeza estrita da fixture confirmada depois da aposentadoria: identidades e vínculos sintéticos removidos. Pequenos fences R2 e manifesto válido são preservados intencionalmente para trabalho tardio do DO; não é remoção de todos os recursos/metadados.

## Credencial: revogada no painel, bloqueio S3 não comprovado

Foram usadas apenas credenciais Object Read & Write de `vapt-catalog-production`, validade aprovada24h, uso local máximo30min e trabalho limitado20min. Nenhum valor foi lido para outputs, enviado no chat, persistido em arquivo/Git ou passado em argv. As chaves de imagens ficaram intactas.

A primeira entrega local expirou após20min sem receber valores; o controlador não chegou a banco/seed/login. Sua chave foi revogada no painel antes de substituir. O usuário confirmou disponibilidade para a segunda tentativa. A recuperação só admitiu novo journal depois de conferir o recibo/marker anteriores por hash, ausência de fases de seed e evidência da revogação UI. Não houve replay do primeiro marker.

Ao encerrar a segunda tentativa, o token exato foi novamente excluído na Cloudflare; conferência UI mostrou zero linhas desse token e as duas chaves de imagens preservadas. A confirmação não secreta foi entregue ao controlador dentro de sua janela. Porém a única checagem assinada imediata **não retornou prova de bloqueio403**. O processo terminou, descartando as referências de credenciais, sem retry ou tentativa de recuperá-las. Não criar outra credencial nem repetir CRUD para maquiar esse resultado.

Por isso o recibo global permanece **`ok:false`, `credentialRevoked:false`**, apesar de `probe.ok:true`, `cleaned:true`, `sessionRevoked:true` e aposentadoria confirmada. O campo significa que o contrato estrito de comprovação S3 não fechou; não nega a exclusão observada no painel. O resultado persistido não foi alterado retroativamente.

A Cloudflare documenta consistência eventual nas permissões IAM do R2, com propagação que pode levar até um minuto. Isso é uma explicação **compatível**, não a causa comprovada desta resposta: o retorno seguro atual não distingue sucesso200, objeto ausente404 ou falha técnica. [Modelo de consistência R2](https://developers.cloudflare.com/r2/reference/consistency/). Em uma futura janela, preparar uma espera delimitada de propagação antes da única checagem, com orçamento de revogação apropriado; sem ampliar o corte local ou criar polling/retries automáticos.

## Desafio humano e recuperação

No Brave, o widget ficou em branco com erro300030; um F5 humano não resolveu. A mesma página, aberta manualmente pelo usuário em outro navegador normal, recebeu o desafio válido e o fluxo avançou, sem mudar proteções, usar CAPTCHA dummy, reaproveitar token ou criar novo teste. A documentação classifica300* como falha genérica de desafio; não prova configuração inválida do sitekey. [Erros do Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/).

## Evidência e limites

Workspace próprio: `D:/Projetos/vaptmesaflow/.superpowers/sdd/infra-migration-public-catalog-event-driven-plan`.

- Recibo imutável `production-catalog-writer-functional-v2-2026-10-28T00-15-54.469Z.json`; data UTC corresponde à noite de27/10 em São Paulo. SHA256 `ff92a923defad8fae8fa274fe9a65d5dfd89296ac8d17effde9cb18fcc18c8dd`.
- Início, seed, login, probe, logout, aposentadoria e limpeza possuem markers exclusivos attempt/confirmed. Revogação possui attempt, **não** confirmed. `functional-v1` e `functional-v2` estão consumidos; não reexecutar.
- Restaurante sintético `0101f510-9d88-4b9e-a453-96b1d13a6c6b`; tag `catalog-writer-56c5b5fb-8346-4ac5-8b7e-6d5038172ddc`.
- Screenshot seguro `catalog-writer-functional-v2-token-ui-revoked-2026-10-27.jpg`: lista após exclusão, sem valores de credenciais.
- Preflight independente confirmou writertrue/readerfalse, deployments/fontes/CPU1000, bucket privado, billing Cron/consumer ativos já existentes. Readiness Neon confirmou TLS1.3 owner/application, grants e compute fixo0,25CU/quota60CUh. Não prova a senha usada pelo Hyperdrive.
- Fontes runtime A `b5914e9323b74215442c2afc5e0f356f2f904c8c` / F `abf974816819797ba8ef88ec1edd215e4c3580a0` inalteradas. Nenhum deploy, flag, schema, DNS, billing, Stripe Live, email ou pagamento disparado pelo operador. Criação/revogação das chaves por UI são alterações externas reais, embora `controlPlaneWrites:0` do controlador conte apenas seu próprio transporte.

Ainda faltam provas de imagens/quota/referências, onboarding, recuperação de operações efetivamente pendentes e clientes/reader/eventos ativos. O catálogo público permanece no reader legado SQL; não declarar zero consultas ou fatura com teto garantido. Plano formal7/10 e Etapa13 continuam abertos. Sem push, merge ou alteração de main.
