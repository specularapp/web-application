import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { formatMoney } from "@/lib/utils/format";
import type { ContractKind, DocMark, DocNode } from "./summary";

/**
 * Os modelos prontos de contrato (2026-09-14, a pedido): um por tipo de trabalho, **na forma da norma
 * brasileira para contratos** (decisão do usuário no mesmo dia: "um documento mais sério", com a nossa
 * identidade e a nossa fonte): título em caixa alta e centrado, as partes qualificadas no preâmbulo
 * (CONTRATANTE e CONTRATADA, com os dados de identificação), as cláusulas em ordinal e caixa alta
 * ("CLÁUSULA PRIMEIRA: DO OBJETO"), os itens numerados por cláusula (1.1, 1.2, 2.1.1), o fecho com a
 * declaração de acordo e o local e a data. O que a base não sabe, como CNPJ e endereço, entra entre colchetes
 * para a pessoa preencher: é o "só editar o necessário" do pedido.
 *
 * O modelo é uma função que recebe o contexto (quem contrata, quem emite, o valor, a data) e devolve o
 * documento já preenchido, no formato do editor. O bloco de assinaturas fica de fora do texto, de propósito:
 * o sistema o desenha a partir das partes e do registro da assinatura, e não de um texto que alguém poderia
 * editar.
 */

export type TemplateContext = {
  issuer: { name: string; email?: string; city?: string };
  client: { name: string; company?: string } | null;
  /** Em centavos; nulo escreve "conforme o orçamento aprovado". */
  amount: number | null;
  /** `yyyy-MM-dd`. */
  date: string;
  project: string | null;
};

export type ContractTemplate = {
  id: string;
  kind: ContractKind;
  name: string;
  /** Uma frase sobre para que serve, na galeria. */
  summary: string;
  /** As entregas típicas, para a galeria dizer o que o modelo cobre. */
  highlights: string[];
  build: (context: TemplateContext) => { title: string; description: string; body: DocNode };
};

/* Construtores do documento, para o modelo ler como texto e não como árvore. */
const text = (value: string, marks?: DocMark[]): DocNode => ({ type: "text", text: value, ...(marks && { marks }) });
const bold = (value: string) => text(value, [{ type: "bold" }]);
const paragraph = (...content: (DocNode | string)[]): DocNode => ({ type: "paragraph", attrs: { textAlign: "justify" }, content: content.map((item) => (typeof item === "string" ? text(item) : item)) });
const centered = (value: string): DocNode => ({ type: "heading", attrs: { level: 1, textAlign: "center" }, content: [text(value)] });
const clauseHeading = (value: string): DocNode => ({ type: "heading", attrs: { level: 2, textAlign: "left" }, content: [text(value)] });
const dated = (value: string): DocNode => ({ type: "paragraph", attrs: { textAlign: "right" }, content: [text(value)] });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

const ordinals = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA", "DÉCIMA", "DÉCIMA PRIMEIRA", "DÉCIMA SEGUNDA", "DÉCIMA TERCEIRA"];

/** "CLÁUSULA PRIMEIRA: DO OBJETO", com dois pontos como separador, que é o que a regra da casa admite. */
export const clauseLabel = (number: number, subject: string) => `CLÁUSULA ${ordinals[number - 1] ?? number}: ${subject.toUpperCase()}`;
const clause = (number: number, subject: string) => clauseHeading(clauseLabel(number, subject));

/** Um item numerado da cláusula: "1.1. O presente contrato..." */
const item = (number: string, ...content: (DocNode | string)[]) => paragraph(`${number}. `, ...content);

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/* A qualificação de quem contrata: a empresa com o representante, ou a pessoa. O que a base não sabe vai
   entre colchetes, para preencher. */
function contractorQualification(context: TemplateContext) {
  if (!context.client) return "[NOME DE QUEM CONTRATA], [qualificação: CNPJ ou CPF, endereço completo]";
  const { name, company } = context.client;
  return company
    ? `${company.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº [CNPJ], com sede em [endereço completo], neste ato representada por ${name}, [cargo], portador(a) do CPF nº [CPF]`
    : `${name.toUpperCase()}, [nacionalidade], [estado civil], [profissão], portador(a) do CPF nº [CPF], residente e domiciliado(a) em [endereço completo]`;
}

