import type { QuoteStatus } from "@/features/quotes/summary";
import type { TaskStage } from "@/features/tasks/stages";
import type { TaskPriority } from "@/features/tasks/summary";

/** Um mês do resumo, com a chave no formato `yyyy-MM`: quem mostra decide como escrever o nome. */
export type ProjectsMonth = {
  month: string;
  /** Projetos que começaram no mês. */
  started: number;
  /** Projetos entregues no mês. */
  completed: number;
};

export type ProjectsClient = { name: string; avatarUrl: string | null };

/** O que o bloco de projetos do painel mostra: total, clientes atendidos e os últimos meses, do mais antigo ao atual. */
export type ProjectsSummary = {
  total: number;
  clientCount: number;
  /** Os primeiros clientes, para as bolinhas; o total vai em `clientCount`. */
  clients: ProjectsClient[];
  months: ProjectsMonth[];
};

/** Em andamento, pausado, concluído ou cancelado: é o que decide a etiqueta do topo do cartão. */
export type ProjectStatus = "active" | "paused" | "done" | "cancelled";

export type ProjectPerson = { name: string; avatarUrl: string | null };

/** Quem da equipe pode responder por um projeto, como o seletor do formulário lista: o nome, a função e o rosto. */
export type ProjectOwnerOption = ProjectPerson & { id: string; role: string };

/** Para quem é o trabalho: o rosto e o nome de quem contratou, com a empresa quando há. */
/** Uma pasta como um seletor a mostra: o nome curto, o caminho inteiro e a profundidade, para o recuo. */
export type ProjectFolderOption = { id: string; name: string; path: string; depth: number };

export type ProjectClient = {
  id: string;
  name: string;
  company?: string;
  avatarUrl: string | null;
  /** A logo da empresa do cliente: é ela que o projeto sem logo própria veste. */
  logoUrl?: string | null;
};

/**
 * As ferramentas do trabalho, pelo nome do arquivo em `public/brands`: são as marcas que o cartão mostra em
 * cores, na fila agrupada da casa. Lista fechada, porque marca sem arquivo não desenha nada; marca nova é um
 * arquivo na pasta, o nome aqui e o rótulo em `labels.ts`.
 */
export type ProjectTool =
  | "figma"
  | "adobexd"
  | "adobeillustrator"
  | "adobephotoshop"
  | "adobepremierepro"
  | "after-effects"
  | "canva"
  | "webflow"
  | "wordpress"
  | "woocommerce"
  | "nextjs"
  | "react"
  | "vuejs"
  | "nuxtjs"
  | "angular"
  | "typescript"
  | "javascript"
  | "nodejs"
  | "python"
  | "php"
  | "flutter"
  | "dart"
  | "kotlin"
  | "swift"
  | "tailwindcss"
  | "sass"
  | "html5"
  | "css"
  | "firebase"
  | "vercel"
  | "cloudflare"
  | "aws"
  | "googlecloud"
  | "docker"
  | "github"
  | "gitlab"
  | "postgresSQL"
  | "mySQL"
  | "mongodb"
  | "redis"
  | "threejs"
  | "jest"
  | "vitejs";

/** A faixa de valor combinada, em centavos: mínimo e máximo, iguais quando o valor é fechado. */
export type ProjectBudget = { min: number; max: number };

/** Os doze matizes da paleta do sistema, os mesmos da arte do catálogo: é o que tinge a capa sem imagem. */
export type ProjectHue = "red" | "orange" | "yellow" | "green" | "mint" | "teal" | "cyan" | "blue" | "indigo" | "purple" | "pink" | "brown";

/**
 * Um projeto como a listagem o mostra (2026-09-13, sobre uma referência de cartão de projeto do usuário):
 * quem contratou e quando começou, a situação, a capa, o nome, o endereço, as etiquetas, as ferramentas e a
 * entrega. O `slug` é o mesmo do quadro de tarefas dele em `/tarefas/<slug>`, que é como as duas telas se
 * encontram.
 */
