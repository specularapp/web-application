import { addDays, format } from "date-fns";
import { previewClients } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import { formatReference } from "@/lib/utils/reference";
import { slugify } from "@/lib/utils/slug";
import { projectHueFor } from "./list-options";
import type { Project, ProjectStatus, ProjectTool } from "./summary";

/**
 * Projetos de exemplo enquanto o domínio não existe no banco: é a semente do store em memória (`store.ts`),
 * de onde a página lê e para onde a action de salvar escreve. Vinte e sete projetos, para a paginação de doze
 * aparecer já na primeira visita, com os clientes da base de exemplo e a equipe da prévia como responsáveis,
 * para as telas falarem das mesmas pessoas. Datas relativas a hoje, para a prévia não envelhecer.
 *
 * Os nove primeiros são os projetos que já existem em outro lugar da casa: os do quadro de tarefas
 * (`tarefas/tree-preview.ts`), com o mesmo `slug` e o mesmo identificador, e os das fichas de cliente e de
 * membro, com o mesmo id (`p11`, `p9`, `p4`, `p6`, `p3`), para o vínculo de uma tela cair no cartão certo da
 * outra. O nome é o do site ou de para quem o trabalho foi feito, o endereço é o do site e a descrição tem até
 * cem caracteres, como manda o modelo; nos gerados os dois primeiros saem da empresa do cliente. Ninguém tem
 * capa: a imagem é anexada pela pessoa no cadastro, e enquanto não há entra a arte gerada no matiz do projeto.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const cents = (reais: number) => reais * 100;

type Seed = {
  sequence: number;
  /** O nome do projeto; sem ele, sai da empresa do cliente. */
  name?: string;
  /** O endereço do site; ausente, sai do site do cliente, e nulo é projeto sem site. */
  url?: string | null;
  description: string;
  isPublic: boolean;
  /** Índice em `previewClients`: os seis do painel primeiro, depois os gerados. */
  client: number;
  /** Índice em `previewTeamSummary.members`. */
  owner: number;
  status: ProjectStatus;
  tags: string[];
  tools: ProjectTool[];
  /** A faixa em reais; nula quando o valor não foi combinado. */
  budget: [number, number] | null;
  /** Dias em relação a hoje. */
  started: number;
  due: number | null;
  progress: number;
  /** O endereço do quadro de tarefas, quando ele já existe em `tree-preview.ts`; sem ele, sai do nome. */
  slug?: string;
};

const known: Seed[] = [
  { sequence: 11, slug: "site-institucional", name: "Estúdio Aurora", url: "https://estudioaurora.com.br", description: "Site institucional com portfólio de projetos e formulário de contato.", isPublic: true, client: 0, owner: 0, status: "active", tags: ["Web design", "Desenvolvimento", "Portfólio"], tools: ["figma", "nextjs", "react", "typescript", "tailwindcss", "vercel", "github"], budget: [7_700, 9_500], started: -34, due: 12, progress: 62 },
  { sequence: 7, slug: "design-system", name: "Dong Design System", url: "https://dong.design/sistema", description: "Biblioteca de componentes e tokens para os produtos digitais da Dong.", isPublic: false, client: 3, owner: 2, status: "active", tags: ["Product design", "Design system"], tools: ["figma", "react", "typescript", "jest"], budget: [12_000, 15_000], started: -58, due: 30, progress: 48 },
  { sequence: 14, slug: "padaria-aurora", name: "Padaria Aurora", url: "https://padariaaurora.com", description: "Cardápio digital com pedidos pelo WhatsApp e retirada na loja.", isPublic: true, client: 2, owner: 1, status: "active", tags: ["Web design", "Loja virtual"], tools: ["webflow", "figma"], budget: [5_400, 5_400], started: -9, due: 26, progress: 15 },
  { sequence: 16, slug: "estudio-bravo", name: "Lançamento Bravo", url: "https://bravo.studio/lancamento", description: "Campanha de lançamento da produtora nas redes, com vídeo e identidade.", isPublic: false, client: 1, owner: 3, status: "active", tags: ["Branding", "Conteúdo", "Redes sociais"], tools: ["canva", "adobepremierepro", "after-effects", "adobephotoshop", "adobeillustrator", "figma"], budget: [3_200, 4_800], started: -16, due: 5, progress: 35 },
  { sequence: 9, slug: "site-da-bravo", name: "Bravo Studio", url: "https://bravo.studio", description: "Site da produtora com os vídeos em destaque e página de contato.", isPublic: true, client: 1, owner: 1, status: "active", tags: ["Web design", "Desenvolvimento"], tools: ["nextjs", "react", "typescript", "vercel"], budget: [9_600, 9_600], started: -41, due: -3, progress: 80 },
  { sequence: 6, slug: "manutencao-do-site", name: "Dong Design", url: "https://dong.design", description: "Manutenção mensal do site, com atualizações e melhorias de SEO.", isPublic: false, client: 3, owner: 3, status: "active", tags: ["Manutenção", "SEO"], tools: ["wordpress", "php", "cloudflare"], budget: [1_800, 1_800], started: -120, due: null, progress: 45 },
  { sequence: 4, slug: "identidade-visual", name: "Marca Dong Design", url: null, description: "Identidade visual completa, com papelaria e manual de marca.", isPublic: true, client: 3, owner: 2, status: "done", tags: ["Branding", "Identidade visual"], tools: ["adobeillustrator", "adobephotoshop", "figma"], budget: [4_500, 4_500], started: -150, due: -95, progress: 100 },
  { sequence: 3, slug: "site-do-escritorio", name: "Rocha Advocacia", url: "https://rochaadvocacia.com", description: "Site do escritório, com áreas de atuação e agendamento de consulta.", isPublic: false, client: 5, owner: 0, status: "paused", tags: ["Web design", "Desenvolvimento"], tools: ["wordpress", "php", "mySQL"], budget: [3_800, 3_800], started: -160, due: -20, progress: 90 },
  { sequence: 19, slug: "novos-contatos", name: "Almeida Engenharia", url: null, description: "Prospecção de novos contatos e conteúdo para a base de leads.", isPublic: false, client: 4, owner: 0, status: "active", tags: ["Comercial", "Conteúdo"], tools: [], budget: null, started: -20, due: 45, progress: 20 },
];