function providerQualification(context: TemplateContext) {
  const seat = context.issuer.city ? `com sede em ${context.issuer.city}, [endereço completo]` : "com sede em [endereço completo]";
  return `${context.issuer.name.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº [CNPJ], ${seat}, neste ato representada na forma de seu contrato social`;
}

function amountText(context: TemplateContext) {
  return context.amount === null ? "o valor definido no orçamento aprovado, que integra este instrumento" : `o valor total de ${formatMoney(context.amount)}`;
}

/* O preâmbulo, na forma dos contratos: as partes qualificadas e a declaração de que contratam o que segue. */
function preamble(context: TemplateContext, title: string) {
  return [
    centered(title),
    paragraph("Pelo presente instrumento particular, de um lado, ", contractorQualification(context), ", doravante denominada simplesmente ", bold("CONTRATANTE"), "; e, de outro lado, ", providerQualification(context), ", doravante denominada simplesmente ", bold("CONTRATADA"), "; têm entre si justo e contratado o que segue, que mutuamente aceitam e outorgam, a saber:"),
  ];
}

function objectClause(object: string) {
  return [clause(1, "do objeto"), item("1.1", object), item("1.2", "O escopo detalhado dos serviços, quando houver orçamento aprovado entre as partes, é o nele descrito, que passa a integrar este instrumento para todos os fins.")];
}

function deliverablesClause(items: string[]) {
  return [clause(2, "das entregas"), item("2.1", "Fazem parte do escopo contratado as seguintes entregas:"), ...items.map((entry, index) => item(`2.1.${index + 1}`, entry)), item("2.2", "Entregas não previstas nesta cláusula serão tratadas como alteração de escopo, na forma da Cláusula Sétima.")];
}

function scheduleClause(...items: string[]) {
  return [clause(3, "do prazo"), ...items.map((entry, index) => item(`3.${index + 1}`, entry)), item(`3.${items.length + 1}`, "Os prazos ficam suspensos enquanto a CONTRATANTE não entregar os materiais, informações ou aprovações de sua responsabilidade, retomando a contagem a partir da entrega.")];
}

function paymentClause(context: TemplateContext, terms: string) {
  return [
    clause(4, "do valor e da forma de pagamento"),
    item("4.1", `Pela prestação dos serviços objeto deste contrato, a CONTRATANTE pagará à CONTRATADA ${amountText(context)}.`),
    item("4.2", terms),
    item("4.3", "Os valores não incluem serviços de terceiros, tais como registro de domínio, hospedagem, licenças de software e bancos de imagem, que serão contratados diretamente pela CONTRATANTE ou repassados a preço de custo, mediante aprovação prévia."),
    item("4.4", "O atraso no pagamento de qualquer parcela sujeita a CONTRATANTE a multa de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de 1% (um por cento) ao mês, e autoriza a CONTRATADA a suspender a execução dos serviços até a regularização."),
  ];
}

