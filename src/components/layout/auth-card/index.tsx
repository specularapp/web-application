import { getImageProps } from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { Logo } from "../logo";
import styles from "./auth-card.module.css";

export type AuthCardHero = {
  src: string;
  eyebrow: string;
  title: string;
  description: string;
};

type AuthCardProps = {
  hero: AuthCardHero;
  children: ReactNode;
};

const heroSize = { width: 1200, height: 1600 };

function imageSet(srcSet = "") {
  const entries = srcSet.split(", ").map((entry) => {
    const [url, density] = entry.split(" ");
    return `url("${url}") ${density}`;
  });
  return `image-set(${entries.join(", ")})`;
}

function heroBackground(src: string) {
  const { props } = getImageProps({ src, alt: "", ...heroSize });
  return { "--auth-banner": imageSet(props.srcSet) } as CSSProperties;
}

export function AuthCard({ hero, children }: AuthCardProps) {
  return (
    <div className={styles.shell} style={heroBackground(hero.src)}>
      <aside className={styles.banner} {...squircle("3xl")}>
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
        <main className={styles.panel} {...squircle("3xl")}>
          {children}
        </main>
      </div>
    </div>
  );
}
