import { addDays, format } from "date-fns";
import { formatReference } from "@/lib/utils/reference";
import { previewClientsSummary } from "./preview";
import type { QuoteStatus } from "@/features/quotes/summary";
import type { ClientListItem } from "./list-options";
import type { Client, ClientProjectStatus } from "./summary";

/**
 * Base de exemplo da listagem enquanto o domínio não existe no banco. Quem montar a tabela troca só a
 * origem: a página recebe a página pronta e não sabe de onde ela veio.
 *
 * Os seis primeiros são os mesmos da prévia do painel, para o cliente em destaque lá e o cartão aqui
 * serem a mesma pessoa. O resto completa os 60 que o painel diz ter, com a maioria dentro dos últimos 30
 * dias, que é o período padrão da listagem: assim a paginação de 24 aparece já na primeira visita, com
 * três páginas (ajuste de 2026-09-08; antes eram 26, dos quais só 18 caíam no período, e a barra nunca
 * aparecia sem trocar o filtro). A ficha dos gerados sai de um padrão determinístico a partir do índice, como a
 * sequência da gamificação faz com os dias: dá conteúdo plausível sem inventar texto para cada um.
 * Ninguém tem foto, para o rosto gerado aparecer; o telefone vai só em dígitos, como no banco.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const ref = (kind: "client" | "quote" | "project", seq: number) => formatReference(kind, 2026, seq);

type Seed = { name: string; company: string; role: string; city: string; days: number; favorite?: boolean; active?: boolean };

const seeds: Seed[] = [
  { name: "Jonas Souza", company: "EPI Investments", role: "Investimentos", city: "São Paulo, SP", days: -8, favorite: true },
  { name: "Alice Teixeira", company: "LUCIA Materials", role: "Materiais de construção", city: "Campinas, SP", days: -9 },
  { name: "Renan Machado", company: "Machado Enterprise", role: "Consultoria empresarial", city: "Curitiba, PR", days: -11 },
  { name: "Marcela Santos", company: "Copos Company LTDA", role: "Embalagens", city: "Joinville, SC", days: -12 },
  { name: "Guilherme Ferreira", company: "F Ferragens", role: "Ferragens e ferramentas", city: "Belo Horizonte, MG", days: -14 },
  { name: "Ana Clara Macedo", company: "Bela Mackup", role: "Maquiagem e beleza", city: "Recife, PE", days: -15 },
  { name: "Fábio Oliveira", company: "FBO Advocacia", role: "Advocacia empresarial", city: "Brasília, DF", days: -17 },
  { name: "Helena Vasques", company: "Vasques Arquitetura", role: "Arquitetura residencial", city: "Porto Alegre, RS", days: -19, favorite: true },
  { name: "Otávio Prado", company: "Prado Consultoria", role: "Consultoria financeira", city: "Santos, SP", days: -21 },
  { name: "Bianca Rezende", company: "Rezende Studio", role: "Fotografia de produto", city: "Niterói, RJ", days: -23 },
  { name: "Caio Monteiro", company: "Monteiro Log", role: "Logística e entregas", city: "Guarulhos, SP", days: -26 },
  { name: "Sofia Lacerda", company: "Lacerda Joias", role: "Joalheria autoral", city: "Belo Horizonte, MG", days: -28 },
  { name: "Vitor Antunes", company: "Antunes Engenharia", role: "Engenharia civil", city: "Fortaleza, CE", days: -34, active: false },
  { name: "Larissa Pontes", company: "Pontes Odontologia", role: "Odontologia", city: "Goiânia, GO", days: -41 },
  { name: "Eduardo Bastos", company: "Bastos Contabilidade", role: "Contabilidade", city: "São Paulo, SP", days: -48, favorite: true },
  { name: "Priscila Navarro", company: "Navarro Eventos", role: "Eventos corporativos", city: "Salvador, BA", days: -55 },
  { name: "Murilo Tavares", company: "Tavares Transportes", role: "Transporte rodoviário", city: "Uberlândia, MG", days: -63, active: false },
  { name: "Isabela Fontes", company: "Fontes Nutrição", role: "Nutrição esportiva", city: "Florianópolis, SC", days: -74 },
  { name: "Rodrigo Sampaio", company: "Sampaio Seguros", role: "Corretora de seguros", city: "Ribeirão Preto, SP", days: -96 },
  { name: "Tereza Andrade", company: "Andrade Confecções", role: "Confecção sob medida", city: "Blumenau, SC", days: -140 },
  { name: "Bruno Cardoso", company: "Cardoso Marcenaria", role: "Móveis planejados", city: "Sorocaba, SP", days: -2 },
  { name: "Camila Furtado", company: "Furtado Idiomas", role: "Escola de idiomas", city: "Londrina, PR", days: -3, favorite: true },
  { name: "Diego Nascimento", company: "DN Fitness", role: "Academia e treinos", city: "Osasco, SP", days: -4 },
  { name: "Elisa Moraes", company: "Moraes Advocacia", role: "Advocacia trabalhista", city: "Vitória, ES", days: -5 },
  { name: "Felipe Rangel", company: "Rangel Imóveis", role: "Corretora de imóveis", city: "Maringá, PR", days: -6 },
  { name: "Gabriela Pires", company: "Pires Pâtisserie", role: "Confeitaria artesanal", city: "Curitiba, PR", days: -6 },
  { name: "Henrique Duarte", company: "Duarte Tech", role: "Assistência técnica", city: "Campinas, SP", days: -7 },
  { name: "Ingrid Salles", company: "Salles Decor", role: "Decoração de interiores", city: "Porto Alegre, RS", days: -9, favorite: true },
  { name: "João Pedro Lima", company: "JP Fotografia", role: "Fotografia de eventos", city: "Belo Horizonte, MG", days: -10 },
  { name: "Karina Rocha", company: "Rocha Contábil", role: "Escritório contábil", city: "São José, SC", days: -10 },
  { name: "Leonardo Assis", company: "Assis Engenharia", role: "Projetos elétricos", city: "Goiânia, GO", days: -11, active: false },
  { name: "Mariana Costa", company: "Costa Yoga", role: "Estúdio de yoga", city: "Florianópolis, SC", days: -12 },
  { name: "Nicolas Braga", company: "Braga Motors", role: "Oficina mecânica", city: "Santo André, SP", days: -13 },
  { name: "Olívia Freitas", company: "Freitas Pet", role: "Clínica veterinária", city: "Niterói, RJ", days: -14, favorite: true },
  { name: "Paulo Henrique Dias", company: "PH Serralheria", role: "Serralheria e portões", city: "Contagem, MG", days: -15 },
  { name: "Quésia Almeida", company: "Almeida Estética", role: "Clínica de estética", city: "Recife, PE", days: -16 },
  { name: "Ricardo Teles", company: "Teles Seguros", role: "Corretora de seguros", city: "Salvador, BA", days: -17 },
  { name: "Sabrina Lopes", company: "Lopes Cerimonial", role: "Cerimonial de casamentos", city: "Campo Grande, MS", days: -18 },
  { name: "Thiago Barros", company: "Barros Distribuidora", role: "Distribuição de bebidas", city: "Fortaleza, CE", days: -19 },
  { name: "Úrsula Mendes", company: "Mendes Arquitetura", role: "Arquitetura comercial", city: "Brasília, DF", days: -20, favorite: true },
  { name: "Vinícius Amaral", company: "Amaral Cursos", role: "Cursos profissionalizantes", city: "Ribeirão Preto, SP", days: -21 },
  { name: "Wesley Fonseca", company: "Fonseca Piscinas", role: "Piscinas e manutenção", city: "Cuiabá, MT", days: -22 },
  { name: "Ximena Carvalho", company: "Carvalho Vinhos", role: "Importadora de vinhos", city: "Bento Gonçalves, RS", days: -23 },
  { name: "Yasmin Ribeiro", company: "Ribeiro Kids", role: "Loja infantil", city: "Joinville, SC", days: -24 },
  { name: "Zeca Tavares", company: "Tavares Sonorização", role: "Som e iluminação", city: "Belém, PA", days: -25 },
  { name: "André Figueiredo", company: "Figueiredo Agro", role: "Insumos agrícolas", city: "Rio Verde, GO", days: -26 },
  { name: "Beatriz Nogueira", company: "Nogueira Consultoria", role: "Consultoria de RH", city: "São Paulo, SP", days: -27 },
  { name: "Cristiano Peixoto", company: "Peixoto Náutica", role: "Barcos e acessórios", city: "Angra dos Reis, RJ", days: -27, active: false },
  { name: "Daniela Queiroz", company: "Queiroz Orgânicos", role: "Hortifrúti orgânico", city: "Petrópolis, RJ", days: -28 },
  { name: "Emerson Vilela", company: "Vilela Transportes", role: "Fretes e mudanças", city: "Uberaba, MG", days: -28 },
  { name: "Fernanda Castro", company: "Castro Odonto", role: "Clínica odontológica", city: "Natal, RN", days: -29 },
  { name: "Gustavo Leal", company: "Leal Segurança", role: "Segurança patrimonial", city: "Manaus, AM", days: -29 },
  { name: "Heloísa Martins", company: "Martins Flores", role: "Floricultura", city: "Gramado, RS", days: -30, favorite: true },
  { name: "Igor Sant'Anna", company: "Sant'Anna Games", role: "Loja de games", city: "São Luís, MA", days: -32 },
];

/* As três coisas que variam por cliente na prévia, escolhidas pelo índice para não repetir em fila. */
const services = ["Site institucional", "Identidade visual", "Loja virtual", "Landing page", "Sistema interno"];
const origins = ["Indicação", "Instagram", "Busca no Google", "Evento", "Cliente antigo"];
const quoteStates: QuoteStatus[] = ["approved", "sent", "viewed", "draft", "declined"];
const projectStates: ClientProjectStatus[] = ["ongoing", "done", "paused"];

