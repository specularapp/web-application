import { addDays, format } from "date-fns";
import { previewClientsList } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import type { QuoteStatus } from "@/features/quotes/summary";
import { formatReference } from "@/lib/utils/reference";
import type { CatalogItem } from "./summary";

/**
 * Catálogo de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem: a
 * página recebe a página pronta e não sabe de onde ela veio. Trinta e seis itens, para a paginação de trinta
 * aparecer já na primeira visita; dois inativos, para o filtro ter o que mostrar. Ninguém tem foto, para a
 * arte gerada aparecer. Preço em centavos, como em todo lugar do produto.
 *
 * O que é da mão (nome, descrição, preço, prazo) está escrito item a item; o resto da ficha (entregáveis,
 * pré-requisitos, custo, orçamentos recentes) sai de um padrão determinístico por categoria e por índice,
 * como a base de clientes faz: dá conteúdo plausível sem inventar texto para cada um. Os clientes dos
 * orçamentos são os da prévia de clientes, para a ficha do item e a do cliente falarem das mesmas pessoas.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

type Seed = Pick<CatalogItem, "name" | "description" | "kind" | "category" | "price" | "unit" | "duration" | "hue" | "stock"> & {
  days: number;
  active?: boolean;
  /** Em quantos orçamentos o item entrou. */
  quotes: number;
};

