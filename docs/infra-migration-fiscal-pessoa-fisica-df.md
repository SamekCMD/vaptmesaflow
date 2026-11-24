# Roteiro fiscal — Vapt como pessoa física no Distrito Federal

Referência: 24/11/2026. **Regularização fiscal pendente.** Este documento prepara a consulta e a execução das decisões fiscais; não comprova autorização para explorar o SaaS como pessoa física.

## Estado confirmado

| Item | Situação |
| --- | --- |
| Operação | SaaS de gestão de restaurantes, com assinaturas mensais |
| Titular | Pessoa física no Distrito Federal |
| Cadastro fiscal | Titular informou não ter inscrição de ISS/CF/DF nem orientação contábil |
| Planos | R$ 97, R$ 197 e R$ 347 por mês, como preços finais |
| Categoria técnica Stripe | `txcd_10103001` — SaaS para uso empresarial, sem download |
| Preços Stripe | Todos os preços de Test e Live configurados como `inclusive` |
| Cálculo automático | `automatic_tax` não habilitado |

A categoria e o comportamento dos preços são configurações técnicas. Não definem código de serviço brasileiro, alíquota, regime, inscrição ou imposto efetivamente recolhido. Não há cadastro ou alíquota fiscal presumidos neste roteiro. Os valores finais dos planos devem ser levados ao profissional para calcular as obrigações eventualmente contidas nesses preços.

## 1. Confirmar o enquadramento antes de cadastrar ou recolher

Levar a descrição do serviço e o contrato/termos à SEEC-DF e a um contador para definir:

- Se a exploração do SaaS pode permanecer como pessoa física ou exige atuação como pessoa jurídica.
- Natureza da receita, código de serviço e eventual CNAE aplicável.
- Incidência, regime, base de cálculo, valor/alíquota e possíveis retenções de ISS.
- Necessidade de CF/DF, procedimento de cadastro e tratamento da data de início das atividades.
- Obrigação ou faculdade de emissão de NFS-e, emissor e dados fiscais necessários.
- Tratamento de IRPF, eventuais retenções, Carnê-Leão, declaração anual e obrigações previdenciárias.
- Tratamento das receitas anteriores, se existentes, e adequações aplicáveis a partir de 2027.

