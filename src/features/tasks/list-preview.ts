import { addDays, format } from "date-fns";
import { catalogArtworkUrl, catalogHueFor } from "@/features/catalog/list-options";
import { previewClients } from "@/features/clients/list-preview";
import { previewQuotes } from "@/features/quotes/list-preview";
import type { QuoteLine } from "@/features/quotes/summary";
import { quoteTotals } from "@/features/quotes/totals";
import { formatMoney } from "@/lib/utils/format";
import { formatReference } from "@/lib/utils/reference";
import type { Task, TaskLink, TaskPerson } from "./summary";

/**
 * As tarefas de exemplo do quadro, enquanto o domínio não existe no banco. Quem montar a tabela troca só a
 * origem: a página recebe o quadro pronto e não sabe de onde ele veio.
 *
 * Vinte e quatro tarefas espalhadas pelas cinco etapas, para toda coluna do kanban nascer com conteúdo e a
 * contagem do cabeçalho dizer algo de verdade, e datas relativas a hoje, para a prévia não envelhecer. As
 * cinco primeiras são as que já existiam para o bloco do painel (2026-09-07), com a situação que elas
 * guardavam virando etapa: é o mesmo conteúdo, agora num lugar só, porque o painel passou a ler daqui.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const at = (offset: number, time: string) => `${day(offset)}T${time}`;

const person = (name: string): TaskPerson => ({ name, avatarUrl: null });

const miguel = person("Miguel Santos");
const angel = person("Angel Costa");
const hane = person("Hane Lima");
const jhon = person("Jhon Pereira");
const marina = person("Marina Duarte");
const rafael = person("Rafael Nunes");
const camila = person("Camila Ferreira");
const linda = person("Linda Dong");
const tiago = person("Tiago Almeida");

/**
 * Quem pode assumir uma tarefa ou uma subtarefa: as pessoas que aparecem nas tarefas de exemplo. Enquanto a
 * equipe não vem do banco, é esta lista que a janela da tarefa oferece nos seletores de responsável e de
 * envolvidos; ela chega por prop, então trocar a origem não mexe na janela.
 */
export const previewTaskPeople: TaskPerson[] = [miguel, angel, hane, jhon, marina, rafael, camila, linda, tiago];

/* O `slug` é o endereço do quadro do projeto, o mesmo de `tree-preview.ts`: é por ele que a ficha volta
   para a coluna de onde a tarefa saiu. */
const designSystem = { name: "Design system", reference: formatReference("project", 2026, 7), slug: "design-system" };
const institutional = { name: "Site institucional", reference: formatReference("project", 2026, 11), slug: "site-institucional" };
const aurora = { name: "Padaria Aurora", reference: formatReference("project", 2026, 14), slug: "padaria-aurora" };
const bravo = { name: "Estúdio Bravo", reference: formatReference("project", 2026, 16), slug: "estudio-bravo" };

/**
 * Os vínculos saem das prévias de verdade dos outros domínios, e não de um id escrito à mão: o endereço do
 * cliente e do orçamento precisa existir, senão o vínculo seria um link quebrado. É a mesma coisa que a
 * prévia de orçamentos já faz com os clientes e os itens do catálogo.
 */
const clientLink = (index: number): TaskLink => {
  const client = previewClients[index];
  return {
    id: client.id,
    kind: "client",
    reference: client.reference,
    name: client.name,
    caption: client.company,
    media: { kind: "face", name: client.name },
  };
};

/* A arte de um item do orçamento e o matiz dele: o mesmo endereço e a mesma cor que o documento e a tabela
   de orçamentos usam, montados aqui porque o dado do item mora deste lado. */
const lineArt = (line: QuoteLine) => {
  const hue = catalogHueFor(line.name);
  return { url: catalogArtworkUrl({ id: line.catalogItemId ?? line.id, hue }), hue: `var(--sys-${hue})` };
};

