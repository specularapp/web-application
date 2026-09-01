import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { createMetadata } from "@/lib/metadata";
import styles from "../marketing.module.css";

export const metadata = createMetadata({
  title: "Termos de uso",
  description: "Regras de uso da plataforma Specular",
  path: "/termos",
  origin: "site",
});

const blocos = [
  {
    titulo: "Aceite",
    paragrafos: [
      "Ao criar uma conta no Specular você concorda com estes termos. Se não concordar, não use a plataforma. O Specular é operado no Brasil e o contato é contato@specular.com.br.",
    ],
  },
  {
    titulo: "O que oferecemos",
    paragrafos: [
      "O Specular é uma plataforma de gestão para freelancers e agências, com CRM, orçamentos, contratos, cobrança, projetos, portfólio e controle financeiro. Podemos evoluir, alterar ou descontinuar funções, avisando com antecedência razoável quando a mudança for relevante.",
    ],
  },
  {
    titulo: "Sua conta",
    paragrafos: [
      "Você é responsável por manter seus dados de acesso em segurança e pelo que acontece na sua conta. A verificação em duas etapas é obrigatória. Avise imediatamente se suspeitar de acesso indevido.",
      "Você precisa ter pelo menos 18 anos e fornecer informações verdadeiras no cadastro.",
    ],
  },
  {
    titulo: "Seu conteúdo",
    paragrafos: [
      "O conteúdo que você cadastra continua sendo seu. Você nos concede apenas a licença necessária para armazenar e exibir esse conteúdo dentro da plataforma, inclusive nas páginas públicas que você mesmo escolher publicar, como portfólio e propostas.",
      "Você é responsável por ter direito sobre o que publica e por respeitar a privacidade dos seus clientes.",
    ],
  },
  {
    titulo: "Uso aceitável",
    paragrafos: ["Não é permitido usar o Specular para:"],
    lista: [
      "Atividade ilegal, fraude ou violação de direitos de terceiros.",
      "Enviar spam ou mensagens não solicitadas em massa.",
      "Tentar burlar limites técnicos, acessar dados de outras contas ou atacar a infraestrutura.",
      "Revender o acesso à plataforma sem autorização por escrito.",
    ],
  },
  {
    titulo: "Pagamento",
    paragrafos: [
      "Planos pagos são cobrados de forma recorrente pelo processador de pagamentos, com renovação automática até o cancelamento. Você pode cancelar quando quiser e o acesso segue até o fim do período já pago. Valores e condições ficam na página de planos.",
    ],
  },
  {
    titulo: "Encerramento",
    paragrafos: [
      "Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes termos, avisando quando for possível. Após o encerramento, seus dados são tratados conforme a Política de Privacidade.",
    ],
  },
  {
    titulo: "Garantias e responsabilidade",
    paragrafos: [
      "Trabalhamos para manter o serviço disponível e íntegro, mas ele é oferecido no estado em que se encontra. Não respondemos por lucros cessantes ou por decisões de negócio tomadas com base nas informações da plataforma. Nada aqui afasta direitos garantidos pelo Código de Defesa do Consumidor.",
    ],
  },
  {
    titulo: "Lei aplicável",
    paragrafos: [
      "Estes termos seguem a lei brasileira, e fica eleito o foro do domicílio do usuário para resolver qualquer questão. Versão vigente desde 31 de agosto de 2026.",
    ],
  },
];

export default function TermsPage() {
  return (
    <Container>
      <div className={styles.legal}>
        <Text as="h1" variant="largeTitle" weight="semibold">
          Termos de uso
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
          Veja também a{" "}
          <TextLink href="/politica-de-privacidade" underline="always">
            Política de Privacidade
          </TextLink>
          .
        </Text>
      </div>
    </Container>
  );
}
