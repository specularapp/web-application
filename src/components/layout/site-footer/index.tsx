import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { siteConfig } from "@/lib/metadata";
import { Logo } from "../logo";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <div className={styles.brand}>
          <Logo variant="logotipo" height={20} />
          <Text variant="footnote" tone="secondary">
            {siteConfig.description}
          </Text>
        </div>

        <nav className={styles.links} aria-label="Links do rodapé">
          <TextLink href="/politica-de-privacidade" tone="inherit">
            Política de Privacidade
          </TextLink>
          <TextLink href="/termos" tone="inherit">
            Termos de uso
          </TextLink>
          <TextLink href="/login" tone="inherit">
            Entrar
          </TextLink>
        </nav>
      </Container>

      <Container className={styles.legal}>
        <Text variant="caption1" tone="tertiary">
          Specular, gestão para freelancers e agências. Contato pelo e-mail contato@specular.com.br
        </Text>
      </Container>
    </footer>
  );
}