const quoteLink = (index: number): TaskLink => {
  const quote = previewQuotes[index];
  return {
    id: quote.id,
    kind: "quote",
    reference: quote.number,
    name: quote.title,
    caption: formatMoney(quoteTotals(quote).total),
    media: { kind: "art", items: quote.lines.slice(0, 3).map(lineArt), total: quote.lines.length },
  };
};

const projectLink = (project: { name: string; reference: string }, id: string): TaskLink => ({
  id,
  kind: "project",
  reference: project.reference,
  name: project.name,
});

/**
 * O que cada tarefa da prévia diz de si. O id e o identificador saem da posição na lista, e as três listas
 * que toda tarefa tem (subtarefas, anexos e atividade) chegam vazias quando a tarefa não traz nenhuma, para
 * a prévia não repetir `[]` vinte e quatro vezes.
 */
type TaskSpec = Omit<Task, "id" | "reference" | "subtasks" | "attachments" | "activity" | "links"> &
  Partial<Pick<Task, "subtasks" | "attachments" | "activity" | "links">>;

const specs: TaskSpec[] = [
  {
    title: "Estilos de tipografia",
    description:
      "Fechar as escolhas de fonte e a hierarquia dos títulos. A família fica em Inter em tudo, e a escala segue a da Apple, do título grande à legenda, com o mesmo espaçamento entre letras que já usamos nos botões.",
    dueDate: day(-1),
    startDate: day(-6),
    estimate: 240,
    stage: "done",
    priority: "normal",
    owner: miguel,
    people: [miguel, angel, hane],
    project: designSystem,
    tags: ["Design", "Tokens"],
    subtasks: [
      { id: "s1", title: "Escolher a família e os pesos", done: true, person: miguel },
      { id: "s2", title: "Definir a escala de tamanhos", done: true, person: angel },
      { id: "s3", title: "Publicar os tokens de texto", done: true, person: hane },
    ],
    attachments: [{ id: "a1", name: "Escala tipográfica", type: "image", url: "/banners/login-1-desktop.png", size: "72 KB", label: "Aprovado" }],
    activity: [
      { id: "e1", person: hane, action: "concluiu a tarefa", at: at(-1, "17:40") },
      { id: "e2", person: angel, action: "marcou a escala como pronta", at: at(-2, "11:15") },
      { id: "e3", person: miguel, action: "anexou a escala tipográfica", at: at(-4, "09:30") },
    ],
  },
  {
    title: "Design system v2",
    description:
      "Componentes, diretrizes e tokens que formam a base do sistema. A segunda versão troca os cantos arredondados pela superelipse, revê as cores de preenchimento no tema escuro e documenta cada componente com os estados de foco e de erro.",
    dueDate: day(0),
    startDate: day(-4),
    estimate: 960,
    stage: "doing",
    priority: "high",
    owner: miguel,
    people: [miguel, jhon, hane],
    project: designSystem,
    links: [projectLink(designSystem, "p7")],
    tags: ["Design", "Componentes", "Tokens"],
    subtasks: [
      { id: "s1", title: "Revisar os tokens de cor no tema escuro", done: true, person: hane },
      { id: "s2", title: "Levar os cantos para a superelipse", done: true, person: miguel },
      { id: "s3", title: "Documentar foco e erro em cada componente", done: false, person: jhon },
      { id: "s4", title: "Revisar com a equipe de produto", done: false },
    ],
    attachments: [
      { id: "a1", name: "Diretrizes do sistema", type: "image", url: "/banners/login-2-desktop.png", size: "78 KB" },
      { id: "a2", name: "Design system v2", type: "figma", url: "https://www.figma.com/file/design-system-v2" },
      { id: "a3", name: "Referências no Behance", type: "link", url: "https://www.behance.net/search/projects/design%20system" },
    ],
    activity: [
      { id: "e1", person: jhon, action: 'comentou: "Falta o estado de erro no seletor."', kind: "comment", at: at(0, "09:12") },
      { id: "e2", person: miguel, action: 'concluiu "Levar os cantos para a superelipse"', at: at(-1, "16:05") },
      { id: "e3", person: hane, action: "anexou as diretrizes do sistema", at: at(-2, "14:48") },
    ],
  },
  {
    title: "Interface do usuário",
    description: "Apresentar os novos elementos e estilos de tela para a equipe, com os fluxos principais montados no protótipo.",
    dueDate: day(1),
    startDate: day(1),
    estimate: 90,
    stage: "todo",
    priority: "normal",
    owner: jhon,
    people: [miguel, jhon, hane],
    project: designSystem,
    tags: ["Apresentação"],
    subtasks: [
      { id: "s1", title: "Montar o protótipo dos fluxos principais", done: false, person: jhon },
      { id: "s2", title: "Reservar a sala e convidar a equipe", done: false, person: hane },
    ],
    activity: [
      { id: "e1", person: miguel, action: "criou a tarefa", at: at(-1, "10:20") },
      { id: "e2", person: miguel, action: "atribuiu a tarefa para Jhon", at: at(-1, "10:21") },
    ],
  },
  {
    title: "Proposta da Padaria Aurora",
    description:
      "Revisar o escopo e enviar a proposta para aprovação. A Marina pediu que o site tenha cardápio com fotos e pedidos pelo WhatsApp, e quer ver duas opções de preço: uma só com o site e outra com a identidade visual junto.",
    dueDate: day(3),
    startDate: day(0),
    estimate: 180,
    stage: "todo",
    priority: "urgent",
    owner: rafael,
    people: [marina, rafael],
    project: aurora,
    links: [clientLink(2), quoteLink(0), projectLink(aurora, "p14")],
    tags: ["Comercial", "Orçamento"],
    alert: "A cliente pediu a proposta antes da reunião de sexta. Confirme o horário com ela antes de enviar.",
    subtasks: [
      { id: "s1", title: "Revisar o escopo com a Marina", done: false, person: rafael },
      { id: "s2", title: "Montar as duas opções de preço", done: false, person: rafael },
      { id: "s3", title: "Enviar a proposta para aprovação", done: false },
    ],
    attachments: [{ id: "a1", name: "Briefing da reunião", type: "image", url: "/banners/login-3-desktop.png", size: "69 KB" }],
    activity: [
      { id: "e1", person: rafael, action: "anexou o briefing da reunião", at: at(0, "08:45") },
      { id: "e2", person: marina, action: "pediu duas opções de preço", kind: "comment", at: at(-1, "18:30") },
      { id: "e3", person: rafael, action: "criou a tarefa", at: at(-2, "15:00") },
    ],
  },
  {
    title: "Entrega do site institucional",
    description:
      "Publicar e passar os acessos para o cliente. Antes de publicar, conferir o domínio, o certificado e o formulário de contato, e deixar o painel do site com o e-mail da Camila como dona.",
    dueDate: day(6),
    startDate: day(-2),
    estimate: 300,
    stage: "publishing",
    priority: "high",
    owner: tiago,
    people: [camila, linda, tiago],
    project: institutional,
    links: [clientLink(0), quoteLink(3), projectLink(institutional, "p11")],
    tags: ["Entrega", "Publicação"],
    subtasks: [
      { id: "s1", title: "Apontar o domínio para a hospedagem", done: true, person: tiago },
      { id: "s2", title: "Testar o formulário de contato", done: true, person: linda },
      { id: "s3", title: "Publicar a versão final", done: false, person: tiago },
      { id: "s4", title: "Enviar os acessos para a Camila", done: false, person: linda },
    ],
    attachments: [
      { id: "a1", name: "Prévia aprovada", type: "image", url: "/bg/bg-model.jpeg", size: "50 KB", label: "Aprovado" },
      { id: "a2", name: "Site em homologação", type: "link", url: "https://homolog.specular.app" },
    ],
    activity: [
      { id: "e1", person: linda, action: 'concluiu "Testar o formulário de contato"', at: at(0, "11:02") },
      { id: "e2", person: camila, action: "aprovou a prévia", at: at(-1, "19:10") },
      { id: "e3", person: tiago, action: "anexou a prévia aprovada", at: at(-1, "17:55") },
    ],
  },

  /* Backlog: o que já foi escrito mas ainda não entrou na fila de ninguém, então nada tem início marcado. */
  {
    title: "Migrar o blog para o tema novo",
    description: "Levar os cinquenta e dois textos publicados para o tema novo, mantendo os endereços antigos com redirecionamento.",
    dueDate: day(38),
    stage: "backlog",
    priority: "low",
    owner: linda,
    people: [linda, tiago],
    tags: ["Conteúdo", "Migração"],
  },
  {
    title: "Padronizar os contratos de manutenção",
    description: "Escrever um modelo único de contrato de manutenção mensal, com escopo, horas incluídas e o que passa a ser cobrado à parte.",
    dueDate: day(45),
    stage: "backlog",
    priority: "normal",
    owner: rafael,
    people: [rafael, camila],
    tags: ["Contratos", "Comercial"],
  },
  {
    title: "Pesquisa de preço do pacote anual",
    description: "Levantar quanto cobram por hospedagem, domínio e manutenção anual, para o pacote sair com preço de mercado.",
    dueDate: day(30),
    stage: "backlog",
    priority: "low",
    owner: camila,
    people: [camila, rafael],
    tags: ["Pesquisa", "Preço"],
  },
  {
    title: "Refazer a página de portfólio",
    description: "A página de portfólio ainda mostra os projetos numa lista simples. Refazer com capa, resultado e depoimento de cada cliente.",
    dueDate: day(52),
    stage: "backlog",
    priority: "normal",
    owner: angel,
    people: [angel, miguel],
    tags: ["Design", "Portfólio"],
  },
  {
    title: "Automatizar o lembrete de cobrança",
    description: "Mandar o lembrete três dias antes do vencimento e no dia, sem ninguém precisar abrir a lista de cobranças para conferir.",
    dueDate: day(60),
    stage: "backlog",
    priority: "normal",
    owner: tiago,
    people: [tiago, camila],
    tags: ["Automação", "Financeiro"],
  },

  /* A fazer: já tem responsável e data para começar. */
  {
    title: "Levantamento da loja do Estúdio Bravo",
    description: "Listar o que a loja precisa ter: catálogo, carrinho, frete, formas de pagamento e o painel de pedidos.",
    dueDate: day(8),
    startDate: day(2),
    estimate: 420,
    stage: "todo",
    priority: "high",
    owner: tiago,
    people: [tiago, linda],
    project: bravo,
    tags: ["Escopo", "Loja"],
    subtasks: [
      { id: "s1", title: "Listar as formas de pagamento", done: false, person: tiago },
      { id: "s2", title: "Definir as regras de frete", done: false, person: linda },
    ],
    activity: [{ id: "e1", person: tiago, action: "criou a tarefa", at: at(-1, "09:05") }],
  },
  {
    title: "Roteiro do vídeo institucional",
    description: "Escrever o roteiro de um minuto e meio, com a fala, as cenas e o que precisa ser gravado no escritório do cliente.",
    dueDate: day(11),
    startDate: day(4),
    estimate: 240,
    stage: "todo",
    priority: "normal",
    owner: angel,
    people: [angel, camila],
    project: institutional,
    tags: ["Conteúdo", "Vídeo"],
  },
  {
    title: "Reunião de início do app de pedidos",
    description: "Primeira reunião com o cliente para alinhar prazo, entregas e quem responde por cada parte do aplicativo.",
    dueDate: day(5),
    startDate: day(5),
    estimate: 60,
    stage: "todo",
    priority: "high",
    owner: rafael,
    people: [rafael, marina, tiago],
    project: aurora,
    tags: ["Reunião"],
    activity: [{ id: "e1", person: rafael, action: "marcou a reunião com a cliente", at: at(-2, "16:20") }],
  },

  /* Em andamento: começou e não fechou. */
  {
    title: "Identidade visual da Padaria Aurora",
    description: "Marca, paleta e aplicação em embalagem e fachada. A cliente pediu algo que funcione bem no papel pardo do pacote de pão.",
    dueDate: day(9),
    startDate: day(-3),
    estimate: 720,
    stage: "doing",
    priority: "high",
    owner: angel,
    people: [angel, marina, miguel],
    project: aurora,
    tags: ["Design", "Marca"],
    subtasks: [
      { id: "s1", title: "Fechar a paleta com a cliente", done: true, person: angel },
      { id: "s2", title: "Desenhar as três opções de marca", done: true, person: angel },
      { id: "s3", title: "Aplicar na embalagem e na fachada", done: false, person: miguel },
    ],
    attachments: [{ id: "a1", name: "Identidade da Aurora", type: "figma", url: "https://www.figma.com/file/aurora-identidade" }],
    activity: [
      { id: "e1", person: marina, action: "escolheu a segunda opção de marca", at: at(0, "10:40") },
      { id: "e2", person: angel, action: "anexou as três opções", at: at(-1, "15:12") },
    ],
  },
  {
    title: "Integração do checkout com o Pix",
    description: "Ligar o checkout ao Pix e devolver o comprovante para o painel de pedidos assim que o pagamento cair.",
    dueDate: day(13),
    startDate: day(-1),
    estimate: 480,
    stage: "blocked",
    priority: "urgent",
    owner: tiago,
    people: [tiago, linda],
    project: bravo,
    links: [clientLink(1), quoteLink(1)],
    tags: ["Pagamento", "Integração"],
    alert: "A chave de produção só é liberada pelo banco depois da aprovação do cadastro. Peça com antecedência.",
    subtasks: [
      { id: "s1", title: "Gerar a cobrança no ambiente de teste", done: true, person: tiago },
      { id: "s2", title: "Tratar o retorno do pagamento", done: false, person: tiago },
      { id: "s3", title: "Pedir a chave de produção", done: false, person: linda },
    ],
    activity: [{ id: "e1", person: tiago, action: 'concluiu "Gerar a cobrança no ambiente de teste"', at: at(0, "14:25") }],
  },
  {
    title: "Textos da página de planos",
    description: "Escrever o nome de cada plano, o que entra em cada um e as perguntas frequentes, sem promessa que a gente não cumpre.",
    dueDate: day(4),
    startDate: day(-2),
    estimate: 180,
    stage: "doing",
    priority: "normal",
    owner: hane,
    people: [hane, camila],
    tags: ["Conteúdo"],
    subtasks: [
      { id: "s1", title: "Nomear os três planos", done: true, person: hane },
      { id: "s2", title: "Escrever as perguntas frequentes", done: false, person: hane },
    ],
  },

  /* Em revisão: pronto, esperando alguém conferir. */
  {
    title: "Revisão do contrato do Estúdio Bravo",
    description: "Conferir prazo, escopo e multa antes de mandar para assinatura. O cliente pediu para incluir a manutenção do primeiro mês.",
    dueDate: day(2),
    startDate: day(-5),
    estimate: 120,
    stage: "review",
    priority: "urgent",
    owner: rafael,
    people: [rafael, camila],
    project: bravo,
    links: [clientLink(1), quoteLink(1)],
    tags: ["Contratos"],
    attachments: [{ id: "a1", name: "Contrato do Estúdio Bravo", type: "link", url: "https://specular.app/contratos" }],
    activity: [{ id: "e1", person: camila, action: "pediu a inclusão da manutenção do primeiro mês", at: at(-1, "11:30") }],
  },
  {
    title: "Acessibilidade do formulário de contato",
    description: "Conferir rótulo, ordem de foco, mensagem de erro e leitura por voz em cada campo do formulário.",
    dueDate: day(7),
    startDate: day(-1),
    estimate: 150,
    stage: "review",
    priority: "normal",
    owner: linda,
    people: [linda, hane],
    project: institutional,
    tags: ["Acessibilidade", "Revisão"],
    subtasks: [
      { id: "s1", title: "Conferir a ordem de foco", done: true, person: linda },
      { id: "s2", title: "Testar com leitor de tela", done: false, person: hane },
    ],
  },
  {
    title: "Aprovação do layout do cardápio",
    description: "Mandar as duas páginas do cardápio para a cliente e esperar o aval antes de fechar as fotos dos produtos.",
    dueDate: day(1),
    startDate: day(-2),
    estimate: 60,
    stage: "approval",
    priority: "high",
    owner: marina,
    people: [marina, angel],
    project: aurora,
    links: [clientLink(2), quoteLink(0)],
    tags: ["Design", "Aprovação"],
    attachments: [{ id: "a1", name: "Cardápio, páginas 1 e 2", type: "image", url: "/banners/login-2-desktop.png", size: "81 KB" }],
    activity: [{ id: "e1", person: angel, action: "mandou o cardápio para aprovação", at: at(-1, "17:05") }],
  },
  {
    title: "Auditoria de desempenho do site",
    description: "Medir o tempo de carga em rede lenta e listar o que dá para cortar sem mexer no desenho da página.",
    dueDate: day(10),
    startDate: day(-1),
    estimate: 210,
    stage: "review",
    priority: "normal",
    owner: jhon,
    people: [jhon, tiago],
    project: institutional,
    tags: ["Performance", "Revisão"],
  },

  /* Concluída: prazo no passado e tudo marcado. */
  {
    title: "Domínio e e-mail da Aurora",
    description: "Registrar o domínio, apontar para a hospedagem e criar as três caixas de e-mail que a cliente pediu.",
    dueDate: day(-3),
    startDate: day(-6),
    estimate: 120,
    stage: "done",
    priority: "normal",
    owner: tiago,
    people: [tiago, marina],
    project: aurora,
    tags: ["Infraestrutura"],
    subtasks: [
      { id: "s1", title: "Registrar o domínio", done: true, person: tiago },
      { id: "s2", title: "Criar as caixas de e-mail", done: true, person: tiago },
    ],
    activity: [{ id: "e1", person: tiago, action: "concluiu a tarefa", at: at(-3, "18:20") }],
  },
  {
    title: "Artes das redes sociais de setembro",
    description: "Doze artes no formato do feed e seis para o story, na linha visual que a cliente aprovou no mês passado.",
    dueDate: day(-5),
    startDate: day(-12),
    estimate: 480,
    stage: "done",
    priority: "normal",
    owner: angel,
    people: [angel, marina],
    project: aurora,
    tags: ["Design", "Redes"],
    attachments: [{ id: "a1", name: "Artes de setembro", type: "figma", url: "https://www.figma.com/file/aurora-redes", label: "Aprovado" }],
  },
  {
    title: "Fechar o orçamento da consultoria",
    description: "Ajustar as horas e mandar o orçamento revisado, com a segunda opção de pagamento que o cliente pediu.",
    dueDate: day(-2),
    startDate: day(-4),
    estimate: 90,
    stage: "done",
    priority: "high",
    owner: rafael,
    people: [rafael, camila],
    links: [clientLink(0), quoteLink(5)],
    tags: ["Comercial", "Orçamento"],
    activity: [{ id: "e1", person: camila, action: "aprovou o orçamento revisado", at: at(-2, "16:45") }],
  },
  {
    title: "Certificado do site em produção",
    description: "Emitir o certificado, ligar a renovação automática e conferir se o endereço sem HTTPS redireciona.",
    dueDate: day(-7),
    startDate: day(-8),
    estimate: 45,
    stage: "done",
    priority: "low",
    owner: linda,
    people: [linda, tiago],
    project: institutional,
    tags: ["Infraestrutura", "Segurança"],
    subtasks: [{ id: "s1", title: "Ligar a renovação automática", done: true, person: linda }],
  },
];

/* O identificador começa em 28 porque é onde as cinco primeiras nasceram, em 2026-09-07, e o número que a
   pessoa lê num documento não muda de dono depois de existir. */
const FIRST_SEQUENCE = 28;

export const previewTasks: Task[] = specs.map((spec, index) => ({
  id: `t${index + 1}`,
  reference: formatReference("task", 2026, FIRST_SEQUENCE + index),
  subtasks: [],
  attachments: [],
  activity: [],
  links: [],
  ...spec,
}));