A lista da [LC 116/2003](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm) inclui licenciamento ou cessão de uso de programas no item 1.05. Isso não define sozinho o enquadramento específico do Vapt. O [Decreto DF 25.508/2005](https://www.sinj.df.gov.br/sinj/Norma/46110/exec_dec_25508_2005_rep.html), art. 61, define autônomo a partir da execução pessoal do serviço; o art. 62 inclui a atividade de programador. **A venda recorrente de licença/acesso a um SaaS não equivale automaticamente ao trabalho pessoal de programador autônomo.** A classificação permanece pendente.

### Texto pronto para consulta

> Resido no Distrito Federal e atualmente opero como pessoa física, sem inscrição de ISS/CF/DF e sem orientação contábil. Disponibilizo um SaaS de gestão de restaurantes por assinatura mensal, sem download, com planos finais de R$ 97, R$ 197 e R$ 347. A cobrança ocorre pela Stripe; a categoria técnica é txcd_10103001, os preços de teste e produção são inclusive e automatic_tax não está habilitado. Preciso confirmar se a exploração dessa atividade pode permanecer como pessoa física ou requer pessoa jurídica; qual a natureza da receita, código de serviço e eventual CNAE; qual cadastro, regime e recolhimento de ISS se aplicam; se devo emitir NFS-e e por qual emissor; e como tratar IRPF, retenções, previdência e receitas anteriores, se existentes. Também solicito orientação sobre as mudanças de 2027. Não possuo enquadramento, alíquota ou regime fiscal previamente validados. Quais documentos e procedimentos são necessários?

Não incluir CPF, endereço completo, credenciais ou documentos pessoais em repositório. Fornecê-los somente no canal oficial apropriado quando solicitados.

## 2. Preparar os dados para a decisão

- Descrever o que o cliente recebe: licença/acesso, hospedagem, suporte e serviços adicionais, quando existentes.
- Separar contrato/termos, data da primeira prestação/receita e histórico de recebimentos, se houver.
- Conciliar por mês e cliente: CPF/CNPJ e país da fonte pagadora, receita bruta, taxas Stripe, reembolsos, retenções informadas e repasse líquido. Manter dados pessoais fora deste arquivo.
- Separar comprovantes de despesas para análise de eventual dedutibilidade; não presumir que o repasse líquido da Stripe seja a base tributável.
- Preparar documentos de identificação e residência e os demais documentos que o atendimento oficial solicitar.

## 3. Executar somente o cadastro e a emissão que forem confirmados

Como regra, o art. 12 do Decreto DF 25.508/2005 exige inscrição do contribuinte de ISS antes das atividades e prevê exceções. Como o titular ainda não possui CF/DF, a necessidade e o caminho correto dependem da classificação acima.

**Se confirmado o enquadramento como profissional autônomo:** a [carta de serviço da Receita DF, atualizada em 30/04/2026](https://www.receita.fazenda.df.gov.br/aplicacoes/CartaServicos/servico.cfm?codCategoriaServico=12&codServico=337&codSubCategoria=73&codTipoPessoa=22) orienta solicitar inscrição pelo Atendimento Virtual: **Pessoa Física → Cadastro Fiscal do DF → Pessoa Física – ISS Autônomo – Solicitar Inscrição ou Alteração**. Informa prazo de atendimento de 30 dias; a lista de documentos é apresentada no atendimento. Não protocolar esse enquadramento apenas porque o sistema oferece a opção.

**Se inscrito no CF/DF e enquadrado no ISS fixo do art. 62:** a [IN DF 15, de 28/10/2026, publicada em 29/10/2026](https://www.sinj.df.gov.br/sinj/Norma/2c7f13b6ecfd44829b325f597809b683/seec_sert_int_15_2026.html) exige uso exclusivo do [Emissor Nacional da NFS-e](https://www.nfse.gov.br/EmissorNacional) quando emitir documentos de competências desde **01/11/2026**. A norma preserva a facultatividade de emissão desse enquadramento e o regime de recolhimento do ISS. Não estender essa regra a toda pessoa física ou a todo SaaS. A obrigação efetiva do Vapt ainda deve ser confirmada.

Para autônomos enquadrados, existe [consulta e emissão de DAR de ISS no portal da Receita DF](https://www.receita.fazenda.df.gov.br/aplicacoes/CartaServicos/servico.cfm?codServico=326&codSubCategoria=91&codTipoPessoa=22). Usar a categoria e o lançamento validados, sem escolher valor ou percentual por aproximação.

## 4. Apurar os rendimentos conforme a fonte e a natureza validadas

Se a receita for tratada como rendimento tributável de pessoa física recebido de outra pessoa física ou do exterior, verificar a apuração mensal do Carnê-Leão. Eventual imposto vence no último dia útil do mês seguinte ao recebimento, conforme a [Receita Federal](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao). O [serviço oficial de apuração](https://www.gov.br/pt-br/servicos/apurar-carne-leao/) permite emitir DARF e registrar dados para a declaração anual.

A Receita esclarece que rendimentos de pessoa jurídica não estão sujeitos ao pagamento do Carnê-Leão na orientação sobre [serviços prestados a PJ](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/deducoes). Confirmar retenções e declaração cabíveis. Não classificar um rendimento como exterior somente pelo uso da Stripe: identificar a fonte efetiva para análise.

## Pendências para o fechamento fiscal

- [ ] Classificação PF/PJ e natureza da receita documentadas por orientação profissional/oficial.
- [ ] Código, regime, cadastro devido e regras de retenção definidos.
- [ ] Cadastro necessário efetivado e situação validada pelo órgão competente.
- [ ] Procedimento de NFS-e definido e habilitado, quando aplicável.
- [ ] Rotina de conciliação, apuração, recolhimento e declaração estabelecida.
- [ ] Receitas anteriores e transição para 2027 analisadas, quando aplicáveis.

O titular precisa fornecer os dados reais e realizar ou autorizar os atos nos canais autenticados. A administração tributária deve validar o cadastro quando exigido. Este roteiro não realiza protocolo, emissão fiscal, pagamento ou declaração e **não encerra a regularização fiscal**.
