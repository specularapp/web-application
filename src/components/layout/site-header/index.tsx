import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/link";
import { Logo } from "../logo";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Specular, ir para o início">
          <Logo variant="logotipo" height={24} />
        </Link>

        <nav className={styles.actions} aria-label="Acesso à conta">
          <TextLink href="/login" tone="inherit">
            Entrar
          </TextLink>
          <Button href="/cadastro" size="sm">
            Criar conta
          </Button>
        </nav>
      </Container>
    </header>
  );
}
