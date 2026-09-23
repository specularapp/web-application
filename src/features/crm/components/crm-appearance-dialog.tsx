"use client";

import { BuildingsIcon, FunnelIcon, HandshakeIcon, MegaphoneIcon, StorefrontIcon, TargetIcon, TrayIcon } from "@phosphor-icons/react";
import {
  AppearanceDialog,
  AppearancePopover,
  Swatch,
  type AppearancePopoverProps,
} from "@/components/ui/stage-settings";
import { crmHues, type CrmHue } from "../stages";
import type { FunnelGlyph } from "../tree";

const hueNames: Record<CrmHue, string> = { red: "Vermelho", orange: "Laranja", yellow: "Amarelo", green: "Verde", mint: "Menta", teal: "Turquesa", cyan: "Ciano", blue: "Azul", indigo: "Índigo", purple: "Roxo", pink: "Rosa", brown: "Marrom", gray: "Cinza" };
export const crmColorOptions = crmHues.map((value) => ({
  value: value as string,
  label: hueNames[value],
  media: <Swatch hue={value} />,
}));
const iconOptions: { value: string; label: string; media: React.ReactNode }[] = [
  { value: "funnel", label: "Funil", media: <FunnelIcon /> },
  { value: "storefront", label: "Loja", media: <StorefrontIcon /> },
  { value: "megaphone", label: "Campanha", media: <MegaphoneIcon /> },
  { value: "handshake", label: "Parceria", media: <HandshakeIcon /> },
  { value: "target", label: "Meta", media: <TargetIcon /> },
  { value: "buildings", label: "Empresa", media: <BuildingsIcon /> },
  { value: "tray", label: "Bandeja", media: <TrayIcon /> },
];

export type CrmAppearance = { name: string; hue: CrmHue; glyph: FunnelGlyph };

type Props = {
  title: string;
  folder?: boolean;
  initial?: Partial<CrmAppearance>;
  onClose: () => void;
  onSave: (value: CrmAppearance) => Promise<string | undefined>;
};

type PopoverProps = Omit<AppearancePopoverProps, "colorOptions" | "glyphOptions" | "labels" | "onSave"> & {
  folder?: boolean;
  initial?: Partial<CrmAppearance>;
  onSave: (value: CrmAppearance) => Promise<string | undefined>;
};

/**
 * A cara de um nó da árvore do funil. A tela é o primitivo `AppearanceDialog` (2026-09-22): a mesma peça
 * serve o funil e o quadro de tarefas, e o que fica aqui é o que só o CRM sabe, que é a lista de ícones dele
 * e o fato de a pasta não ter ícone nenhum.
 */
export function CrmAppearanceDialog({ title, folder, initial, onClose, onSave }: Props) {
  return (
    <AppearanceDialog
      title={title}
      colorOptions={crmColorOptions}
      glyphOptions={folder ? undefined : iconOptions}
      labels={{ hue: folder ? "Cor da pasta" : "Cor do funil", glyph: "Ícone do funil" }}
      initial={initial}
      onClose={onClose}
      onSave={(value) => onSave({ name: value.name, hue: value.hue as CrmHue, glyph: value.glyph as FunnelGlyph })}
    />
  );
}

export function CrmAppearancePopover({ folder, initial, onSave, ...props }: PopoverProps) {
  return (
    <AppearancePopover
      {...props}
      colorOptions={crmColorOptions}
      glyphOptions={folder ? undefined : iconOptions}
      labels={{ hue: folder ? "Cor da pasta" : "Cor do funil", glyph: "Ícone do funil" }}
      initial={initial}
      onSave={(value) => onSave({ name: value.name, hue: value.hue as CrmHue, glyph: value.glyph as FunnelGlyph })}
    />
  );
}
