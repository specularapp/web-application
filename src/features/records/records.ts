import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  AtIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CurrencyDollarIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  ListChecksIcon,
  MapPinIcon,
  PhoneIcon,
  ReceiptIcon,
  StackIcon,
  TagIcon,
  TimerIcon,
  UserIcon,
} from "@phosphor-icons/react/ssr";
import type { Route } from "next";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * O que existe na aplicação e pode ser apontado: tarefa, cliente, orçamento, projeto, contrato, item do
 * catálogo e pessoa da equipe (2026-09-10, a pedido de "marcar literalmente tudo dentro da aplicação").
 *
 * Vive num domínio próprio, e não dentro de tarefas, porque não é coisa de tarefa: é o índice da casa, e é
 * ele que responde tanto ao `#` do comentário quanto ao vincular registro da ficha. A paleta de comandos, que
 * hoje só busca as rotas do menu, é a próxima candidata a ler daqui.
 */
export const recordKindValues = ["task", "client", "quote", "project", "contract", "catalog", "person"] as const;

export type RecordKind = (typeof recordKindValues)[number];

/**
 * Os glifos que um fato do resumo pode usar. O índice é montado **no servidor** e desenhado no cliente, então
 * o que cruza a fronteira é a **chave**, e não o componente: é a mesma receita dos glifos de projeto da
 * árvore de tarefas.
 */
export const recordFactGlyphs = {
  at: AtIcon,
  phone: PhoneIcon,
  city: MapPinIcon,
  company: BuildingsIcon,
  role: BriefcaseIcon,
  money: CurrencyDollarIcon,
  date: CalendarBlankIcon,
  person: UserIcon,
  tag: TagIcon,
  list: ListChecksIcon,
  priority: FlagIcon,
  estimate: TimerIcon,
  quote: ReceiptIcon,
  project: FolderIcon,
  items: StackIcon,
} as const;

export type RecordFactGlyph = keyof typeof recordFactGlyphs;

/** Uma linha do resumo: o glifo que a nomeia e o que ela diz. */
export type RecordFact = { glyph: RecordFactGlyph; text: string };

/**
 * Como um registro se mostra no lugar do azulejo do domínio: pelo rosto de quem ele é, ou pelas artes do que
 * ele contém. A arte guarda o matiz de cada item e quantos itens existem, porque a fila agrupada da casa
 * pinta o véu do matiz em cada bolinha e escreve o total ao lado das primeiras.
 */
export type RecordMedia =
  | { kind: "face"; name: string }
  | { kind: "art"; items: { url: string; hue: string }[]; total: number };

export type AppRecord = {
  /** Único na casa: o tipo mais o id do registro, porque dois domínios podem repetir id. */
  key: string;
  kind: RecordKind;
  /** O identificador que a pessoa lê e fala (`TAR-2026-0031`); pessoa não tem. */
  reference?: string;
  name: string;
  /** Linha de apoio: a empresa do cliente, o valor do orçamento, a função de quem é da equipe. */
  caption?: string;
  /** Onde o registro mora. */
  href: Route;
  /**
   * O que o registro mostra no lugar do azulejo do domínio: o rosto de um cliente ou de uma pessoa, as artes
   * dos serviços de um orçamento. Montado onde o dado daquele domínio existe, e serializável, porque o
   * índice é construído no servidor e desenhado no cliente.
   */
  media?: RecordMedia;
  /**
   * O resumo do registro, para quem aponta uma marcação dele no comentário (2026-09-10, a pedido): as
   * etiquetas de situação, os fatos em linha com glifo e uma nota em texto corrido. Cada domínio preenche o
   * que tem; nada aqui é obrigatório, e o que falta simplesmente não é desenhado.
   */
  tags?: { text: string; tone: BadgeTone }[];
  facts?: RecordFact[];
  note?: string;
};

/** Como cada tipo aparece: o nome no singular e no plural, o glifo e o matiz do azulejo. */
export const recordKinds: Record<RecordKind, { label: string; plural: string; icon: Icon; hue: string }> = {
  task: { label: "Tarefa", plural: "Tarefas", icon: ListChecksIcon, hue: "var(--sys-cyan)" },
  client: { label: "Cliente", plural: "Clientes", icon: AddressBookIcon, hue: "var(--sys-teal)" },
  quote: { label: "Orçamento", plural: "Orçamentos", icon: ReceiptIcon, hue: "var(--sys-orange)" },
  project: { label: "Projeto", plural: "Projetos", icon: BriefcaseIcon, hue: "var(--sys-indigo)" },
  contract: { label: "Contrato", plural: "Contratos", icon: FileTextIcon, hue: "var(--sys-purple)" },
  catalog: { label: "Produto ou serviço", plural: "Produtos e serviços", icon: TagIcon, hue: "var(--sys-blue)" },
  person: { label: "Pessoa", plural: "Pessoas", icon: UserIcon, hue: "var(--sys-pink)" },
};

/** Quantos de cada tipo a busca devolve antes de pedir para refinar: o suficiente para escolher sem rolar. */
export const RECORDS_PER_KIND = 6;
