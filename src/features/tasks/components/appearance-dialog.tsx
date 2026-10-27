"use client";

import {
  BinocularsIcon,
  GlobeIcon,
  KanbanIcon,
  MegaphoneIcon,
  PaletteIcon,
  StorefrontIcon,
  TrayIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  AppearanceDialog,
  AppearancePopover,
  type AppearanceDialogProps,
  type AppearancePopoverProps,
} from "@/components/ui/stage-settings";
import { projectGlyphs, type ProjectGlyph } from "../tree";
import { stageColorOptions } from "./stages-dialog";

/**
 * A cara de um nó da árvore de tarefas (2026-09-22, a pedido de trazer para cá o que o funil de vendas já
 * tem): o nome, a cor e o glifo, no mesmo desenho da janela de aparência do CRM.
 *
 * Serve o **quadro** (o projeto, que não muda de nome aqui, porque isso é da ficha dele) e a **pasta**, que
 * muda. A cor não é enfeite nos dois casos: ela pinta o azulejo no menu, a contagem ao lado e, no projeto, a
 * marca gerada quando não há logo. É o que faz a árvore ser lida de relance em vez de item por item.
 */

const glyphNames: Record<ProjectGlyph, string> = {
  kanban: "Quadro",
  palette: "Paleta",
  globe: "Site",
  storefront: "Loja",
  megaphone: "Campanha",
  binoculars: "Pesquisa",
  tray: "Bandeja",
};

const glyphIcons: Record<ProjectGlyph, Icon> = {
  kanban: KanbanIcon,
  palette: PaletteIcon,
  globe: GlobeIcon,
  storefront: StorefrontIcon,
  megaphone: MegaphoneIcon,
  binoculars: BinocularsIcon,
  tray: TrayIcon,
};

/* O glifo do projeto e o da pasta saem da mesma lista: são os mesmos sete desenhos, e uma lista por nível da
   árvore seria a mesma coisa escrita duas vezes. */
export const projectGlyphOptions = projectGlyphs.map((value) => {
  const Glyph = glyphIcons[value];
  return { value, label: glyphNames[value], media: <Glyph /> };
});

/** A cara de um nó da árvore de tarefas, na mesma janela do funil de vendas. */
export function TaskAppearanceDialog(props: Omit<AppearanceDialogProps, "colorOptions" | "glyphOptions">) {
  return <AppearanceDialog {...props} colorOptions={stageColorOptions} glyphOptions={projectGlyphOptions} />;
}

export function TaskAppearancePopover(props: Omit<AppearancePopoverProps, "colorOptions" | "glyphOptions">) {
  return <AppearancePopover {...props} colorOptions={stageColorOptions} glyphOptions={projectGlyphOptions} />;
}