function commonClauses(context: TemplateContext) {
  const forum = context.issuer.city ? context.issuer.city.split(",")[0]?.trim() ?? "[cidade]" : "[cidade]";
  return [
    clause(5, "das obrigações da contratada"),
    item("5.1", "Executar os serviços com qualidade técnica e dentro dos prazos acordados, comunicando com antecedência qualquer imprevisto capaz de alterá-los."),
    item("5.2", "Apresentar as entregas para aprovação da CONTRATANTE nas etapas previstas e realizar as revisões inclusas neste instrumento."),
    item("5.3", "Manter sigilo sobre as informações da CONTRATANTE a que tiver acesso em razão deste contrato, durante e após a sua vigência."),
    clause(6, "das obrigações da contratante"),
    item("6.1", "Fornecer, em até 5 (cinco) dias úteis contados da assinatura, os conteúdos, acessos e materiais necessários à execução dos serviços."),
    item("6.2", "Analisar e aprovar as entregas em até 5 (cinco) dias úteis de cada apresentação, ficando a contagem do cronograma suspensa na ausência de resposta nesse prazo."),
    item("6.3", "Efetuar os pagamentos nas datas e na forma acordadas na Cláusula Quarta."),
    clause(7, "das alterações e revisões"),
    item("7.1", "Estão inclusas até 2 (duas) rodadas de revisão por entrega, compreendidas como ajustes sobre o que foi apresentado, dentro do escopo contratado."),
    item("7.2", "Alterações de escopo, novas funcionalidades ou revisões além das inclusas serão orçadas à parte e somente executadas após aprovação por escrito da CONTRATANTE."),
    clause(8, "da propriedade intelectual e dos direitos de uso"),
    item("8.1", "Com a quitação integral dos valores previstos neste contrato, a CONTRATANTE passa a deter os direitos de uso sobre os entregáveis finais, para os fins a que se destinam."),
    item("8.2", "Ficam reservados à CONTRATADA os direitos sobre metodologias, ferramentas, componentes reutilizáveis e arquivos-fonte de trabalho, bem como o direito de exibir o projeto em seu portfólio, salvo acordo em contrário por escrito."),
    clause(9, "da confidencialidade"),
    item("9.1", "As partes se obrigam a manter em sigilo todas as informações confidenciais a que tiverem acesso em razão deste contrato, não as divulgando a terceiros sem autorização por escrito, pelo prazo de 2 (dois) anos após o término da vigência."),
    clause(10, "da rescisão"),
    item("10.1", "Qualquer das partes poderá rescindir este contrato mediante aviso prévio, por escrito, de 15 (quinze) dias."),
    item("10.2", "Em caso de rescisão por iniciativa da CONTRATANTE, serão devidos à CONTRATADA os valores proporcionais às etapas concluídas e em andamento até a data do aviso."),
    item("10.3", "Em caso de rescisão por iniciativa da CONTRATADA sem justa causa, esta restituirá à CONTRATANTE os valores recebidos por etapas não entregues."),
    clause(11, "das disposições gerais"),
    item("11.1", "Este contrato representa o acordo integral entre as partes quanto ao seu objeto, substituindo entendimentos anteriores, e somente poderá ser alterado por instrumento escrito assinado por ambas."),
    item("11.2", "As partes reconhecem a validade jurídica da assinatura eletrônica registrada nesta plataforma, com identificação de cada signatário, data e hora, nos termos da legislação aplicável."),
    item("11.3", "A tolerância de uma parte quanto ao descumprimento de qualquer obrigação pela outra não implica renúncia ao direito de exigi-la a qualquer tempo."),
    clause(12, "do foro"),
    item("12.1", `As partes elegem o foro da comarca de ${forum} para dirimir quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`),
    paragraph("E, por estarem assim justas e contratadas, as partes assinam eletronicamente o presente instrumento, que passa a produzir efeitos a partir da última assinatura registrada."),
    dated(`${forum}, ${longDate(context.date)}.`),
  ];
}

const forProject = (context: TemplateContext, fallback: string) => (context.project ? `o projeto "${context.project}"` : fallback);

