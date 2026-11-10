# Catálogo público: candidato reader/eventos — 06/11/2026

## Resultado deste checkpoint

O frontend **reader + writer** foi compilado localmente com o builder já existente (`scripts/catalog-production-build.mjs`). Nenhuma funcionalidade foi reimplementada e nenhuma flag remota foi alterada. O artefato não foi publicado.

| Verificação executada | Resultado |
| --- | --- |
| Suíte completa frontend, Vitest | 74 arquivos / 383 testes aprovados |
| TypeScript app + node, sem emissão | Ambos exit 0 |
| Testes existentes de build, uploader, controles e publicação | 91/91 aprovados |
| Build reader-writer real, Vite | Exit 0, 91 arquivos / 1.528.496 bytes |
| Readback independente dos arquivos e SHA-256 | Aprovado |
| Uploader existente com bytes reais e portas inteiramente simuladas | 90 assets públicos conferidos byte a byte; zero requisições a provedores |

Os testes de catálogo na suíte cobrem a leitura por sinal/versionamento, ausência de polling periódico no controlador estável e reconexão. São provas locais; não demonstram por si só que o frontend publicado ou todos os consumidores atuais já usam esse caminho.

## Identidade e configuração do candidato

- BASE frontend: `5e752f0e991490c82a060b73bd21f8415bc1dc7c`.
- API de referência, não modificada neste checkpoint: `8fc9de0b4a42082ed696c6da367434c0137899aa`.
- Árvore frontend `src`: `abf974816819797ba8ef88ec1edd215e4c3580a0`, inalterada.
- Fase explícita: `reader-writer`; writer e eventos true **somente no novo artefato local**; imagens R2, realtime ligado, Turnstile ligado e pagamentos sandbox.
- API pública fixada pelo builder: `https://api.vapt.app.br`; env files desativados no build, sem encaminhar variáveis privadas.
- Diretório local ignorado: `.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/catalog-frontend-reader-writer-candidate-v1/`.
- Agregado SHA-256 do manifesto ordenado: `626c153effceb2beae556f7576a3ea79bdf61708626852df0ea1044a927fe2c9`.
- `candidate-proof.json` é evidência local, não asset público. `_headers` vira metadado, não upload público. Os 90 assets cabem no limite atual de 90 entradas do transporte de produção; não há margem para adicionar outro asset sem reavaliar esse limite.

O diretório estava ausente antes da compilação. A preparação usou criação exclusiva e não sobrescreveu o candidato writer-only nem os diretórios `dist-production*`. O readback verificou a lista exata, tamanhos e hashes; depois exerceu o uploader real com transportes simulados, conferindo exclusão de proof/headers e igualdade dos bytes.

Os builds comuns continuam catalog-off e os aliases de deploy continuam bloqueados. O builder candidato não é autorização de publicação nem evidência de readback remoto.

## Próximo gate e limites

O transporte `scripts/catalog-writer-controls.mjs` e a montagem `scripts/catalog-writer-publication.mjs` exigem reader=false e a transição inicial writer=false → true. Portanto, **não servem para ativar este reader sobre o writer já ativo**. Não flexibilizamos esses guardas nem repetimos a janela consumida de writer.

Próxima preparação: gate dedicado que parta do writer=true, preserve recursos/secrets/CPU e billing, confira artefatos API/frontend e baseline viva, registre tentativa/confirmação sem retry automático e tenha rollback explícito apenas do reader/eventos, mantendo o executor do writer. Antes da ativação, conferir cobertura dos consumidores/writers realmente ativos, privacidade atual do bucket e estado de projeções/pendências. Os inventários históricos de código não provam ausência de writers externos ativos.

As provas funcionais de onboarding e imagens já encerradas não serão refeitas; tampouco será criado restaurante artificial apenas para bootstrap de um conjunto vazio. A [prova composta de recuperação local](infra-migration-catalog-pending-recovery-2026-11-06.md) também não será apresentada como prova de entrega de alarmes remotos ou falha Hyperdrive/Neon.

Nenhuma chamada Cloudflare/Neon, credencial nova, login, upload remoto, recurso, plano pago, schema, deploy, flag, billing, DNS, push ou main neste checkpoint. O estado remoto citado em relatórios anteriores não foi consultado novamente aqui. Não há promessa de teto financeiro global nem economia em produção já medida.

Avisos observados: React Router future flags nos testes e base Browserslist antiga no build; nenhum erro de build/teste. Não houve atualização de dependências. A primeira execução do readback foi bloqueada pelo sandbox ao executar `git` filho (EPERM); a mesma verificação passou com permissão de processo, sem mudar o código para contornar o guard.

## Evidências locais

No workspace ignorado do plano:

- `catalog-reader-candidate-brief.md` e `prepare-catalog-frontend-reader-candidate-v1.mjs`;
- `verify-catalog-frontend-reader-candidate-v1.mjs` e o proof dentro do candidato;
- `catalog-reader-candidate-build-2026-11-06.log`;
- `catalog-reader-candidate-verify-2026-11-06.log`;
- `catalog-reader-frontend-tests-2026-11-06.log`;
- `catalog-reader-operators-2026-11-06.log`.

Esses arquivos locais não fazem parte de um push; este relatório versionado conserva a identidade e as limitações da prova. T5/T9/T10 e a Etapa 13 continuam abertas. O total formal do subplano permanece 7/10, não uma porcentagem de esforço restante. Integração das branches/main e aposentadoria da infraestrutura seguem gates próprios, não consequências automáticas deste build.