const seeds: Seed[] = [
  { name: "Landing page", description: "Página única de conversão, com copy, formulário e medição de resultado.", kind: "service", category: "Aplicação web", price: 120_000, unit: "project", duration: { min: 7, max: 14 }, hue: "green", days: -180, quotes: 31 },
  { name: "Página institucional", description: "Site de apresentação da empresa, com até seis páginas e blog opcional.", kind: "service", category: "Aplicação web", price: 629_320, unit: "project", duration: { min: 15, max: 30 }, hue: "red", days: -175, quotes: 22 },
  { name: "E-commerce", description: "Loja completa com catálogo, carrinho, pagamento e painel de pedidos.", kind: "service", category: "Aplicação web", price: 2_612_020, unit: "project", duration: { min: 45, max: 90 }, hue: "teal", days: -170, quotes: 9 },
  { name: "Aplicativo mobile", description: "App para Android e iOS a partir de uma base só, publicado nas lojas.", kind: "service", category: "Aplicação web", price: 3_890_000, unit: "project", duration: { min: 60, max: 120 }, hue: "blue", days: -160, quotes: 6 },
  { name: "Sistema sob medida", description: "Aplicação interna desenhada para o processo da empresa, com acesso por perfil.", kind: "service", category: "Aplicação web", price: 5_400_000, unit: "project", duration: { min: 90, max: 180 }, hue: "indigo", days: -150, quotes: 4 },
  { name: "Design system", description: "Componentes, tokens e documentação para o time desenhar e construir igual.", kind: "service", category: "Aplicação web", price: 389_090, unit: "project", duration: { min: 20, max: 40 }, hue: "purple", days: -140, quotes: 7 },
  { name: "Identidade visual", description: "Marca, paleta, tipografia e manual de uso, prontos para aplicar em tudo.", kind: "service", category: "Identidade visual", price: 450_000, unit: "project", duration: { min: 20, max: 30 }, hue: "pink", days: -130, quotes: 18 },
  { name: "Logotipo", description: "Símbolo e assinatura em versões horizontal, vertical e reduzida.", kind: "service", category: "Identidade visual", price: 180_000, unit: "project", duration: { min: 10, max: 15 }, hue: "orange", days: -125, quotes: 27 },
  { name: "Apresentação comercial", description: "Deck de vendas com até vinte lâminas, no padrão da marca.", kind: "service", category: "Identidade visual", price: 95_000, unit: "project", duration: { min: 5, max: 7 }, hue: "yellow", days: -120, quotes: 14 },
  { name: "Gestão de redes sociais", description: "Planejamento, criação e publicação de doze posts por mês, com relatório.", kind: "service", category: "Marketing", price: 240_000, unit: "month", hue: "red", days: -110, quotes: 11 },
  { name: "Campanha de anúncios", description: "Configuração e otimização semanal de campanhas no Google e na Meta.", kind: "service", category: "Marketing", price: 150_000, unit: "month", hue: "green", days: -100, quotes: 13 },
  { name: "E-mail marketing", description: "Sequência automática de boas-vindas e uma campanha mensal, com métricas.", kind: "service", category: "Marketing", price: 69_000, unit: "month", hue: "cyan", days: -95, quotes: 8 },
  { name: "Fotografia de produto", description: "Foto em fundo branco com tratamento, pronta para loja e catálogo.", kind: "service", category: "Conteúdo", price: 8_500, unit: "unit", duration: { min: 3, max: 5 }, hue: "brown", days: -90, quotes: 40 },
  { name: "Vídeo institucional", description: "Roteiro, captação e edição de vídeo de até dois minutos.", kind: "service", category: "Conteúdo", price: 780_000, unit: "project", duration: { min: 20, max: 30 }, hue: "indigo", days: -85, quotes: 5 },
  { name: "Domínio", description: "Registro do endereço da marca por um ano, com renovação avisada.", kind: "product", category: "Infraestrutura", price: 32_000, unit: "unit", hue: "mint", days: -80, quotes: 35, stock: { quantity: 48, capacity: 100, minimum: 10 } },
  { name: "Hospedagem", description: "Servidor gerenciado com backup diário, certificado e monitoramento.", kind: "product", category: "Infraestrutura", price: 8_990, unit: "month", hue: "blue", days: -75, quotes: 29 },
  { name: "Certificado SSL", description: "Cadeado no endereço, instalado e renovado sem a pessoa se preocupar.", kind: "product", category: "Infraestrutura", price: 24_000, unit: "unit", hue: "green", days: -70, quotes: 16, active: false, stock: { quantity: 3, capacity: 50, minimum: 5 } },
  { name: "Banco de dados gerenciado", description: "Instância dedicada com backup, réplica e alertas de uso.", kind: "product", category: "Infraestrutura", price: 35_000, unit: "month", hue: "teal", days: -60, quotes: 3 },
  { name: "Suporte técnico", description: "Atendimento em horário comercial, com correções e pequenas melhorias.", kind: "service", category: "Suporte", price: 120_000, unit: "month", hue: "orange", days: -50, quotes: 12 },
  { name: "Consultoria", description: "Hora de especialista para decisão técnica, arquitetura ou revisão.", kind: "service", category: "Suporte", price: 25_000, unit: "hour", hue: "purple", days: -40, quotes: 21 },
  { name: "Auditoria de acessibilidade", description: "Revisão completa contra a WCAG, com relatório e plano de correção.", kind: "service", category: "Suporte", price: 290_000, unit: "project", duration: { min: 10, max: 15 }, hue: "cyan", days: -20, quotes: 2 },
  { name: "Blog corporativo", description: "Blog integrado ao site, com categorias, busca e autores.", kind: "service", category: "Aplicação web", price: 210_000, unit: "project", duration: { min: 10, max: 20 }, hue: "cyan", days: -168, quotes: 14 },
  { name: "Área de membros", description: "Login, planos e conteúdo restrito por assinatura, com pagamento recorrente.", kind: "service", category: "Aplicação web", price: 1_480_000, unit: "project", duration: { min: 30, max: 60 }, hue: "pink", days: -155, quotes: 6 },
  { name: "Integração de sistemas", description: "Ligação entre o site e o ERP, o CRM ou o gateway, com fila e registro de erros.", kind: "service", category: "Aplicação web", price: 35_000, unit: "hour", hue: "orange", days: -150, quotes: 10 },
  { name: "Papelaria", description: "Cartão de visita, papel timbrado e assinatura de e-mail no padrão da marca.", kind: "service", category: "Identidade visual", price: 68_000, unit: "project", duration: { min: 5, max: 10 }, hue: "mint", days: -118, quotes: 19 },
  { name: "Naming", description: "Nome para a marca ou o produto, com verificação de domínio e de registro.", kind: "service", category: "Identidade visual", price: 320_000, unit: "project", duration: { min: 15, max: 25 }, hue: "blue", days: -115, quotes: 4 },
  { name: "SEO mensal", description: "Otimização contínua de conteúdo e técnica, com relatório de posições.", kind: "service", category: "Marketing", price: 180_000, unit: "month", hue: "green", days: -105, quotes: 17 },
  { name: "Landing de campanha", description: "Página de campanha sazonal com contagem regressiva e formulário.", kind: "service", category: "Marketing", price: 85_000, unit: "project", duration: { min: 5, max: 8 }, hue: "yellow", days: -98, quotes: 22 },
  { name: "Redação de conteúdo", description: "Artigo de até mil palavras, com pesquisa de palavras-chave e revisão.", kind: "service", category: "Conteúdo", price: 45_000, unit: "unit", duration: { min: 3, max: 5 }, hue: "purple", days: -88, quotes: 31 },
  { name: "Motion para redes", description: "Animação curta de até quinze segundos, no formato de cada rede.", kind: "service", category: "Conteúdo", price: 120_000, unit: "unit", duration: { min: 5, max: 7 }, hue: "red", days: -83, quotes: 9 },
  { name: "Ilustração", description: "Ilustração autoral para site, apresentação ou material impresso.", kind: "service", category: "Conteúdo", price: 65_000, unit: "unit", duration: { min: 4, max: 8 }, hue: "teal", days: -78, quotes: 12 },
  { name: "E-mail profissional", description: "Caixas de e-mail no domínio da marca, com antispam e agenda.", kind: "product", category: "Infraestrutura", price: 2_490, unit: "month", hue: "indigo", days: -65, quotes: 26 },
  { name: "Licença de tema premium", description: "Tema pago para a loja ou o site, com atualizações por um ano.", kind: "product", category: "Infraestrutura", price: 39_000, unit: "unit", hue: "brown", days: -55, quotes: 7, stock: { quantity: 12, capacity: 30, minimum: 5 } },
  { name: "Manutenção do site", description: "Atualizações, backups e pequenas mudanças de conteúdo, todo mês.", kind: "service", category: "Suporte", price: 49_000, unit: "month", hue: "pink", days: -45, quotes: 24 },
  { name: "Treinamento da equipe", description: "Turma de até dez pessoas para usar o painel e publicar conteúdo.", kind: "service", category: "Suporte", price: 160_000, unit: "project", duration: { min: 2, max: 3 }, hue: "mint", days: -30, quotes: 8 },
  { name: "Template de site", description: "Modelo pronto para personalizar, com página inicial, sobre e contato.", kind: "product", category: "Aplicação web", price: 49_000, unit: "unit", hue: "yellow", days: -6, quotes: 0, active: false, stock: { quantity: 0, capacity: 25, minimum: 2 } },
];