export const contractTemplates: ContractTemplate[] = [
  {
    id: "landing",
    kind: "landing",
    name: "Landing page",
    summary: "Página de captação ou de campanha, com formulário e publicação.",
    highlights: ["Layout e texto", "Formulário integrado", "Publicação e medição"],
    build: (context) => ({
      title: context.client?.company ? `Landing page ${context.client.company}` : "Landing page",
      description: "Criação de landing page com layout, formulário integrado e publicação, conforme escopo aprovado.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CRIAÇÃO DE LANDING PAGE"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de criação de uma landing page para ${forProject(context, "a campanha da CONTRATANTE")}, compreendendo layout, redação de apoio, formulário integrado e publicação em endereço indicado pela CONTRATANTE.`),
        ...deliverablesClause(["Layout da página em uma versão para computador e uma para celular, apresentado em protótipo navegável;", "Redação de apoio dos textos da página a partir do briefing fornecido pela CONTRATANTE;", "Formulário de contato ou de captação integrado à ferramenta indicada pela CONTRATANTE;", "Publicação no domínio da CONTRATANTE e configuração de medição de acessos."]),
        ...scheduleClause("O prazo de execução é de 15 (quinze) dias úteis, contados do recebimento dos materiais, em duas etapas: apresentação do layout até o 7º (sétimo) dia útil e publicação até o 15º (décimo quinto) dia útil após a aprovação do layout."),
        ...paymentClause(context, "O pagamento será efetuado em 2 (duas) parcelas iguais: a primeira na assinatura deste contrato e a segunda na publicação da página."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "institutional",
    kind: "institutional",
    name: "Site institucional",
    summary: "Site de apresentação com páginas internas, painel de conteúdo e SEO de base.",
    highlights: ["Até 6 páginas", "Painel de conteúdo", "SEO de base"],
    build: (context) => ({
      title: context.client?.company ? `Site institucional ${context.client.company}` : "Site institucional",
      description: "Desenvolvimento de site institucional com páginas internas, painel de conteúdo e SEO de base.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE SITE INSTITUCIONAL"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de desenvolvimento de site institucional para ${forProject(context, "a CONTRATANTE")}, compreendendo design, implementação, painel de conteúdo e publicação.`),
        ...deliverablesClause(["Design de até 6 (seis) páginas (início, sobre, serviços, portfólio ou casos, blog e contato), em versões para computador e celular;", "Implementação com painel para a CONTRATANTE editar textos e imagens sem depender da CONTRATADA;", "Configuração de SEO de base: títulos, descrições, mapa do site e velocidade de carregamento;", "Publicação no domínio da CONTRATANTE e treinamento de uso do painel em uma sessão remota."]),
        ...scheduleClause("O prazo de execução é de 45 (quarenta e cinco) dias corridos, contados do recebimento dos materiais, em três etapas: aprovação do design até o 15º (décimo quinto) dia, implementação até o 35º (trigésimo quinto) dia e publicação até o 45º (quadragésimo quinto) dia."),
        ...paymentClause(context, "O pagamento será efetuado em 3 (três) parcelas: 40% (quarenta por cento) na assinatura deste contrato, 30% (trinta por cento) na aprovação do design e 30% (trinta por cento) na publicação."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "ecommerce",
    kind: "ecommerce",
    name: "Loja virtual",
    summary: "Loja com catálogo, carrinho, pagamento e frete integrados.",
    highlights: ["Catálogo e carrinho", "Pagamento e frete", "Treinamento"],
    build: (context) => ({
      title: context.client?.company ? `Loja virtual ${context.client.company}` : "Loja virtual",
      description: "Desenvolvimento de loja virtual com catálogo, pagamento e frete integrados e treinamento de operação.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE LOJA VIRTUAL"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de desenvolvimento de loja virtual para ${forProject(context, "a CONTRATANTE")}, compreendendo design, catálogo, carrinho, integração de pagamento e frete e publicação.`),
        ...deliverablesClause(["Design da loja, das páginas de produto e do fluxo de compra, em versões para computador e celular;", "Cadastro inicial de até 50 (cinquenta) produtos, a partir das planilhas e imagens fornecidas pela CONTRATANTE;", "Integração com o meio de pagamento e a tabela de frete indicados pela CONTRATANTE;", "Publicação, testes de compra e treinamento de operação da loja em uma sessão remota."]),
        ...scheduleClause("O prazo de execução é de 60 (sessenta) dias corridos, contados do recebimento dos materiais, com aprovação do design até o 20º (vigésimo) dia e loja em ambiente de testes até o 50º (quinquagésimo) dia."),
        ...paymentClause(context, "O pagamento será efetuado em 3 (três) parcelas: 40% (quarenta por cento) na assinatura deste contrato, 30% (trinta por cento) na aprovação do design e 30% (trinta por cento) na publicação da loja."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "app",
    kind: "app",
    name: "Aplicativo ou sistema",
    summary: "Desenvolvimento por etapas com aceite, para aplicativo ou sistema sob escopo.",
    highlights: ["Escopo por etapas", "Aceite por entrega", "Suporte pós-entrega"],
    build: (context) => ({
      title: context.client?.company ? `Sistema ${context.client.company}` : "Aplicativo ou sistema sob escopo",
      description: "Desenvolvimento de aplicativo ou sistema sob escopo definido, com etapas de entrega e aceite.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE SOFTWARE"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de desenvolvimento de ${forProject(context, "aplicativo ou sistema")}, conforme o escopo funcional descrito no orçamento aprovado, que integra este instrumento para todos os fins.`),
        ...deliverablesClause(["Protótipo navegável das telas e dos fluxos principais, para aprovação antes do desenvolvimento;", "Desenvolvimento em etapas quinzenais, cada uma com entrega em ambiente de testes e aceite formal da CONTRATANTE;", "Publicação em produção no ambiente ou nas lojas de aplicativos indicados pela CONTRATANTE;", "Suporte a correções por 30 (trinta) dias após a publicação, sem custo adicional."]),
        ...scheduleClause("O cronograma é o do orçamento aprovado, contado a partir da aprovação do protótipo.", "Cada etapa somente é iniciada após o aceite da anterior, e a ausência de resposta da CONTRATANTE em 5 (cinco) dias úteis suspende a contagem dos prazos."),
        ...paymentClause(context, "O pagamento será efetuado em parcelas vinculadas às etapas: 30% (trinta por cento) na assinatura deste contrato e o restante distribuído igualmente nos aceites de cada etapa, conforme o orçamento aprovado."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "branding",
    kind: "branding",
    name: "Identidade visual",
    summary: "Marca, papelaria e manual, com etapas de aprovação e cessão de direitos.",
    highlights: ["Estudo e conceito", "Marca e aplicações", "Manual de uso"],
    build: (context) => ({
      title: context.client?.company ? `Identidade visual ${context.client.company}` : "Identidade visual",
      description: "Criação de identidade visual, com estudo, marca, aplicações e manual de uso, e cessão de direitos.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CRIAÇÃO DE IDENTIDADE VISUAL"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de criação da identidade visual de ${forProject(context, "a CONTRATANTE")}, compreendendo estudo, conceito, marca, aplicações e manual de uso.`),
        ...deliverablesClause(["Estudo de posicionamento e apresentação de conceito, em uma rodada;", "Marca em versões principal, reduzida e monocromática, com arquivos vetoriais e para tela;", "Aplicações em papelaria básica (cartão, assinatura de e-mail e papel timbrado) e em redes sociais;", "Manual de uso com cores, tipografia, áreas de proteção e exemplos de aplicação."]),
        ...scheduleClause("O prazo de execução é de 30 (trinta) dias corridos, contados da aprovação do briefing, com apresentação do conceito até o 10º (décimo) dia e entrega final até o 30º (trigésimo) dia após a aprovação da marca."),
        ...paymentClause(context, "O pagamento será efetuado em 2 (duas) parcelas iguais: a primeira na assinatura deste contrato e a segunda na entrega dos arquivos finais."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "uiux",
    kind: "uiux",
    name: "Design de interface (UI/UX)",
    summary: "Pesquisa, fluxos e protótipo navegável com rodadas de revisão.",
    highlights: ["Fluxos e wireframes", "Protótipo navegável", "Guia de componentes"],
    build: (context) => ({
      title: context.client?.company ? `Design de interface ${context.client.company}` : "Design de interface",
      description: "Design de interface e experiência, com fluxos, protótipo navegável e guia de componentes.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESIGN DE INTERFACE E EXPERIÊNCIA"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de design de interface e experiência de ${forProject(context, "produto digital da CONTRATANTE")}, compreendendo levantamento, fluxos, protótipo navegável e guia de componentes.`),
        ...deliverablesClause(["Levantamento de requisitos e mapa de fluxos, elaborado com a CONTRATANTE;", "Wireframes das telas principais, para validação de estrutura;", "Protótipo navegável em alta fidelidade, em versões para computador e celular;", "Guia de componentes e estilos, para orientar a implementação."]),
        ...scheduleClause("O prazo de execução é de 40 (quarenta) dias corridos, contados do levantamento, com wireframes até o 12º (décimo segundo) dia e protótipo final até o 40º (quadragésimo) dia."),
        ...paymentClause(context, "O pagamento será efetuado em 3 (três) parcelas: 40% (quarenta por cento) na assinatura deste contrato, 30% (trinta por cento) na aprovação dos wireframes e 30% (trinta por cento) na entrega do protótipo final."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "maintenance",
    kind: "maintenance",
    name: "Manutenção mensal",
    summary: "Horas mensais, atendimento e renovação automática.",
    highlights: ["Horas inclusas", "Prazo de atendimento", "Renovação automática"],
    build: (context) => ({
      title: context.client?.company ? `Manutenção ${context.client.company}` : "Manutenção mensal",
      description: "Manutenção mensal com horas inclusas, atualizações, atendimento e renovação automática.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MANUTENÇÃO"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de manutenção mensal de ${forProject(context, "site ou sistema da CONTRATANTE")}, compreendendo atualizações, correções, pequenas melhorias e atendimento.`),
        ...deliverablesClause(["Até 6 (seis) horas mensais de trabalho, não cumulativas, para atualizações, correções e pequenas melhorias;", "Atendimento em dias úteis, com resposta em até 24 (vinte e quatro) horas e correção de indisponibilidade em até 48 (quarenta e oito) horas;", "Atualização de dependências e cópia de segurança mensal;", "Relatório mensal resumido do que foi executado e das horas utilizadas."]),
        ...scheduleClause("Este contrato vigora por 12 (doze) meses, contados da assinatura, com renovação automática por períodos iguais, salvo manifestação em contrário de qualquer das partes com 30 (trinta) dias de antecedência."),
        ...paymentClause(context, "O pagamento é mensal, até o dia 10 (dez) de cada mês, mediante cobrança enviada pela CONTRATADA. Horas além das inclusas serão cobradas pelo valor de hora do orçamento aprovado, mediante aprovação prévia."),
        ...commonClauses(context),
      ),
    }),
  },
  {
    id: "content",
    kind: "content",
    name: "Conteúdo e campanha",
    summary: "Calendário de peças, aprovação por peça e publicação.",
    highlights: ["Calendário mensal", "Aprovação por peça", "Relatório de resultados"],
    build: (context) => ({
      title: context.client?.company ? `Conteúdo ${context.client.company}` : "Produção de conteúdo",
      description: "Produção de conteúdo e campanha, com calendário de entregas, aprovação por peça e publicação.",
      body: doc(
        ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PRODUÇÃO DE CONTEÚDO"),
        ...objectClause(`O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços de produção de conteúdo para ${forProject(context, "os canais da CONTRATANTE")}, compreendendo planejamento, criação, aprovação e publicação das peças.`),
        ...deliverablesClause(["Calendário mensal de peças, aprovado com a CONTRATANTE até o dia 25 (vinte e cinco) do mês anterior;", "Criação de até 12 (doze) peças mensais, entre textos, imagens e vídeos curtos, conforme o calendário;", "Publicação nos canais indicados e resposta a comentários em dias úteis;", "Relatório mensal de alcance e resultados."]),
        ...scheduleClause("Este contrato vigora por 6 (seis) meses, contados da assinatura, com renovação automática por períodos iguais, salvo manifestação em contrário de qualquer das partes com 30 (trinta) dias de antecedência."),
        ...paymentClause(context, "O pagamento é mensal, até o dia 10 (dez) de cada mês, mediante cobrança enviada pela CONTRATADA."),
        ...commonClauses(context),
      ),
    }),
  },
];

/**
 * O esqueleto de quem começa do zero, já na forma do contrato: o título, o preâmbulo com as partes a
 * qualificar, a primeira cláusula aberta e o fecho, para a pessoa escrever as cláusulas e não a estrutura.
 */
export function blankDocument(context: TemplateContext): DocNode {
  const forum = context.issuer.city ? context.issuer.city.split(",")[0]?.trim() ?? "[cidade]" : "[cidade]";
  return doc(
    ...preamble(context, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS"),
    clause(1, "do objeto"),
    item("1.1", "[Descreva aqui o objeto do contrato: o serviço prestado, para quem e com que alcance.]"),
    clause(2, "do prazo"),
    item("2.1", "[Prazo de execução ou de vigência, e as etapas.]"),
    clause(3, "do valor e da forma de pagamento"),
    item("3.1", `Pela prestação dos serviços, a CONTRATANTE pagará à CONTRATADA ${amountText(context)}.`),
    paragraph("E, por estarem assim justas e contratadas, as partes assinam eletronicamente o presente instrumento, que passa a produzir efeitos a partir da última assinatura registrada."),
    dated(`${forum}, ${longDate(context.date)}.`),
  );
}

export const findTemplate = (id: string) => contractTemplates.find((template) => template.id === id) ?? null;

const blocks = new Set(["doc", "bulletList", "orderedList", "listItem", "blockquote"]);

/** Todo o texto do documento, sem marcas, um bloco por linha: para a busca e para o PDF de exemplo. */
export function plainText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return node.content?.map(plainText).join(blocks.has(node.type) ? "\n" : "") ?? "";
}