/* Os gerados saem de um padrão determinístico pelo índice, como as outras prévias: dá conteúdo plausível sem
   inventar texto para cada um, e a mesma carga sai sempre igual. Dois conjuntos de ferramentas passam de
   cinco, para a fila do cartão mostrar o resumo do resto; a descrição acompanha as etiquetas do conjunto. */
const tagSets: { tags: string[]; description: string }[] = [
  { tags: ["Web design", "Loja virtual"], description: "Loja virtual com catálogo integrado e pagamento online." },
  { tags: ["Landing page", "SEO"], description: "Landing page de captação com formulário e integração ao CRM." },
  { tags: ["Product design", "Aplicativo"], description: "Aplicativo com agendamentos e lembretes automáticos." },
  { tags: ["Branding", "Identidade visual"], description: "Identidade visual completa, do logotipo à papelaria." },
  { tags: ["Web design", "Desenvolvimento"], description: "Site institucional com blog e página de contato." },
  { tags: ["Product design", "Desenvolvimento"], description: "Portal do cliente com área logada e documentos." },
  { tags: ["Branding", "Papelaria"], description: "Papelaria e material de apresentação com a marca." },
  { tags: ["Web design", "Conteúdo"], description: "Site com conteúdo mensal e páginas de serviço." },
  { tags: ["Desenvolvimento", "Sistema interno"], description: "Sistema interno de pedidos para a equipe de vendas." },
  { tags: ["Conteúdo", "SEO"], description: "Blog e conteúdo mensal para a base de clientes." },
];

const toolSets: ProjectTool[][] = [
  ["figma", "webflow"],
  ["figma", "nextjs", "react", "typescript", "tailwindcss", "vercel", "github"],
  ["flutter", "dart", "firebase"],
  ["adobeillustrator", "adobephotoshop", "figma"],
  ["wordpress", "php", "mySQL"],
  ["react", "nodejs", "postgresSQL", "docker", "aws", "typescript", "jest", "github", "redis"],
  ["canva", "adobepremierepro", "after-effects"],
  ["nextjs", "typescript", "vercel"],
  ["vuejs", "nuxtjs", "sass"],
  ["woocommerce", "wordpress", "php"],
];

const statusCycle: ProjectStatus[] = ["active", "active", "done", "active", "paused", "active", "cancelled", "active", "done"];

/* As sequências que sobram entre os nove conhecidos, de cima para baixo: quem começou por último tem o número
   mais alto, e a lista já vem do mais novo para o mais antigo. */
const sequences = [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 18, 17, 15, 13, 12, 10, 8];

const generated: Seed[] = sequences.map((sequence, index) => {
  const status = statusCycle[index % statusCycle.length] ?? "active";
  const set = tagSets[index % tagSets.length] ?? tagSets[0]!;
  const started = -(index * 6 + 3);
  const span = 35 + (index % 5) * 12;
  const base = 2_400 + (index % 7) * 1_350;

  return {
    sequence,
    description: set.description,
    isPublic: index % 3 === 0,
    client: 6 + (index % (previewClients.length - 6)),
    owner: index % previewTeamSummary.members.length,
    status,
    tags: set.tags,
    tools: toolSets[index % toolSets.length] ?? [],
    budget: index % 4 === 3 ? [base, base] : [base, base + 1_800 + (index % 3) * 900],
    started,
    due: status === "cancelled" ? null : started + span,
    progress: status === "done" ? 100 : status === "cancelled" ? 30 : 10 + ((index * 23) % 80),
  };
});

const build = (seed: Seed): Project => {
  const client = previewClients[seed.client] ?? previewClients[0]!;
  const owner = previewTeamSummary.members[seed.owner % previewTeamSummary.members.length] ?? previewTeamSummary.members[0]!;
  const name = seed.name ?? client.company ?? client.name;

  return {
    id: `p${seed.sequence}`,
    slug: seed.slug ?? slugify(name, 60),
    reference: formatReference("project", 2026, seed.sequence),
    name,
    url: seed.url === undefined ? (client.website ?? null) : seed.url,
    description: seed.description,
    isPublic: seed.isPublic,
    client: { id: client.id, name: client.name, company: client.company, avatarUrl: client.avatarUrl },
    owner: { name: owner.name, avatarUrl: owner.avatarUrl },
    status: seed.status,
    tags: seed.tags,
    tools: seed.tools,
    budget: seed.budget ? { min: cents(seed.budget[0]), max: cents(seed.budget[1]) } : null,
    startedAt: day(seed.started),
    dueAt: seed.due === null ? null : day(seed.due),
    progress: seed.progress,
    coverUrl: null,
    hue: projectHueFor(name),
  };
};

export const previewProjects: Project[] = [...known, ...generated].map(build);
