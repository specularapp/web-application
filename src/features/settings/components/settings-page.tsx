import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { AiUsage } from "@/features/ai/summary";
import styles from "./settings.module.css";

export type SettingsPageProps = {
  /** O uso da IA no ciclo, para o topo: sem ele o widget não aparece, como em toda página. */
  ai?: AiUsage;
  /** A ação ou a etiqueta da página, na linha acima dos blocos: um botão, um selo de contagem. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * A moldura de toda página de ajuste, refeita sobre a moldura de toda página da aplicação (2026-09-20, a
 * pedido de a configuração ficar "100% condizente" com o resto): o topo padrão, que sangra de ponta a ponta
 * com a rota, o nome da página como `h1` e o uso da IA, e abaixo a prancha com os blocos em `Card`.
 *
 * Antes ela tinha cabeçalho próprio (título grande num `Container`, linha de apoio, seções em `Surface`
 * com título e descrição), e era a única família de páginas que não passava pelo `Topbar`: sem rota, sem o
 * uso da IA, com outra escala de título e outro respiro. O nome da página passou a sair do menu, por
 * `navLocation`, como em toda outra tela, então a página não o repete nem o reinventa.
 *
 * Serve às sete páginas de `/configuracoes`, a Conquistas, Portfólio e Currículo: um acerto aqui chega em
 * todas, que foi a razão de a moldura ter sido extraída.
 */
export function SettingsPage({ ai, aside, children }: SettingsPageProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <div className={styles.board}>
        {aside && <div className={styles.head}>{aside}</div>}
        {children}
      </div>
    </div>
  );
}

export type SettingsSectionProps = {
  title: string;
  /** O que fica na outra ponta do título do bloco: um botão, um filtro, uma etiqueta. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * Um bloco da página, no `Card` da casa: o cabeçalho com o título e a ação discreta, o fio, o corpo. É o
 * mesmo cartão do painel e do financeiro, então o que muda entre uma página de ajuste e a visão geral é só
 * o que está dentro.
 */
export function SettingsSection({ title, aside, children }: SettingsSectionProps) {
  return (
    <Card title={title} action={aside}>
      <div className={styles.sectionBody}>{children}</div>
    </Card>
  );
}

/** Uma linha rótulo e valor, em duas colunas quando cabe. */
export function SettingsFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <Text as="dt" variant="footnote" tone="secondary">
        {label}
      </Text>
      <Text as="dd" variant="callout">
        {children}
      </Text>
    </div>
  );
}
