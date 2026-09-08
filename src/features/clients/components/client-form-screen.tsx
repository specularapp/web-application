import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { Client } from "../summary";
import { ClientForm } from "./client-form";
import styles from "./clients-screen.module.css";

export type ClientFormScreenProps = { client?: Client; ai: AiUsage };

// A tela de criar e de editar cliente: o topo padrão com o nome certo e, abaixo, o formulário. É a mesma
// tela nos dois casos; o que muda é a ficha que chega, ou não chega.
export function ClientFormScreen({ client, ai }: ClientFormScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title={client ? "Editar cliente" : "Novo cliente"} ai={ai} />
      <ClientForm client={client} />
    </div>
  );
}
