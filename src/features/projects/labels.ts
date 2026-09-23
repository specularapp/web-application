import type { Icon } from "@phosphor-icons/react";
import { CheckCircleIcon, PauseCircleIcon, PlayCircleIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import type { Project, ProjectBudget, ProjectStatus, ProjectTool } from "./summary";

/* A situação do projeto em etiqueta: rótulo, tom e ícone, os mesmos no cartão, no menu de filtros e na etiqueta
   do filtro em vigor. "Ativo" em verde, como o "Active" da referência: "Em andamento" durou uma rodada e
   saiu porque, medido no navegador, roubava a largura do nome do cliente na cabeça do cartão. */
export const projectStatuses: Record<ProjectStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  active: { label: "Ativo", tone: "success", icon: PlayCircleIcon },
  paused: { label: "Pausado", tone: "warning", icon: PauseCircleIcon },
  done: { label: "Concluído", tone: "neutral", icon: CheckCircleIcon },
  cancelled: { label: "Cancelado", tone: "danger", icon: XCircleIcon },
};

/** O nome de cada ferramenta como ela se escreve; a marca em si é o arquivo de mesmo nome em `public/brands`. */
export const projectTools: Record<ProjectTool, string> = {
  figma: "Figma",
  adobexd: "Adobe XD",
  adobeillustrator: "Illustrator",
  adobephotoshop: "Photoshop",
  adobepremierepro: "Premiere Pro",
  "after-effects": "After Effects",
  canva: "Canva",
  webflow: "Webflow",
  wordpress: "WordPress",
  woocommerce: "WooCommerce",
  nextjs: "Next.js",
  react: "React",
  vuejs: "Vue",
  nuxtjs: "Nuxt",
  angular: "Angular",
  typescript: "TypeScript",
  javascript: "JavaScript",
  nodejs: "Node.js",
  python: "Python",
  php: "PHP",
  flutter: "Flutter",
  dart: "Dart",
  kotlin: "Kotlin",
  swift: "Swift",
  tailwindcss: "Tailwind CSS",
  sass: "Sass",
  html5: "HTML",
  css: "CSS",
  firebase: "Firebase",
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  aws: "AWS",
  googlecloud: "Google Cloud",
  docker: "Docker",
  github: "GitHub",
  gitlab: "GitLab",
  postgresSQL: "PostgreSQL",
  mySQL: "MySQL",
  mongodb: "MongoDB",
  redis: "Redis",
  threejs: "Three.js",
  jest: "Jest",
  vitejs: "Vite",
};

/* Sem centavo: a faixa é combinada em valores fechados, e "R$ 7.950 a R$ 10.000" lê melhor que a versão com
   ",00" duas vezes, pela mesma decisão da tabela de planos. */
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** A faixa de valor por extenso a partir de centavos; fechada, é um valor só. */
export function budgetLabel({ min, max }: ProjectBudget) {
  const low = money.format(min / 100);
  return min === max ? low : `${low} a ${money.format(max / 100)}`;
}

/** A data curta da casa, com o ano sempre à vista: "8 mar. 2026". */
export const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });

/* O domínio de um endereço mora em `lib/utils/site.ts`, com os outros dois sentidos do mesmo campo.
   Segue exportado aqui para quem já o importava desta feature. */
export { siteLabel } from "@/lib/utils/site";

export type DueReading = { label: string; tone: BadgeTone };

/**
 * A entrega na etiqueta do prazo das tarefas (a pedido, 2026-09-13): "Hoje" em vermelho, "Amanhã" em laranja, e
 * o resto pela data curta. Projeto aberto com a entrega vencida também fica em vermelho, porque é o mais
 * urgente da lista; concluído e cancelado leem a data neutra, porque o prazo já não corre.
 */
export function dueOf(project: Pick<Project, "dueAt" | "status">): DueReading {
  if (!project.dueAt) return { label: "Sem prazo", tone: "neutral" };
  const date = parseISO(project.dueAt);
  const days = differenceInCalendarDays(date, new Date());
  const open = project.status === "active" || project.status === "paused";
  const overdue = days < 0 && open;

  if (days === 0) return { label: "Hoje", tone: open ? "danger" : "neutral" };
  if (days === 1) return { label: "Amanhã", tone: open ? "warning" : "neutral" };
  if (days === -1) return { label: "Ontem", tone: overdue ? "danger" : "neutral" };
  return { label: format(date, "d MMM.", { locale: ptBR }), tone: overdue ? "danger" : "neutral" };
}

