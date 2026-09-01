import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { createMetadata } from "@/lib/metadata";
import styles from "../marketing.module.css";

export const metadata = createMetadata({
  title: "Política de Privacidade",
  description: "Como o Specular coleta, usa e protege os dados de quem usa a plataforma",
  path: "/politica-de-privacidade",
  origin: "site",
});

const blocos = [
  {
    titulo: "Quem somos",
    paragrafos: [
      "O Specular é uma plataforma de gestão para freelancers e agências, operada no Brasil. Esta política explica quais dados tratamos, para quê, e o que você pode pedir a qualquer momento. O contato para assuntos de privacidade é contato@specular.com.br.",
    ],
  },
  {
    titulo: "Dados que coletamos",
    paragrafos: ["Tratamos apenas o necessário para a plataforma funcionar:"],
    lista: [
      "Dados de cadastro: nome, endereço de e-mail e senha, esta última guardada apenas como hash.",
      "Dados de login social: quando você entra com Google ou GitHub, recebemos do provedor seu nome, endereço de e-mail e foto de perfil.",
      "Dados de uso da plataforma: clientes, orçamentos, contratos, cobranças, projetos e arquivos que você mesmo cadastra.",
      "Dados técnicos: endereço IP e registros de acesso, guardados para segurança e para limitar tentativas abusivas de login.",
    ],
  },
  {
    titulo: "Como usamos esses dados",
    paragrafos: [
      "Usamos os dados para criar e manter sua conta, autenticar o acesso, executar as funções que você aciona na plataforma, emitir cobranças, dar suporte e cumprir obrigações legais.",
      "Os dados obtidos pelo login do Google são usados exclusivamente para identificar sua conta no Specular. Não usamos esses dados para publicidade, não os vendemos e não os compartilhamos com terceiros para fins de marketing. O uso de informações recebidas das APIs do Google segue a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de uso limitado.",
    ],
  },
  {
    titulo: "Com quem compartilhamos",
    paragrafos: ["Não vendemos dados. Compartilhamos apenas com os serviços necessários para operar a plataforma:"],
    lista: [
      "Supabase, para banco de dados e autenticação.",
      "Vercel, para hospedagem da aplicação.",
      "Resend, para envio de e-mails da conta, como confirmação e recuperação de senha.",
      "Stripe, para processamento de pagamentos, quando houver assinatura.",
      "Cloudflare, para proteção contra automação abusiva nas telas de acesso.",
    ],
  },
  {
    titulo: "Por quanto tempo guardamos",
    paragrafos: [
      "Mantemos seus dados enquanto sua conta existir. Após a exclusão da conta, removemos os dados pessoais em até 30 dias, exceto o que a lei exigir manter, como registros fiscais e de acesso.",
    ],
  },
  {
    titulo: "Seus direitos",
    paragrafos: [
      "Pela Lei Geral de Proteção de Dados, você pode pedir confirmação do tratamento, acesso, correção, portabilidade, anonimização e exclusão dos seus dados, além de revogar consentimento. Para exercer qualquer um desses direitos, escreva para contato@specular.com.br e respondemos em até 15 dias.",
      "Você também pode excluir sua conta a qualquer momento dentro da plataforma, o que dispara a exclusão descrita acima.",
    ],
  },
  {
    titulo: "Segurança",
    paragrafos: [
      "O acesso é protegido por verificação em duas etapas obrigatória, o tráfego é cifrado, as senhas são guardadas apenas como hash e o banco de dados usa isolamento por linha, de modo que uma conta não alcança dados de outra.",
    ],
  },
  {
    titulo: "Cookies",
    paragrafos: [
      "Usamos cookies estritamente necessários para manter você conectado e para lembrar preferências de interface, como o tema. Não usamos cookies de publicidade nem de rastreamento entre sites.",
    ],
  },
  {
    titulo: "Mudanças nesta política",
    paragrafos: [
      "Se esta política mudar, publicamos a nova versão nesta mesma página e avisamos por e-mail quando a mudança for relevante. Versão vigente desde 31 de agosto de 2026.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <Container>
      <div className={styles.legal}>
        <Text as="h1" variant="largeTitle" weight="semibold">
          Política de Privacidade
        </Text>
        <Text variant="body" tone="secondary">
          Esta política vale para o site specular.com.br e para a plataforma em app.specular.com.br.
        </Text>

        {blocos.map((bloco) => (
          <section key={bloco.titulo} className={styles.legalBlock}>
            <Text as="h2" variant="title3" weight="semibold">
              {bloco.titulo}
            </Text>
            {bloco.paragrafos.map((paragrafo) => (
              <Text key={paragrafo} variant="body" tone="secondary">
                {paragrafo}
              </Text>
            ))}
            {bloco.lista && (
              <ul className={styles.legalList}>
                {bloco.lista.map((item) => (
                  <li key={item}>
                    <Text variant="body" tone="secondary">
                      {item}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <Text variant="footnote" tone="secondary">
          Veja também os{" "}
          <TextLink href="/termos" underline="always">
            Termos de uso
          </TextLink>
          .
        </Text>
      </div>
    </Container>
  );
}
