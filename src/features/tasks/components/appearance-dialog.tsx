"use client";

import { useToast } from "@/components/providers/toast-provider";
import { AppearanceDialog, type AppearanceDialogProps } from "@/components/ui/stage-settings";
import { setProjectAppearanceAction } from "@/features/projects/actions";
import type { ProjectHue } from "@/features/projects/summary";
import { callAction } from "@/lib/action";
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

/* O glifo do projeto e o da pasta saem da mesma lista: são os mesmos sete desenhos, e uma lista por nível da
   árvore seria a mesma coisa escrita duas vezes. */
export const projectGlyphOptions = projectGlyphs.map((value) => ({ value, label: glyphNames[value] }));

/** A cara de um nó da árvore de tarefas, na mesma janela do funil de vendas. */
export function TaskAppearanceDialog(props: Omit<AppearanceDialogProps, "colorOptions" | "glyphOptions">) {
  return <AppearanceDialog {...props} colorOptions={stageColorOptions} glyphOptions={projectGlyphOptions} />;
}

/** A cor e o glifo do quadro, que são os do projeto. O nome fica na ficha dele, e não aqui. */
export function BoardLookDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: { id: string; name: string; hue: ProjectHue; glyph: ProjectGlyph };
  onClose: () => void;
}) {
  const { toast } = useToast();

  return (
    <TaskAppearanceDialog
      open={open}
      title="Cor do quadro"
      withName={false}
      initial={{ hue: project.hue, glyph: project.glyph }}
      onClose={onClose}
      onSave={async (value) => {
        const result = await callAction(setProjectAppearanceAction({ id: project.id, hue: value.hue, glyph: value.glyph }));
        if (!result.ok) return result.error;
        toast({ title: "Cor do quadro salva", description: `${project.name} já aparece assim no menu.`, tone: "success" });
        return undefined;
      }}
    />
  );
}
