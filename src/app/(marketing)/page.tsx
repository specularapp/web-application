import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { createMetadata } from "@/lib/metadata";
import styles from "./marketing.module.css";

export const metadata = createMetadata({
  title: "Specular: gestão completa para freelancers e agências",
  description:
    "CRM, orçamentos, contratos, cobrança, projetos, portfólio e financeiro em um só lugar para quem vive de projeto",
  path: "/",
  origin: "site",
  absoluteTitle: true,
});

const recursos = [
  {
    titulo: "CRM e propostas",
    texto: "Registre cada contato, acompanhe o funil e transforme a conversa em orçamento sem sair do lugar.",
  },
  {
    titulo: "Contratos e assinatura",
    texto: "Gere o contrato a partir do orçamento aprovado e envie para assinatura com um link seguro.",
  },
  {
    titulo: "Cobrança e financeiro",
    texto: "Emita cobranças, acompanhe recebimentos e enxergue entradas e saídas do mês em um painel só.",
  },
  {
    titulo: "Projetos e entregas",
    texto: "Organize etapas, prazos e responsáveis, com o cliente vendo o andamento pelo link que você compartilha.",
  },
  {
    titulo: "Portfólio e currículo",
    texto: "Publique seus trabalhos em uma página pronta, com domínio próprio, sem depender de outra ferramenta.",
  },
  {
    titulo: "Conta protegida",
    texto: "Entrada por Google ou GitHub e verificação em duas etapas obrigatória no aplicativo autenticador.",
  },
];

const passos = [
  { titulo: "Crie sua conta", texto: "Entre com Google, com GitHub ou com e-mail e senha, em menos de um minuto." },
  { titulo: "Cadastre seus clientes", texto: "Traga seus contatos e comece a registrar conversas e propostas." },
  { titulo: "Cobre e acompanhe", texto: "Do orçamento ao recebimento, com o histórico de cada projeto no mesmo lugar." },
];

export default function HomePage() {
  return (
    <>
      <Container>
        <section className={styles.hero}>
          <Text as="h1" variant="largeTitle" weight="semibold" className={styles.heroTitle}>
            O Specular cuida da parte chata de viver de projeto
          </Text>
          <Text variant="title3" tone="secondary">
            Specular é a plataforma de gestão para freelancers e agências: CRM, orçamentos, contratos, cobrança,
            projetos, portfólio e financeiro reunidos em uma conta só, do primeiro contato com o cliente até o dinheiro
            na conta.
          </Text>
          <div className={styles.heroActions}>
            <Button href="/cadastro" size="lg">
              Criar conta
            </Button>
            <Button href="/login" size="lg" variant="outline">
              Entrar
            </Button>
          </div>
        </section>
      </Container>

      <Container>
        <section className={styles.section} aria-labelledby="recursos">
          <Text as="h2" id="recursos" variant="title2" weight="semibold">
            O que você faz no Specular
          </Text>
          <div className={styles.grid}>
            {recursos.map((recurso) => (
              <article key={recurso.titulo} className={styles.card}>
                <Text as="h3" variant="headline">
                  {recurso.titulo}
                </Text>
                <Text variant="subheadline" tone="secondary">
                  {recurso.texto}
                </Text>
              </article>
            ))}
          </div>
        </section>
      </Container>

      <Container>
        <section className={styles.section} aria-labelledby="como-funciona">
          <Text as="h2" id="como-funciona" variant="title2" weight="semibold">
            Como funciona
          </Text>
          <ol className={styles.steps}>
            {passos.map((passo) => (
              <li key={passo.titulo} className={styles.step}>
                <Text as="h3" variant="headline">
                  {passo.titulo}
                </Text>
                <Text variant="subheadline" tone="secondary">
                  {passo.texto}
                </Text>
              </li>
            ))}
          </ol>
        </section>
      </Container>

      <Container>
        <section className={styles.section} aria-labelledby="privacidade">
          <Text as="h2" id="privacidade" variant="title2" weight="semibold">
            Seus dados são seus
          </Text>
          <Text variant="body" tone="secondary">
            O Specular usa os dados da sua conta apenas para operar o serviço que você contratou. Nada é vendido e nada
            é usado para publicidade. Quando você entra com Google ou GitHub, recebemos somente nome, e-mail e foto de
            perfil, para identificar sua conta. Os detalhes estão na{" "}
            <TextLink href="/politica-de-privacidade" underline="always">
              Política de Privacidade
            </TextLink>{" "}
            e nos{" "}
            <TextLink href="/termos" underline="always">
              Termos de uso
            </TextLink>
            .
          </Text>
        </section>
      </Container>
    </>
  );
}
