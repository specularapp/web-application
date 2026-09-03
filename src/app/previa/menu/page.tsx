import { notFound } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { previewSidebar } from "@/components/layout/sidebar/preview";
import { Text } from "@/components/ui/text";
import { isHomologation } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";
import styles from "./menu.module.css";

export const metadata = createMetadata({
  title: "Prévia do menu",
  description: "Prévia de front da sidebar, no desktop e no celular",
  path: "/previa/menu",
  noIndex: true,
});

export default function MenuPreviewPage() {
  // Fora de homologação a rota não existe: é ferramenta de ajuste visual, não tela de produto.
  if (!isHomologation()) notFound();

  return (
    <div className={styles.screen}>
      <Sidebar {...previewSidebar} />
      <main className={styles.content}>
        <Text as="h1" variant="title2" weight="semibold">
          Prévia do menu
        </Text>
        <Text variant="subheadline" tone="secondary">
          Estreite a janela para menos de 48rem e o painel vira a barra flutuante do celular.
        </Text>
      </main>
    </div>
  );
}
