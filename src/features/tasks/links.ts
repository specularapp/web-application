import type { Icon } from "@phosphor-icons/react";
import { AddressBookIcon, BriefcaseIcon, FileTextIcon, ReceiptIcon } from "@phosphor-icons/react/ssr";
import type { Route } from "next";
import type { TaskLinkKind } from "./summary";

/**
 * Como cada tipo de vínculo aparece e para onde ele leva. Num lugar só, porque as quatro coisas andam juntas:
 * o nome do tipo, o glifo, o matiz do azulejo e o endereço do registro. O glifo e o matiz são os mesmos que a
 * rota daquele domínio tem no menu, então o vínculo é reconhecido antes de ser lido.
 *
 * Do pacote `ssr` como o resto dos mapas leves da casa.
 */
export const linkKindValues = ["client", "quote", "project", "contract"] as const satisfies readonly TaskLinkKind[];

export const taskLinkKinds: Record<TaskLinkKind, { label: string; plural: string; icon: Icon; hue: string; path: (id: string) => Route }> = {
  client: { label: "Cliente", plural: "Clientes", icon: AddressBookIcon, hue: "var(--sys-teal)", path: (id) => `/clientes/${id}` as Route },
  quote: { label: "Orçamento", plural: "Orçamentos", icon: ReceiptIcon, hue: "var(--sys-orange)", path: (id) => `/orcamentos/${id}` as Route },
  project: { label: "Projeto", plural: "Projetos", icon: BriefcaseIcon, hue: "var(--sys-indigo)", path: (id) => `/projetos/${id}` as Route },
  contract: { label: "Contrato", plural: "Contratos", icon: FileTextIcon, hue: "var(--sys-purple)", path: (id) => `/contratos/${id}` as Route },
};
