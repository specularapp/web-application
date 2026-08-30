import type { ReactNode } from "react";
import { GradientBlinds } from "@/components/ui/gradient-blinds";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { Logo } from "../logo";
import styles from "./auth-card.module.css";

export type AuthCardHero = {
  colors: string[];
  eyebrow: string;
  title: string;
  description: string;
};

type AuthCardProps = {
  hero: AuthCardHero;
  children: ReactNode;
};

export function AuthCard({ hero, children }: AuthCardProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.banner} {...squircle("3xl")}>
        <GradientBlinds
          colors={hero.colors}
          angle={12}
          noise={0.22}
          blindCount={14}
          blindMinWidth={48}
          spotlightRadius={2.2}
          spotlightOpacity={0.9}
          mouseDampening={0.6}
          mixBlendMode="normal"
        />
        <div className={styles.hero}>
          <Text as="p" variant="footnote" weight="medium" font="code" className={styles.heroEyebrow}>
            {hero.eyebrow}
          </Text>
          <Text as="h2" variant="title1" weight="medium" className={styles.heroTitle}>
            {hero.title}
          </Text>
          <Text as="p" variant="subheadline" className={styles.heroText}>
            {hero.description}
          </Text>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.brand}>
          <Logo variant="logotipo" height={32} />
        </header>
        <main className={styles.panel} {...squircle("xl")}>
          {children}
        </main>
      </div>
    </div>
  );
}