/**
 * Como a bolinha de cada ferramenta é montada (a pedido, 2026-09-13, sobre uma referência de fila de
 * aplicativos, e refeita no mesmo dia depois de medir arquivo por arquivo no navegador): a cor do fundo e o
 * jeito de a marca entrar. Cor literal de marca é exceção consciente da regra de tokens, como o WhatsApp e o
 * Microsoft Authenticator: marca não segue o tema.
 *
 * Os três jeitos existem porque os arquivos de `public/brands` não são todos da mesma natureza, e tratar
 * todos igual foi o que quebrou a primeira versão (o TypeScript e o Webflow viravam um quadrado chapado, o
 * Next.js um círculo cheio, o Adobe ficava preto):
 *
 * - `tile`: o SVG **é** o azulejo, com o fundo dele dentro (Adobe, TypeScript, Webflow, JavaScript, Swift).
 *   Ele cobre a bolinha inteira e as quinas somem no círculo, que é o desenho da referência. O fundo aqui é
 *   só o que aparece atrás de recorte: no Next.js, no Canva e no Webflow a marca é uma forma cheia com o
 *   desenho vazado, e é o fundo que vira o desenho (o Webflow com o próprio azul por trás sumia, medido na
 *   folha de contato).
 * - `mask`: o SVG é de uma cor só (Vercel, GitHub, Three.js, Node, Tailwind, Sass, MySQL, Jest). Vai em
 *   máscara na tinta de `ink` sobre o fundo da marca, que é o único jeito de uma marca preta aparecer em
 *   cima de um fundo escuro.
 * - `glyph`: o SVG já traz as cores dele e nasce sem fundo (Figma, React, Docker, Google Cloud). Fica
 *   centrado, com folga, sobre um fundo escolhido para a marca contrastar: escuro quando ela é clara,
 *   branco quando ela é escura ou de muitas cores.
 */
export type ProjectToolFit = "tile" | "mask" | "glyph";

export type ProjectToolBrand = {
  /** A cor do fundo da bolinha. */
  background: string;
  fit: ProjectToolFit;
  /** A tinta da marca em `mask`. */
  ink?: string;
};

export const projectToolBrands: Record<ProjectTool, ProjectToolBrand> = {
  figma: { background: "#1e1e1e", fit: "glyph" },
  adobexd: { background: "#470137", fit: "tile" },
  adobeillustrator: { background: "#330000", fit: "tile" },
  adobephotoshop: { background: "#001e36", fit: "tile" },
  adobepremierepro: { background: "#2a0634", fit: "tile" },
  "after-effects": { background: "#1f0740", fit: "tile" },
  canva: { background: "#ffffff", fit: "tile" },
  webflow: { background: "#ffffff", fit: "tile" },
  wordpress: { background: "#ffffff", fit: "glyph" },
  woocommerce: { background: "#ffffff", fit: "glyph" },
  nextjs: { background: "#ffffff", fit: "tile" },
  react: { background: "#20232a", fit: "glyph" },
  vuejs: { background: "#ffffff", fit: "glyph" },
  nuxtjs: { background: "#ffffff", fit: "glyph" },
  angular: { background: "#ffffff", fit: "glyph" },
  typescript: { background: "#007acc", fit: "tile" },
  javascript: { background: "#f0db4f", fit: "tile" },
  nodejs: { background: "#339933", fit: "mask", ink: "#ffffff" },
  python: { background: "#ffffff", fit: "glyph" },
  php: { background: "#777bb4", fit: "glyph" },
  flutter: { background: "#ffffff", fit: "glyph" },
  dart: { background: "#ffffff", fit: "glyph" },
  kotlin: { background: "#ffffff", fit: "glyph" },
  swift: { background: "#f05138", fit: "tile" },
  tailwindcss: { background: "#0b1120", fit: "glyph" },
  sass: { background: "#cc6699", fit: "mask", ink: "#ffffff" },
  html5: { background: "#ffffff", fit: "glyph" },
  css: { background: "#ffffff", fit: "glyph" },
  firebase: { background: "#ffffff", fit: "glyph" },
  vercel: { background: "#000000", fit: "mask", ink: "#ffffff" },
  cloudflare: { background: "#1d1f21", fit: "glyph" },
  aws: { background: "#ffffff", fit: "glyph" },
  googlecloud: { background: "#ffffff", fit: "glyph" },
  docker: { background: "#ffffff", fit: "glyph" },
  github: { background: "#181717", fit: "mask", ink: "#ffffff" },
  gitlab: { background: "#ffffff", fit: "glyph" },
  postgresSQL: { background: "#ffffff", fit: "glyph" },
  mySQL: { background: "#00618a", fit: "mask", ink: "#ffffff" },
  mongodb: { background: "#ffffff", fit: "glyph" },
  redis: { background: "#ffffff", fit: "glyph" },
  threejs: { background: "#000000", fit: "mask", ink: "#ffffff" },
  jest: { background: "#99425b", fit: "mask", ink: "#ffffff" },
  vitejs: { background: "#1a1a2e", fit: "glyph" },
};
