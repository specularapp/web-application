import { addDays, format } from "date-fns";
import { formatReference } from "@/lib/utils/reference";
import { previewClientsSummary } from "./preview";
import type { ClientListItem } from "./list-options";

/**
 * Base de exemplo da listagem enquanto o domínio não existe no banco. Quem montar a tabela troca só a
 * origem: a página recebe a página pronta e não sabe de onde ela veio.
 *
 * Os seis primeiros são os mesmos da prévia do painel, para o cliente em destaque lá e o cartão aqui
 * serem a mesma pessoa. O resto completa os 26 que o painel diz ter, o bastante para a paginação de 12
 * mostrar três páginas. Ninguém tem foto, para o rosto gerado aparecer; o telefone vai só em dígitos,
 * como no banco.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/* Os seis da prévia do painel, reduzidos ao que o cartão usa. */
const fromSummary: ClientListItem[] = previewClientsSummary.clients.map((client) => ({
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

type Seed = { name: string; company: string; days: number; favorite?: boolean; active?: boolean };

const seeds: Seed[] = [
  { name: "Jonas Souza", company: "EPI Investments", days: -8, favorite: true },
  { name: "Alice Teixeira", company: "LUCIA Materials", days: -9 },
  { name: "Renan Machado", company: "Machado Enterprise", days: -11 },
  { name: "Marcela Santos", company: "Copos Company LTDA", days: -12 },
  { name: "Guilherme Ferreira", company: "F Ferragens", days: -14 },
  { name: "Ana Clara Macedo", company: "Bela Mackup", days: -15 },
  { name: "Fábio Oliveira", company: "FBO Advocacia", days: -17 },
  { name: "Helena Vasques", company: "Vasques Arquitetura", days: -19, favorite: true },
  { name: "Otávio Prado", company: "Prado Consultoria", days: -21 },
  { name: "Bianca Rezende", company: "Rezende Studio", days: -23 },
  { name: "Caio Monteiro", company: "Monteiro Log", days: -26 },
  { name: "Sofia Lacerda", company: "Lacerda Joias", days: -28 },
  { name: "Vitor Antunes", company: "Antunes Engenharia", days: -34, active: false },
  { name: "Larissa Pontes", company: "Pontes Odontologia", days: -41 },
  { name: "Eduardo Bastos", company: "Bastos Contabilidade", days: -48, favorite: true },
  { name: "Priscila Navarro", company: "Navarro Eventos", days: -55 },
  { name: "Murilo Tavares", company: "Tavares Transportes", days: -63, active: false },
  { name: "Isabela Fontes", company: "Fontes Nutrição", days: -74 },
  { name: "Rodrigo Sampaio", company: "Sampaio Seguros", days: -96 },
  { name: "Tereza Andrade", company: "Andrade Confecções", days: -140 },
];

/* O identificador de cada um segue a sequência da casa, do mais novo para o mais antigo. */
const generated: ClientListItem[] = seeds.map((seed, index) => {
  const sequence = previewClientsSummary.total - fromSummary.length - index;
  const handle = seed.name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").split(" ");

  return {
    id: `cl${index + 1}`,
    reference: formatReference("client", 2026, sequence),
    name: seed.name,
    email: `${handle[0]}@${seed.company.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.com.br`,
    phone: `11${String(940000000 + index * 111111).slice(0, 9)}`,
    avatarUrl: null,
    createdAt: day(seed.days),
    company: seed.company,
    active: seed.active ?? true,
    favorite: seed.favorite ?? false,
  };
});

export const previewClientsList: ClientListItem[] = [...fromSummary, ...generated];