export type Project = {
  id: string;
  slug: string;
  /** Identificador curto que a pessoa vê, no padrão de `lib/utils/reference.ts`: "PRJ-2026-0011". */
  reference: string;
  /**
   * O nome do projeto, que é o nome do site ou de para quem o trabalho foi feito ("SpaceX", "Fast Sistemas"),
   * e não a descrição do serviço: o que foi feito fica nas etiquetas (decisão de 2026-09-13).
   */
  name: string;
  /** O endereço do que foi entregue, com protocolo; sem site é nulo. */
  url: string | null;
  /** O que o projeto é, em até cem caracteres: é a linha que o cartão mostra sob o nome (a pedido, 2026-09-13). */
  description: string;
  /** Aparece no portfólio público da equipe. */
  isPublic: boolean;
  /** A marca quadrada do projeto. Nula cai na do cliente, e sem cliente na arte gerada (`ProjectMark`). */
  logoUrl: string | null;
  /** De quem é o projeto. **Nulo é projeto independente** (2026-09-16, a pedido): estudo, projeto próprio,
   *  protótipo. Ele continua contando para o portfólio e para o currículo, que é o que a página serve. */
  client: ProjectClient | null;
  /** Quem da equipe responde pelo projeto: o id é o que o formulário guarda, e o resto é o que o cartão desenha. */
  ownerId: string | null;
  owner: ProjectPerson;
  status: ProjectStatus;
  tags: string[];
  /** As ferramentas usadas, na ordem de mostrar; podem passar de vinte, e o cartão resume o resto. */
  tools: ProjectTool[];
  budget: ProjectBudget | null;
  /** Quando começou, no formato `yyyy-MM-dd`. */
  startedAt: string;
  /** A entrega combinada, no formato `yyyy-MM-dd`; sem prazo é nulo. */
  dueAt: string | null;
  /** De 0 a 100. */
  progress: number;
  /** A imagem da capa, anexada pela pessoa; sem ela entra a arte gerada no matiz do projeto. */
  coverUrl: string | null;
  hue: ProjectHue;
};

/** Uma tarefa do projeto, como a ficha a lista: o que o quadro de tarefas guarda dela e cabe numa linha. */
export type ProjectTask = {
  id: string;
  reference: string;
  title: string;
  stage: TaskStage;
  priority: TaskPriority;
  /** Prazo, no formato `yyyy-MM-dd`. */
  dueDate: string;
  owner: ProjectPerson;
};

/** Um orçamento ligado ao projeto, como aparece na ficha dele, no mesmo desenho da ficha do cliente. */
export type ProjectQuote = {
  id: string;
  number: string;
  title: string;
  /** Em centavos. */
  amount: number;
  status: QuoteStatus;
  /** Quando foi emitido, no formato `yyyy-MM-dd`. */
  date: string;
};

/** Quem da equipe está no projeto, com a função que exerce nele. */
export type ProjectMember = ProjectPerson & { id: string; role: string };

/** Um registro da atividade do projeto: quem fez o quê, em qual tarefa, e quando (ISO com hora). */
export type ProjectEvent = {
  id: string;
  person: ProjectPerson;
  /** O que a pessoa fez, sem o nome: "comentou", "concluiu a subtarefa". */
  action: string;
  /** A tarefa em que aconteceu, quando aconteceu numa. */
  task?: string;
  at: string;
};

/**
 * A ficha completa, buscada quando a janela do projeto abre (2026-09-13): o que o cartão já sabia mais a
 * descrição, a equipe, as tarefas do quadro dele, os orçamentos do cliente e a atividade recente. É buscada,
 * e não mandada junto da listagem, porque doze fichas por página encheriam a carga com o que a grade nem
 * desenha; e é onde o projeto se liga ao resto da casa.
 */
export type ProjectDetails = Project & {
  people: ProjectMember[];
  tasks: ProjectTask[];
  openTasks: number;
  totalTasks: number;
  quotes: ProjectQuote[];
  /** Da mais recente para a mais antiga. */
  activity: ProjectEvent[];
};
