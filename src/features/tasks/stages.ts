import type { Icon } from "@phosphor-icons/react";
import {
  ArchiveIcon,
  BugIcon,
  CalendarBlankIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  ClockIcon,
  CodeIcon,
  CrosshairIcon,
  EyeIcon,
  FileTextIcon,
  FlagIcon,
  HandshakeIcon,
  HourglassIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PackageIcon,
  PaintBrushIcon,
  PaperPlaneTiltIcon,
  PaletteIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  ProhibitIcon,
  RocketLaunchIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  SparkleIcon,
  StarIcon,
  ThumbsUpIcon,
  TrayIcon,
  TruckIcon,
  UsersThreeIcon,
  WrenchIcon,
} from "@phosphor-icons/react/ssr";
import type { SysHue } from "@/lib/palette";

/**
 * As etapas do quadro de tarefas, que desde 2026-09-21 são **linhas do banco, e não um catálogo escrito
 * aqui** (a pedido: "quero que tenha como definir as etapas personalizadas, editar, excluir adicionar").
 * Cada equipe tem as suas, com nome, cor, glifo e o ponto do caminho em que a etapa está, e cada projeto
 * escolhe quais delas viram coluna do quadro dele e em que ordem.
 *
 * O catálogo é da **equipe**, e não do projeto: é o que mantém o quadro de todas as tarefas de pé, porque
 * ele cruza projetos com fluxos diferentes e precisa reunir numa coluna só o que é a mesma etapa. Com etapa
 * por projeto, duas colunas "Em revisão" de projetos distintos seriam duas coisas sem parentesco.
 *
 * O que sobra neste arquivo é o que não cabe no banco: a tradução do glifo, que é uma chave de um lado e um
 * componente do outro. Do pacote `ssr`, como o resto dos mapas leves da casa: ele é lido também no servidor,
 * e a entrada padrão do Phosphor cria contexto ao carregar.
 */

/** Em que ponto do caminho a etapa está, que é de onde a situação da tarefa é lida. */
export type TaskStageKind = "upcoming" | "ongoing" | "done";

export const stageKindValues = ["upcoming", "ongoing", "done"] as const;

export const stageKindLabels: Record<TaskStageKind, string> = {
  upcoming: "A começar",
  ongoing: "Em andamento",
  done: "Concluída",
};

/** O que cada ponto do caminho significa para a tarefa, na hora de escolher ao criar uma etapa. */
export const stageKindHints: Record<TaskStageKind, string> = {
  upcoming: "A tarefa ainda não começou",
  ongoing: "A tarefa está sendo feita",
  done: "A tarefa está fechada e sai da contagem do menu",
};

/**
 * Os glifos que uma etapa pode vestir. Lista fechada, igual à do enum do banco: glifo sem ícone no pacote
 * não desenha nada, então acrescentar um é a linha aqui e o valor lá.
 */
export const stageGlyphValues = [
  "tray",
  "circle-dashed",
  "circle-half",
  "prohibit",
  "eye",
  "thumbs-up",
  "rocket",
  "check-circle",
  "lightbulb",
  "pencil",
  "magnifier",
  "chat",
  "flag",
  "star",
  "clock",
  "hourglass",
  "package",
  "paint-brush",
  "code",
  "megaphone",
  "handshake",
  "bug",
  "crosshair",
  "file-text",
  "play",
  "pause",
  "archive",
  "sparkle",
  "users",
  "truck",
  "shield",
  "seal",
  "calendar",
  "send",
  "wrench",
  "palette",
] as const;

export type TaskStageGlyph = (typeof stageGlyphValues)[number];

/**
 * A chave vira componente aqui, e só aqui. O glifo atravessa a fronteira do servidor por chave, e não como
 * componente, pela mesma razão do azulejo do projeto na árvore: o que cruza essa fronteira precisa ser
 * serializável.
 */
export const stageGlyphs: Record<TaskStageGlyph, Icon> = {
  tray: TrayIcon,
  "circle-dashed": CircleDashedIcon,
  "circle-half": CircleHalfIcon,
  prohibit: ProhibitIcon,
  eye: EyeIcon,
  "thumbs-up": ThumbsUpIcon,
  rocket: RocketLaunchIcon,
  "check-circle": CheckCircleIcon,
  lightbulb: LightbulbIcon,
  pencil: PencilSimpleIcon,
  magnifier: MagnifyingGlassIcon,
  chat: ChatCircleTextIcon,
  flag: FlagIcon,
  star: StarIcon,
  clock: ClockIcon,
  hourglass: HourglassIcon,
  package: PackageIcon,
  "paint-brush": PaintBrushIcon,
  code: CodeIcon,
  megaphone: MegaphoneIcon,
  handshake: HandshakeIcon,
  bug: BugIcon,
  crosshair: CrosshairIcon,
  "file-text": FileTextIcon,
  play: PlayIcon,
  pause: PauseIcon,
  archive: ArchiveIcon,
  sparkle: SparkleIcon,
  users: UsersThreeIcon,
  truck: TruckIcon,
  shield: ShieldCheckIcon,
  seal: SealCheckIcon,
  calendar: CalendarBlankIcon,
  send: PaperPlaneTiltIcon,
  wrench: WrenchIcon,
  palette: PaletteIcon,
};

/** O id de uma etapa, que é o da linha no banco. */
export type TaskStageId = string;

/** Uma etapa como a coluna, o cartão e a ficha a desenham. */
export type TaskStage = {
  id: TaskStageId;
  name: string;
  hue: SysHue;
  glyph: TaskStageGlyph;
  kind: TaskStageKind;
};

/** O token de cor da etapa, que a coluna passa por variável e a etiqueta usa para se tingir. */
export const stageHue = (stage: Pick<TaskStage, "hue">) => `var(--sys-${stage.hue})`;

/** O componente do glifo da etapa; chave desconhecida cai no círculo tracejado, que é o glifo neutro. */
export const stageIcon = (stage: Pick<TaskStage, "glyph">): Icon => stageGlyphs[stage.glyph] ?? CircleDashedIcon;

/** A etapa de um id, dentro de uma lista já carregada. */
export const findStage = (stages: TaskStage[], id: TaskStageId) => stages.find((stage) => stage.id === id) ?? null;