type Kit = Pick<CatalogItem, "deliverables" | "requirements" | "tags">;

/* O que cada família entrega e pede, escrito uma vez por categoria: é o que muda de verdade entre um site e
   uma campanha, e não entre dois sites. */
const kits: Record<string, Kit> = {
  "Aplicação web": {
    deliverables: ["Layout responsivo aprovado em protótipo", "Código publicado no domínio do cliente", "Painel de conteúdo com acesso da equipe", "Métricas e SEO técnico configurados"],
    requirements: ["Identidade visual e textos", "Acesso ao domínio e à hospedagem", "Referências do que o cliente gosta"],
    tags: ["Next.js", "Responsivo", "SEO"],
  },
  "Identidade visual": {
    deliverables: ["Arquivos em vetor e PNG", "Manual de uso da marca", "Versões para fundo claro e escuro"],
    requirements: ["Briefing respondido", "Referências visuais", "Nome e slogan definidos"],
    tags: ["Marca", "Design"],
  },
  Marketing: {
    deliverables: ["Planejamento mensal aprovado", "Peças no padrão da marca", "Relatório de resultados no fim do mês"],
    requirements: ["Acesso às contas e ao gerenciador de anúncios", "Verba de mídia definida", "Calendário de lançamentos"],
    tags: ["Recorrente", "Mídia"],
  },
  Conteúdo: {
    deliverables: ["Arquivos finais em alta resolução", "Versões para redes e site", "Tratamento de cor incluso"],
    requirements: ["Produtos ou roteiro em mãos", "Local e data combinados"],
    tags: ["Produção", "Mídia"],
  },
  Infraestrutura: {
    deliverables: ["Configuração feita e testada", "Acessos entregues ao cliente", "Renovação avisada com antecedência"],
    requirements: ["Dados cadastrais do titular", "Acesso ao registro atual, se houver"],
    tags: ["Recorrente", "Técnico"],
  },
  Suporte: {
    deliverables: ["Atendimento em horário comercial", "Registro do que foi feito", "Relatório mensal"],
    requirements: ["Canal de contato definido", "Acessos aos sistemas"],
    tags: ["Recorrente", "Atendimento"],
  },
};

/* A situação dos orçamentos recentes roda por esta ordem, para a lista ter de tudo sem ser aleatória. */
const statusCycle: QuoteStatus[] = ["approved", "sent", "approved", "viewed", "declined", "draft", "expired"];

const NOTE = "Valor revisado no último trimestre. Para mais de três unidades no mesmo pedido, combinar o prazo com a equipe antes de enviar.";

export const previewCatalog: CatalogItem[] = seeds.map(({ days, active = true, quotes, ...seed }, index) => {
  const kit = kits[seed.category];
  const service = seed.kind === "service";
  const approved = Math.round(quotes * (0.35 + (index % 4) * 0.1));

  const recent = Array.from({ length: Math.min(3, quotes) }, (_, position) => {
    const client = previewClientsList[(index * 5 + position * 3) % previewClientsList.length];
    const who = client.company ?? client.name;
    return {
      id: `catalog-${index + 1}-quote-${position + 1}`,
      number: formatReference("quote", 2026, index * 4 + position + 1),
      title: `${seed.name} para ${who}`,
      client: who,
      amount: Math.round(seed.price * (1 + (((index + position) % 3) - 1) * 0.08)),
      status: statusCycle[(index + position) % statusCycle.length],
      date: day(-(position * 9 + (index % 7) + 1)),
    };
  });

  return {
    ...seed,
    id: `catalog-${index + 1}`,
    reference: formatReference("catalog", 2026, index + 1),
    createdAt: day(days),
    createdBy: previewTeamSummary.members[index % previewTeamSummary.members.length].name,
    updatedAt: day(Math.round(days / 2)),
    active,
    imageUrl: null,
    cost: seed.unit === "hour" ? null : Math.round(seed.price * (service ? 0.38 : 0.62)),
    maxDiscount: index % 3 === 0 ? 15 : 10,
    ...(service && { revisions: index % 2 === 0 ? 2 : 3 }),
    supportDays: service ? (seed.price >= 1_000_000 ? 90 : 30) : null,
    deliverables: kit.deliverables,
    requirements: kit.requirements,
    tags: kit.tags,
    ...(index % 4 === 0 && { notes: NOTE }),
    stats: { quotes, approved, billed: approved * seed.price, lastQuotedAt: recent[0]?.date ?? null },
    quotes: recent,
  };
});
