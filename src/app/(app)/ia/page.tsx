import { AiWorkspace } from "@/features/ai/components/ai-workspace";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "SpeculAI",
  description: "Pergunte sobre a sua conta e aja nela pelo assistente",
  path: "/ia",
});

/**
 * O SpeculAI em tela cheia. É a mesma conversa da coluna lateral, no mesmo provedor da concha, com o que a
 * coluna não tem espaço para oferecer: a trilha de conversas à vista, a busca nelas, renomear e excluir, e a
 * escolha do que o assistente pode ler.
 *
 * A página não passa dado nenhum: o assistente inteiro vive no provedor da concha, que já recebe o uso do
 * ciclo, com quem ele fala e o histórico. É o que faz perguntar numa tela e continuar aqui ser a mesma
 * conversa, em vez de duas listas que não se conhecem.
 *
 * **Sem o topo da aplicação** (a pedido, 2026-09-15): a rota e o nome da página no alto valem para tela que
 * é uma lista ou um cadastro, e aqui a tela é a conversa inteira. Uma faixa dizendo "Inteligência
 * artificial" só tirava altura de quem lê. O nome da página fica no título do documento e no h1 da voz.
 */
export default function AssistantPage() {
  return <AiWorkspace />;
}