const slug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

const generated: Client[] = seeds.map((seed, index) => {
  // Numeração de cima para baixo: quem entrou por último tem o número mais alto, e a lista já vem do mais
  // novo para o mais antigo.
  const sequence = previewClientsSummary.total - previewClientsSummary.clients.length - index;
  const first = slug(seed.name.split(" ")[0] ?? seed.name);
  const service = services[index % services.length] ?? services[0]!;
  const quotes = (index % 3) + 1;
  const projects = index % 3;
  const billed = 180_000 + index * 47_000;

  return {
    id: `cl${index + 1}`,
    reference: ref("client", sequence),
    name: seed.name,
    email: `${first}@${slug(seed.company)}.com.br`,
    phone: `119${String(40000000 + index * 1_111_111).slice(0, 8)}`,
    avatarUrl: null,
    createdAt: day(seed.days),
    company: seed.company,
    role: seed.role,
    city: seed.city,
    website: `https://${slug(seed.company)}.com.br`,
    about: `Chegou por ${(origins[index % origins.length] ?? origins[0]!).toLowerCase()} e trabalha com ${seed.role.toLowerCase()}. O pedido em aberto é ${service.toLowerCase()}, com prazo combinado para o mês que vem.`,
    tags: [service, origins[index % origins.length] ?? origins[0]!],
    active: seed.active ?? true,
    favorite: seed.favorite ?? false,
    stats: { quotes, projects, billed, open: Math.round(billed * 0.4) },
    quotes: Array.from({ length: quotes }, (_, position) => ({
      id: `cl${index + 1}q${position + 1}`,
      number: ref("quote", 40 - index * 2 - position),
      title: `${services[(index + position) % services.length] ?? service} para ${seed.company}`,
      amount: 240_000 + position * 130_000 + index * 11_000,
      status: quoteStates[(index + position) % quoteStates.length] ?? "sent",
      date: day(seed.days + position * 3),
    })),
    projects: Array.from({ length: projects }, (_, position) => ({
      id: `cl${index + 1}p${position + 1}`,
      reference: ref("project", 30 - index - position),
      name: `${services[(index + position + 1) % services.length] ?? service}`,
      status: projectStates[(index + position) % projectStates.length] ?? "ongoing",
      progress: 25 + ((index * 17 + position * 31) % 70),
    })),
  };
});

/** A base inteira, com a ficha completa: é dela que a gaveta lateral lê ao abrir um cliente. */
export const previewClients: Client[] = [...previewClientsSummary.clients, ...generated];

/* A listagem carrega só o que o cartão mostra: a ficha completa fica para quem abrir a gaveta. */
export const previewClientsList: ClientListItem[] = previewClients.map((client) => ({
  id: client.id,
  reference: client.reference,
  name: client.name,
  email: client.email,
  phone: client.phone,
  avatarUrl: client.avatarUrl,
  createdAt: client.createdAt,
  company: client.company,
  active: client.active,
  favorite: client.favorite,
}));
